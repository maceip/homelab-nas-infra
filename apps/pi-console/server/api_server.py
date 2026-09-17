"""Local SPR frontend adapter for the independently installed Pi services.

No SPR daemon, container engine, router policy, or network changes are required.
The loopback-only server uses the user's existing SSH transport. Mutations are
disabled unless PI_CONSOLE_ALLOW_CONTROL=1 is explicitly set when starting it.
"""
from http_limits import QuietHandler
import hmac
import http.cookies
import ipaddress
import json
import mimetypes
import os
import pathlib
import re
import secrets
import socket
import sqlite3
import shutil
import shlex
import subprocess
import threading
import time
import urllib.parse
import dashboard_settings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'server/catalog.json').read_text())
BY_ID = {s['id']: s for s in CATALOG}
STORAGE_PROBE = (ROOT / 'server/storage_health.py').read_text()
HS = ['headscale', '--config', '/home/pi/upstream-software/state/headscale/config.yaml']


def redact(text):
    text = re.sub(r'-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----', '[private key redacted]', text, flags=re.S)
    text = re.sub(r'hskey-[A-Za-z0-9_-]+', '[enrollment key redacted]', text)
    text = re.sub(r'(?i)(bearer\s+)[\w.\-]+', r'\1[redacted]', text)
    text = re.sub(r'(?i)((?:password|secret|auth[_-]?key|api[_-]?key|token)\s*[=:]\s*)[^\s,;]+', r'\1[redacted]', text)
    return text


class SSHRunner:
    def __call__(self, argv, timeout=25):
        target = os.environ.get('PI_CONSOLE_SSH_TARGET')
        if target:
            command = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '--', target, shlex.join(argv)]
        else:
            helper = os.environ.get('PI_CONSOLE_SSH_HELPER', '/tmp/ail-nas-ssh.py')
            if not pathlib.Path(helper).is_file():
                raise RuntimeError('Set PI_CONSOLE_SSH_TARGET to an existing SSH host alias, or provide the SSH connection helper.')
            command = ['uv', 'run', '--with', 'pexpect', 'python', helper, shlex.join(argv)]
        p = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
        if p.returncode:
            raise RuntimeError(redact(p.stderr.strip() or p.stdout.strip() or 'SSH command failed')[-1000:])
        return p.stdout.strip()


class LocalRunner:
    """Run the same read-only probes on the deployed Pi without SSH."""
    def __call__(self, argv, timeout=25):
        if argv[:2] == ['sudo', 'journalctl']:
            argv = argv[1:]
        p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
        if p.returncode:
            raise RuntimeError(redact(p.stderr.strip() or p.stdout.strip() or 'Probe failed')[-1000:])
        return p.stdout.strip()


class Adapter:
    def __init__(self, runner=None, allow_control=False):
        self.deployed = os.environ.get('PI_CONSOLE_LOCAL') == '1'
        self.runner = runner or (LocalRunner() if self.deployed else SSHRunner())
        self.allow_control = allow_control
        self.csrf = secrets.token_urlsafe(32)
        self.session = secrets.token_urlsafe(32)
        self.lock = threading.Lock()
        self.snapshot = None
        self.snapshot_time = 0

    def collect(self, force=False):
        with self.lock:
            if not force and self.snapshot and time.time() - self.snapshot_time < 15:
                return self.snapshot
            units = [s['unit'] for s in CATALOG if s['unit']]
            code = '''import json,subprocess,pathlib,os,shutil,time,socket
def cmd(a):
 p=subprocess.run(a,capture_output=True,text=True,timeout=10)
 if p.returncode: raise RuntimeError(p.stderr[:500])
 return p.stdout
units=UNITS
try:
 storage=json.loads(subprocess.run(['python3','-c',STORAGE_CODE],capture_output=True,text=True,timeout=8,check=True).stdout)
except (subprocess.SubprocessError,ValueError,OSError):
 storage={'healthy':False,'sampled_at':time.time(),'message':'Storage health check failed or timed out.'}

raw=cmd(['systemctl','show',*units,'--property=Id,LoadState,ActiveState,SubState,UnitFileState,ExecMainStatus,MemoryCurrent'])
state={}
for block in raw.strip().split('\\n\\n'):
 d=dict(line.split('=',1) for line in block.splitlines() if '=' in line)
 if d.get('Id'): state[d['Id']]=d
mem={k:int(v.split()[0])*1024 for k,v in (line.split(':',1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines())}
disk=shutil.disk_usage('/home/pi/upstream-software')
temp=pathlib.Path('/sys/class/thermal/thermal_zone0/temp')
print(json.dumps({'storage':storage,'hostname':socket.gethostname(),'uptime':float(pathlib.Path('/proc/uptime').read_text().split()[0]),'memory_total':mem['MemTotal'],'memory_available':mem['MemAvailable'],'disk_total':disk.total,'disk_free':disk.free,'load':os.getloadavg(),'temperature':float(temp.read_text())/1000 if temp.exists() else None,'units':state,'interfaces':json.loads(cmd(['ip','-j','address'])),'routes':json.loads(cmd(['ip','-j','route'])),'sampled_at':time.time()}))
'''.replace('UNITS', repr(units)).replace('STORAGE_CODE', repr(STORAGE_PROBE))
            value = json.loads(self.runner(['python3', '-c', code]))
            value['services'] = [dict(s, **{'runtime': value['units'].get(s['unit'], {})}) for s in CATALOG]
            value['deployed'] = self.deployed
            value['file_browser_url'] = os.environ.get('PI_CONSOLE_FILE_BROWSER_URL', 'http://192.168.0.56:8080/files/')
            value['read_only'] = not self.allow_control
            value['connected'] = True
            self.snapshot = value
            self.snapshot_time = time.time()
            return value

    def vpn(self):
        # Only the fields required for the UI cross the SSH boundary.
        code = '''import subprocess,json
n=json.loads(subprocess.check_output(HS+['nodes','list','-o','json'],text=True))
print(json.dumps([{'id':x['id'],'name':x.get('given_name') or x.get('name'),'addresses':x.get('ip_addresses',[]),'online':bool(x.get('online')),'user':x.get('user',{}).get('name'),'last_seen':x.get('last_seen')} for x in n]))
'''.replace('HS', repr(HS))
        return {'server': 'https://matts.public.computer', 'nodes': json.loads(self.runner(['python3', '-c', code])),
                'read_only': not self.allow_control}

    def logs(self, service):
        item = BY_ID.get(service)
        if not item or not item['unit']:
            raise ValueError('This application does not have a managed background service.')
        out = self.runner(['sudo', 'journalctl', '-u', item['unit'], '-n', '100', '--no-pager', '-o', 'short-iso'])
        return {'service': service, 'text': redact(out)}

    def observability(self):
        if self.deployed:
            from telemetry import snapshot
            return snapshot()
        return json.loads(self.runner(['python3', '/opt/pi-console/current/server/telemetry.py', 'snapshot']))

    def action(self, service, action):
        if not self.allow_control:
            raise PermissionError('Service changes are disabled in this local preview.')
        item = BY_ID.get(service)
        if not item or not item['unit'] or action not in ('start', 'stop', 'restart'):
            raise ValueError('Unknown service or action.')
        if item['protected']:
            raise PermissionError('This service maintains connectivity and cannot be changed here.')
        self.control({'service': service, 'action': action})
        self.snapshot_time = 0
        return {'service': service, 'action': action, 'completed': True}

    def control(self, message):
        with socket.socket(socket.AF_UNIX) as connection:
            connection.settimeout(20)
            connection.connect('/run/pi-control/control.sock')
            connection.sendall(json.dumps(message).encode()+b'\n')
            raw=b''
            while not raw.endswith(b'\n') and len(raw)<8192:
                block=connection.recv(8192)
                if not block: break
                raw+=block
            value=json.loads(raw)
            if not value.get('ok'): raise RuntimeError(value.get('error','Action failed.'))
            return value

    def register(self, auth_id):
        if not self.allow_control:
            raise PermissionError('Device approval is disabled in this local preview.')
        if not isinstance(auth_id, str) or not re.fullmatch(r'hskey-authreq-[A-Za-z0-9_-]{10,100}', auth_id):
            raise ValueError('Enter the authentication ID shown on the phone.')
        # Capture only sanitized registration output, never return keys.
        raw = json.loads(self.runner(HS + ['auth', 'register', '--auth-id', auth_id, '--user', 'owner', '-o', 'json']))
        return {'name': raw.get('given_name') or raw.get('name'), 'addresses': raw.get('ip_addresses', [])}


class Handler(QuietHandler):
    server_version = 'PiConsole'

    def log_message(self, fmt, *args):
        # Request payloads, registration identifiers, cookies and credentials are never logged.
        pass

    def respond(self, status, body, content_type='application/json', cookie=False):
        route = urllib.parse.urlsplit(self.path).path
        # Never log query strings, cookies, payloads, enrollment IDs or credentials.
        if not re.fullmatch(r'/pi-api/(?:session|overview|status|observability|vpn|tests|provenance)', route):
            route = '/pi-api/action' if route.startswith('/pi-api/') else '/page-or-asset'
        if status >= 400 or self.command != 'GET' or route == '/pi-api/session':
            print('PI_ACCESS ' + json.dumps({'method': self.command, 'route': route,
                  'status': status, 'source': self.client_address[0]}), flush=True)
        data = json.dumps(body).encode() if content_type == 'application/json' else body
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store' if content_type == 'application/json' else 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'")
        if cookie:
            self.send_header('Set-Cookie', 'pi_session=' + self.server.adapter.session + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' + ('; Secure' if os.environ.get('PI_CONSOLE_SCHEME') == 'https' else ''))
        self.end_headers()
        self.wfile.write(data)

    def boundary(self):
        host = self.headers.get('Host', '')
        try:
            parsed = urllib.parse.urlsplit('http://' + host)
            allowed = {'localhost', '127.0.0.1', '::1'}
            public_host = os.environ.get('PI_CONSOLE_PUBLIC_HOST')
            if self.server.adapter.deployed and public_host:
                allowed.add(public_host)
            if parsed.hostname not in allowed or parsed.username or parsed.password:
                return False
            origin = self.headers.get('Origin')
            if origin and origin != os.environ.get('PI_CONSOLE_SCHEME', 'http') + '://' + host:
                return False
            if self.headers.get('Sec-Fetch-Site') in ('cross-site', 'same-site'):
                return False
            peer = ipaddress.ip_address(self.client_address[0])
            return peer.is_loopback or (self.server.adapter.deployed and any(
                peer in network for network in self.server.allowed_networks))
        except ValueError:
            return False

    def authenticated(self):
        cookies = http.cookies.SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
        except http.cookies.CookieError:
            return False
        value = cookies.get('pi_session')
        return bool(value) and hmac.compare_digest(value.value, self.server.adapter.session)

    def do_GET(self):
        if not self.boundary():
            return self.respond(403, {'error': 'This dashboard is available only through its configured private address.'})
        path = urllib.parse.urlsplit(self.path).path
        if path == '/pi-api/session':
            return self.respond(200, {'csrf': self.server.adapter.csrf, 'read_only': not self.server.adapter.allow_control, 'access_mode': os.environ.get('PI_CONSOLE_ACCESS_MODE','tailnet')}, cookie=True)
        if path.startswith('/pi-api/'):
            if not self.authenticated():
                return self.respond(401, {'error': 'Open the dashboard to begin a session.'})
            try:
                if path in ('/pi-api/overview', '/pi-api/status'):
                    return self.respond(200, self.server.adapter.collect())
                if path == '/pi-api/inbox':
                    with sqlite3.connect('file:/var/lib/pi-upload/inbox.sqlite?mode=ro',uri=True) as c:
                        c.row_factory=sqlite3.Row
                        rows=[dict(r) for r in c.execute("SELECT id,name,size,ts FROM uploads WHERE state='complete' ORDER BY ts DESC LIMIT 100")]
                    return self.respond(200,{'files':rows})
                inbox_match=re.fullmatch(r'/pi-api/inbox/([a-f0-9]{32})',path)
                if inbox_match:
                    uid=inbox_match[1]
                    with sqlite3.connect('file:/var/lib/pi-upload/inbox.sqlite?mode=ro',uri=True) as c:
                        row=c.execute("SELECT name FROM uploads WHERE id=? AND state='complete'",(uid,)).fetchone()
                    if not row: return self.respond(404,{'error':'Upload not found.'})
                    with (pathlib.Path('/var/lib/pi-upload')/(uid+'.upload')).open('rb') as f:
                        self.send_response(200)
                        self.send_header('Content-Type','application/octet-stream')
                        self.send_header('Content-Length',str(os.fstat(f.fileno()).st_size))
                        self.send_header('Content-Disposition',"attachment; filename*=UTF-8''"+urllib.parse.quote(row[0],safe=''))
                        self.send_header('X-Content-Type-Options','nosniff')
                        self.send_header('Cache-Control','no-store')
                        self.end_headers();shutil.copyfileobj(f,self.wfile,65536)
                    return
                if path == '/pi-api/settings':
                    return self.respond(200, dashboard_settings.read())
                if path == '/pi-api/vpn':
                    return self.respond(200, self.server.adapter.vpn())
                if path == '/pi-api/observability':
                    return self.respond(200, self.server.adapter.observability())
                if path == '/pi-api/provenance':
                    return self.respond(200, json.loads((ROOT / 'server/provenance.json').read_text()))
                if path == '/pi-api/tests':
                    report = ROOT / 'tests/results.json'
                    return self.respond(200, json.loads(report.read_text()) if report.exists() else {'state': 'Not run', 'suites': []})
                match = re.fullmatch(r'/pi-api/services/([a-z0-9-]+)/logs', path)
                if match:
                    return self.respond(200, self.server.adapter.logs(match[1]))
                return self.respond(404, {'error': 'Unknown dashboard endpoint.'})
            except ValueError as exc:
                return self.respond(400, {'error': str(exc)})
            except Exception as exc:
                return self.respond(502, {'error': redact(str(exc))[:1200], 'connected': False})
        build = ROOT / 'frontend/build'
        relative = urllib.parse.unquote(path).lstrip('/')
        target = (build / relative).resolve()
        if not target.is_relative_to(build.resolve()):
            return self.respond(403, {'error': 'Invalid path.'})
        if not target.is_file():
            if '.' in pathlib.PurePosixPath(relative).name:
                return self.respond(404, {'error': 'File not found.'})
            target = build / 'index.html'
        if not target.is_file():
            return self.respond(503, {'error': 'The frontend build is not ready.'})
        return self.respond(200, target.read_bytes(), mimetypes.guess_type(target.name)[0] or 'application/octet-stream')

    def do_POST(self):
        if not self.boundary() or not self.authenticated():
            return self.respond(403, {'error': 'A local dashboard session is required.'})
        if not hmac.compare_digest(self.headers.get('X-Pi-CSRF', ''), self.server.adapter.csrf):
            return self.respond(403, {'error': 'Refresh the dashboard before making a change.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 4096:
                return self.respond(413, {'error': 'Request too large.'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'JSON is required.'})
            body = json.loads(self.rfile.read(length) or b'{}')
            path = urllib.parse.urlsplit(self.path).path
            if path == '/pi-api/settings':
                if not self.server.adapter.allow_control: raise PermissionError('Configuration requires private access.')
                result=dashboard_settings.write(body)
                print('PI_SETTINGS_UPDATED',flush=True)
                return self.respond(200,result)
            match = re.fullmatch(r'/pi-api/services/([a-z0-9-]+)/(start|stop|restart)', path)
            if match:
                return self.respond(200, self.server.adapter.action(match[1], match[2]))
            if path == '/pi-api/vpn/register':
                return self.respond(200, self.server.adapter.register(body.get('auth_id')))
            return self.respond(404, {'error': 'Unknown dashboard action.'})
        except PermissionError as exc:
            return self.respond(403, {'error': str(exc)})
        except (ValueError, TypeError, AttributeError) as exc:
            return self.respond(400, {'error': str(exc)})
        except Exception as exc:
            return self.respond(502, {'error': redact(str(exc))[:1200]})


def make_server(port=19100, adapter=None, bind='127.0.0.1', allowed_networks=()):
    networks = tuple(ipaddress.ip_network(network) for network in allowed_networks)
    server = ThreadingHTTPServer((bind, port), Handler)
    server.allowed_networks = networks
    server.adapter = adapter or Adapter(allow_control=os.environ.get('PI_CONSOLE_ALLOW_CONTROL') == '1')
    server.daemon_threads = True
    return server


if __name__ == '__main__':
    server = make_server(
        int(os.environ.get('PI_CONSOLE_PORT', '19100')),
        bind=os.environ.get('PI_CONSOLE_BIND', '127.0.0.1'),
        allowed_networks=os.environ.get('PI_CONSOLE_ALLOWED_NETWORKS', '').split())
    print('Pi dashboard listening on ' + str(server.server_address), flush=True)
    server.serve_forever()
