"""Bounded Pi telemetry and explainable activity signals; no packet interception."""
import argparse
from contextlib import contextmanager
import gzip
import io
import tarfile
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import time
import uuid

STATE = Path(os.environ.get('PI_OBSERVABILITY_DIR', '/var/lib/pi-observability'))
TRUSTED = {'192.168.0.142', '192.168.100.1', '127.0.0.1', '::1'}
SETTINGS = Path('/var/lib/pi-console/settings.json')

def settings():
    try: return json.loads(SETTINGS.read_text())
    except (OSError, ValueError): return {}
SCHEMA = '''
CREATE TABLE IF NOT EXISTS samples(ts REAL PRIMARY KEY,cpu REAL,temp REAL,load REAL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,ts REAL,source TEXT,kind TEXT,severity TEXT,summary TEXT,fingerprint TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
'''

@contextmanager
def db():
    STATE.mkdir(mode=0o750, parents=True, exist_ok=True)
    c = sqlite3.connect(STATE/'telemetry.sqlite', timeout=10)
    c.executescript(SCHEMA)
    # Additive migration keeps historical readings and events intact.
    columns = {r[1] for r in c.execute('PRAGMA table_info(samples)')}
    for name in ('memory_percent', 'disk_busy', 'net_rx_bps', 'net_tx_bps'):
        if name not in columns:
            c.execute(f'ALTER TABLE samples ADD COLUMN {name} REAL')
    try:
        with c:
            yield c
    finally:
        c.close()


def put(c, key, value):
    c.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', (key, json.dumps(value)))


def get(c, key, default=None):
    r = c.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
    return json.loads(r[0]) if r else default


def event(c, ts, source, kind, severity, summary, fingerprint):
    c.execute('INSERT OR IGNORE INTO events(ts,source,kind,severity,summary,fingerprint) VALUES(?,?,?,?,?,?)',
              (ts, source[:80], kind, severity, summary[:300], fingerprint))


def message(entry):
    m = entry.get('MESSAGE', '')
    return bytes(m).decode(errors='replace') if isinstance(m, list) else str(m)


def classify(c, entry):
    """Only selected metadata leaves the journal; isolated denied probes stay informational."""
    text = message(entry)
    ts = int(entry.get('__REALTIME_TIMESTAMP', int(time.time()*1e6)))/1e6
    ident = entry.get('SYSLOG_IDENTIFIER', '')
    unit = entry.get('_SYSTEMD_UNIT', '')
    fingerprint = entry.get('__CURSOR') or hashlib.sha256((str(ts)+text).encode()).hexdigest()
    if 'sshd' in ident or unit == 'ssh.service':
        match = re.search(r'Accepted \w+ for (\S+) from (\S+)', text)
        if match:
            account, source = match.groups()
            if source not in set(settings().get('trusted_admin_ips', TRUSTED)):
                event(c, ts, source, 'unfamiliar_login', 'high', 'Successful SSH login from an address outside the known administrator baseline; verify ownership.', fingerprint)
            return
        match = re.search(r'(?:Failed password.* from |Invalid user.* from |rhost=)([\da-fA-F:.]+)', text)
        if match:
            source = match[1]
            event(c, ts, source, 'auth_failure', 'info', 'Rejected SSH authentication.', fingerprint)
            burst(c, ts, source, 'auth_failure', settings().get('ssh_burst_threshold', 5), 'Repeated authentication failures', fingerprint)
    if unit == 'upstream-headscale.service' and 'http request' in text:
        fields = dict(re.findall(r'\b(path|remote|status)=([^ ]+)', text))
        path = fields.get('path', '')
        if any(s in path for s in ['.env', '/.git/', '/.ssh/', 'backup.sql', 'dump.sql', 'secrets.json', 'wp-config', 'server.key']):
            source = fields.get('remote', 'unknown').rsplit(':',1)[0]
            code = fields.get('status', '')
            event(c, ts, source, 'web_probe', 'info', 'Request for a sensitive-file path; HTTP '+code+'.', fingerprint)
            if code.startswith('2'):
                event(c, ts, source, 'sensitive_response', 'high', 'Sensitive-path request returned HTTP '+code+'; inspect response, success status alone does not prove disclosure.', fingerprint+'-response')
            else:
                burst(c, ts, source, 'web_probe', settings().get('web_probe_threshold', 10), 'Cluster of sensitive-file probes', fingerprint)
    if unit in ('pi-console.service', 'pi-console-lan.service'):
        # Requests to normal polling endpoints are intentionally not activity alerts.
        if text.startswith('PI_ACCESS '):
            try:
                data = json.loads(text[len('PI_ACCESS '):])
                if data.get('status', 0) in (401,403):
                    event(c, ts, 'dashboard boundary', 'dashboard_denial', 'info', 'Dashboard request denied; proxy may mask the original source.', fingerprint)
            except ValueError:
                pass
    if unit == 'pi-gateway.service':
        try:
            record=json.loads(text)
            request=record.get('request',{})
            source=request.get('remote_ip') or request.get('remote_addr','unknown').rsplit(':',1)[0]
            status=record.get('status',0)
            if record.get('logger','').endswith(('.files','.log1')):
                method=request.get('method','GET')
                event(c,ts,'Tailnet file browser','file_operation','info',f'File browser {method} returned HTTP {status}; filenames are not included.',fingerprint)
            elif status in (401,403,404,429):
                event(c,ts,source,'gateway_denial','info',f'Public gateway rejected a request with HTTP {status}.',fingerprint)
                burst(c,ts,source,'gateway_denial',settings().get('web_probe_threshold',10),'Repeated rejected public requests',fingerprint)
        except (ValueError,TypeError):pass
    if unit == 'pi-control.service' and text.startswith('PI_CONTROL '):
        event(c,ts,'Tailnet administration','owner_action','info','A service-control action was completed through the private dashboard.',fingerprint)
    if unit == 'pi-upload.service' and text.startswith('PI_UPLOAD '):
        event(c,ts,'Public inbox','public_upload','info','A bounded upload was accepted after the gateway challenge.',fingerprint)
    if ident == 'smbd_audit' or 'smbd_audit' in ident:
        event(c,ts,'LAN file sharing','smb_operation','info','SMB file access was audited; consult the private host log for details.',fingerprint)
    if ident in ('kernel',) and re.search(r'failed command:|I/O error|Filesystem has been shut down|device offline|AER:.*(Fatal|Uncorrected)|qc timeout|failed to read native max|link is slow to respond|hard resetting link',text,re.I):
        event(c,ts,'Pi storage','hardware_fault','warning','Kernel reported a storage/PCIe fault; inspect preserved system logs.',fingerprint)


def burst(c, ts, source, kind, threshold, summary, fingerprint):
    count = c.execute('SELECT count(*) FROM events WHERE kind=? AND source=? AND ts BETWEEN ? AND ?', (kind,source,ts-300,ts)).fetchone()[0]
    recent = c.execute('SELECT 1 FROM events WHERE kind=? AND source=? AND ts BETWEEN ? AND ?', (kind+'_burst',source,ts-300,ts)).fetchone()
    if count >= threshold and not recent:
        event(c,ts,source,kind+'_burst','warning',f'{summary}: at least {count} in five minutes. Review recommended; not proof of compromise.',fingerprint+'-burst')


def snapshot():
    path = STATE/'telemetry.sqlite'
    if not path.exists():
        return {'available':False,'reason':'Observability collector has not produced data yet.','samples':[],'events':[]}
    c=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True,timeout=5)
    c.row_factory=sqlite3.Row
    now=time.time()
    with c:
        samples=[dict(r) for r in c.execute('SELECT * FROM samples WHERE ts>? ORDER BY ts',(now-86400,))]
        events=[dict(r) for r in c.execute("SELECT ts,source,kind,severity,summary FROM events WHERE ts>? AND severity!='info' ORDER BY ts DESC LIMIT 100",(now-86400,))]
        # Graph aggregates *all* alerts, independently of the detail-list limit.
        bins=[dict(r) for r in c.execute("SELECT CAST(ts/300 AS INTEGER)*300 AS ts,count(*) AS count FROM events WHERE ts>? AND kind!='hardware_fault' AND severity!='info' GROUP BY CAST(ts/300 AS INTEGER) ORDER BY ts",(now-86400,))]
        counts=dict(c.execute('SELECT kind,count(*) FROM events WHERE ts>? GROUP BY kind',(now-86400,)))
        meta={r['key']:json.loads(r['value']) for r in c.execute('SELECT key,value FROM meta WHERE key IN (\'sampled_at\',\'journal_error\',\'router_received_at\',\'router_summary\',\'journal_started_at\',\'router_error\',\'router_excerpt\',\'pcie_speed\',\'io_sources\')')}
    c.close()
    return {'available':bool(samples),'samples':samples,'events':events,'activity_bins':bins,'counts':counts,'meta':meta,'stale':now-meta.get('sampled_at',0)>180,'window_seconds':86400,'rules':'Five SSH failures or ten sensitive-file probes from one address within five minutes; unfamiliar successful SSH logins; watched configuration changes. These are review signals, not intrusion verdicts.'}


def read_io_counters(root=Path('/')):
    """Only physical members of the NAS and the default-route interface.

    Never sum RAID and member counters, or LAN and overlay traffic: both would
    double count. Optional/unavailable devices yield missing data, not zero.
    """
    def text(name):
        return (root / name).read_text().strip()
    result = {'boot': text('proc/sys/kernel/random/boot_id'),
              'time': time.monotonic(), 'disks': {}, 'network': None}
    try:
        for member in sorted((root/'sys/block/md0/slaves').iterdir()):
            result['disks'][member.name] = int(text('sys/class/block/'+member.name+'/stat').split()[9])
    except (OSError, ValueError, IndexError):
        result['disks'] = {}
    try:
        routes = [line.split() for line in text('proc/net/route').splitlines()[1:]]
        routes = [r for r in routes if r[1] == '00000000' and int(r[3], 16) & 1]
        interface = min(routes, key=lambda r: int(r[6]))[0]
        base = 'sys/class/net/'+interface+'/statistics/'
        result['network'] = {'interface': interface, 'rx': int(text(base+'rx_bytes')), 'tx': int(text(base+'tx_bytes'))}
    except (OSError, ValueError, IndexError):
        pass
    return result


def io_rates(previous, current):
    rates = {'disk_busy': None, 'net_rx_bps': None, 'net_tx_bps': None}
    if not previous or previous['boot'] != current['boot']:
        return rates
    seconds = current['time'] - previous['time']
    if not 0 < seconds <= 180:
        return rates
    disks, old_disks = current['disks'], previous['disks']
    if disks and disks.keys() == old_disks.keys() and all(disks[k] >= old_disks[k] for k in disks):
        # Maximum member busy time, not a misleading sum of four drive percentages.
        rates['disk_busy'] = min(100, max((disks[k]-old_disks[k])/seconds/10 for k in disks))
    net, old_net = current['network'], previous['network']
    if net and old_net and net['interface'] == old_net['interface']:
        for direction in ('rx', 'tx'):
            if net[direction] >= old_net[direction]:
                rates['net_'+direction+'_bps'] = (net[direction]-old_net[direction])*8/seconds
    return rates


def sample(c):
    nums=list(map(int,Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
    current=(sum(nums),nums[3]+nums[4]); previous=get(c,'cpu_ticks')
    io = read_io_counters()
    previous_io = get(c, 'io_counters')
    cpu=None
    if previous and previous_io and previous_io['boot'] == io['boot'] and 0 < io['time']-previous_io['time'] <= 180 and current[0]>previous[0]:
        cpu=max(0,min(100,100*(1-(current[1]-previous[1])/(current[0]-previous[0]))))
    put(c,'cpu_ticks',current)
    rates = io_rates(previous_io, io)
    put(c,'io_counters',io)
    put(c,'io_sources',{'disk': 'md0 busiest member', 'members': list(io['disks']), 'network': (io['network'] or {}).get('interface')})
    memory = {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
    memory_percent = 100 * (1-memory['MemAvailable']/memory['MemTotal'])
    temp=Path('/sys/class/thermal/thermal_zone0/temp')
    now=time.time()
    c.execute('INSERT OR REPLACE INTO samples(ts,cpu,temp,load,memory_percent,disk_busy,net_rx_bps,net_tx_bps) VALUES(?,?,?,?,?,?,?,?)',
              (now,cpu,float(temp.read_text())/1000 if temp.exists() else None,os.getloadavg()[0],memory_percent,rates['disk_busy'],rates['net_rx_bps'],rates['net_tx_bps']))
    put(c,'sampled_at',now)
    speed=Path('/sys/bus/pci/devices/0001:01:00.0/current_link_speed')
    put(c,'pcie_speed',speed.read_text().strip() if speed.exists() else None)


def track_configuration(c, signatures, version=2):
    # A changed watch scope is a new baseline, not evidence that files changed.
    old=get(c,'config_hashes')
    if old and get(c,'config_watch_version') == version:
        for name in sorted(set(old)|set(signatures)):
            if old.get(name)!=signatures.get(name):
                event(c,time.time(),'Pi configuration','configuration_change','notice','Watched configuration changed: '+name,'config-'+name+'-'+str(time.time()))
    put(c,'config_hashes',signatures)
    put(c,'config_watch_version',version)


def collect_once():
    with db() as c:
        sample(c)
        cursor=get(c,'journal_cursor')
        args=['journalctl','--no-pager','-o','json','-u','ssh','-u','upstream-headscale','-u','pi-console','-u','pi-console-lan','-u','pi-gateway','-u','pi-control','-u','pi-upload','-u','filebrowser','-u','smbd','-k']
        # -k implies current boot and combines with unit matches, so collect kernel separately.
        args=args[:-1]
        args+=['--after-cursor',cursor] if cursor else ['--since','24 hours ago']
        p=subprocess.run(args,capture_output=True,text=True,timeout=20)
        if p.returncode:
            put(c,'journal_error','Journal read failed; retained cursor may have expired. Collector will recover using a bounded time window.')
            put(c,'journal_cursor',None)
        else:
            put(c,'journal_error',None)
            put(c,'journal_started_at',get(c,'journal_started_at',time.time()))
            for line in p.stdout.splitlines():
                try: entry=json.loads(line)
                except ValueError: continue
                classify(c,entry)
                if entry.get('__CURSOR'):put(c,'journal_cursor',entry['__CURSOR'])
        audit=subprocess.run(['journalctl','-t','smbd_audit','--since','2 minutes ago','--no-pager','-o','json'],capture_output=True,text=True,timeout=10)
        for line in audit.stdout.splitlines():
            try:classify(c,json.loads(line))
            except ValueError:pass
        kernel=subprocess.run(['journalctl','-k','--since','2 minutes ago','--no-pager','-o','json'],capture_output=True,text=True,timeout=10)
        for line in kernel.stdout.splitlines():
            try:classify(c,json.loads(line))
            except ValueError:pass
        paths=[Path('/etc/passwd'),Path('/etc/ssh/sshd_config'),Path('/boot/firmware/config.txt')]
        paths+=list(Path('/etc/systemd/system').glob('*.service'))
        paths+=list(Path('/etc/systemd/system').glob('**/*.conf'))
        paths+=list(Path('/etc/systemd/journald.conf.d').glob('*.conf'))
        paths+=list(Path('/etc/ssh/sshd_config.d').glob('*.conf'))
        paths.append(Path('/boot/firmware/tryboot.txt'))
        signatures={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file() and os.access(p,os.R_OK)}
        track_configuration(c,signatures)
        c.execute('DELETE FROM samples WHERE ts<?',(time.time()-86400,))
        c.execute('DELETE FROM events WHERE ts<?',(time.time()-30*86400,))
        c.execute('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 20000)')

    publish_public_metrics()


def publish_public_metrics():
    from storage_health import probe
    current=snapshot()
    # At most 120 recent points; no hostnames, addresses, peers, logs or configuration.
    samples=current.get('samples',[])[-120:]
    meta=current.get('meta',{})
    public={'telemetry':{'available':current.get('available',False),'samples':samples,
                        'stale':current.get('stale',True),'meta':{'sampled_at':meta.get('sampled_at'),'io_sources':{'network':'Primary network interface'}}},
            'overview':{'sampled_at':time.time()}}
    storage=probe()
    public['overview']['storage']={k:storage[k] for k in ('healthy','total','used','free') if k in storage}
    directory=Path('/var/lib/pi-public');directory.mkdir(mode=0o755,exist_ok=True)
    temporary=directory/'metrics.pending'
    temporary.write_text(json.dumps(public,separators=(',',':')))
    temporary.chmod(0o644);temporary.replace(directory/'metrics.json')


def prune_mail():
    spool=STATE/'router'
    spool.mkdir(mode=0o750,parents=True,exist_ok=True)
    files=sorted(spool.glob('*.eml.gz'),key=lambda p:p.stat().st_mtime)
    total=sum(p.stat().st_size for p in files)
    for p in files:
        if total<=1024**3 and p.stat().st_mtime>time.time()-30*86400:continue
        total-=p.stat().st_size;p.unlink()


def router_text(raw):
    """Read bounded text/tar attachments in memory, never extract paths to disk."""
    from email import policy
    from email.parser import BytesParser
    mail=BytesParser(policy=policy.default).parsebytes(raw)
    chunks=[]
    budget=4*1024*1024
    for part in mail.walk():
        payload=part.get_payload(decode=True) or b''
        name=part.get_filename() or ''
        if name.endswith('.tar.gz'):
            with gzip.GzipFile(fileobj=io.BytesIO(payload)) as compressed:
                unpacked=compressed.read(budget+1)
            if len(unpacked)>budget:raise ValueError('Router archive exceeds expansion limit')
            with tarfile.open(fileobj=io.BytesIO(unpacked),mode='r:') as archive:
                for index,member in enumerate(archive):
                    if index>=64:raise ValueError('Too many archive members')
                    if not member.isfile():continue
                    if member.size>budget:raise ValueError('Router log exceeds text limit')
                    with archive.extractfile(member) as f:content=f.read(budget+1)
                    budget-=len(content)
                    if budget<0:raise ValueError('Router log exceeds text limit')
                    chunks.append(content.decode(errors='replace'))
        elif part.get_content_type() in ('text/plain','text/html'):
            content=payload[:budget]
            budget-=len(content)
            chunks.append(content.decode(errors='replace'))
    return '\n'.join(chunks)


class RouterMail:
    async def handle_MAIL(self,server,session,envelope,address,mail_options):
        if session.peer[0] != '192.168.0.1':return '550 Router source required'
        if address.lower()!='archer@router.local':return '550 Unexpected sender'
        envelope.mail_from=address
        envelope.mail_options.extend(mail_options)
        return '250 OK'

    async def handle_RCPT(self,server,session,envelope,address,rcpt_options):
        if address.lower()!='router-logs@pi.local':return '550 Local log recipient only; relaying prohibited'
        envelope.rcpt_tos.append(address)
        return '250 OK'

    async def handle_DATA(self,server,session,envelope):
        if session.peer[0]!='192.168.0.1' or envelope.rcpt_tos!=['router-logs@pi.local']:return '550 Rejected'
        raw=envelope.original_content
        if len(raw)>8*1024**2:return '552 Message too large'
        try:
            prune_mail()
            name=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]+'.eml.gz'
            target=STATE/'router'/name
            with target.open('xb') as out:
                with gzip.GzipFile(fileobj=out,mode='wb') as f:f.write(raw)
                out.flush();os.fsync(out.fileno())
            text=router_text(raw)
            # Hide obvious credentials in the dashboard; preserve the original only in the restricted archive.
            excerpt=re.sub(r'(?i)(password|passwd|token|secret|authorization|cookie)(\s*[:=]\s*)[^\s<]+', r'\1\2[redacted]', text)
            excerpt='\n'.join(excerpt.splitlines()[:80])[-12000:]
            failures=len(re.findall(r'login.*(?:fail|invalid)|auth.*(?:fail|reject)|incorrect password',text,re.I))
            faults=len(re.findall(r'firmware.*(?:fail|error)|upgrade.*(?:fail|error)',text,re.I))
            # Exports overlap. Deduplicate by payload hash rather than count every resend as a new incident.
            auth_lines='\n'.join(sorted(set(line for line in text.splitlines() if re.search(r'login.*(?:fail|invalid)|auth.*(?:fail|reject)|incorrect password',line,re.I))))
            digest=hashlib.sha256(auth_lines.encode()).hexdigest()
            with db() as c:
                put(c,'router_received_at',time.time());put(c,'router_error',None)
                put(c,'router_excerpt',excerpt)
                put(c,'router_summary',{'archive':name,'bytes':len(raw),'auth_failure_mentions':failures,'firmware_error_mentions':faults,'delivery':'Periodic SMTP export; event times may precede receipt.'})
                if failures>=5:event(c,time.time(),'Archer log export','router_auth_review','warning',f'Export contains {failures} authentication-failure mentions; overlapping snapshots may repeat older events. Review archive.','router-auth-'+digest)
                if faults:event(c,time.time(),'Archer log export','hardware_fault','warning','Export mentions firmware/upgrade errors. Receipt time is not the event time. Review archive.','router-fault-'+hashlib.sha256('\n'.join(sorted(set(line for line in text.splitlines() if re.search(r'(?:firmware|upgrade).*(?:fail|error)',line,re.I)))).encode()).hexdigest())
            prune_mail()
            print('Router log received: '+name+' bytes='+str(len(raw)),flush=True)
            return '250 Log archived locally'
        except Exception as exc:
            print('Router log archival failed: '+type(exc).__name__,flush=True)
            return '451 Local archival failure; retry later'


def serve_mail():
    import asyncio
    import ssl
    from aiosmtpd.smtp import SMTP
    async def run():
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(str(STATE/'router-tls.crt'),str(STATE/'router-tls.key'))
        server=await asyncio.get_running_loop().create_server(lambda:SMTP(RouterMail(),data_size_limit=8*1024**2,timeout=30,command_call_limit=100,auth_exclude_mechanism=['LOGIN','PLAIN']),os.environ.get('PI_LOG_BIND','192.168.0.56'),465,ssl=context)
        print('LAN-only router log receiver ready',flush=True)
        async with server:await server.serve_forever()
    asyncio.run(run())


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['collect','smtp','snapshot','once']);args=parser.parse_args()
    if args.mode=='snapshot': print(json.dumps(snapshot()))
    elif args.mode=='smtp':serve_mail()
    elif args.mode=='once':collect_once()
    else:
        while True:
            try:collect_once()
            except Exception as exc:print('Collector failure: '+type(exc).__name__,flush=True)
            time.sleep(30)
