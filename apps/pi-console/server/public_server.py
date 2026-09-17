"""Public read-only metrics and a build-time asset allowlist. No process execution."""
import json
import mimetypes
import hashlib
import re
from http_limits import BoundedHTTPServer, QuietHandler, PublicLimits, public_client
import os
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT/'frontend/build'
METRICS = Path(os.environ.get('PI_PUBLIC_METRICS', '/var/lib/pi-public/metrics.json'))
ASSETS = {'/'+str(p.relative_to(BUILD)): p for p in BUILD.rglob('*') if p.is_file() and not p.is_symlink()}
CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"

ETAGS={path:'\"'+hashlib.sha256(asset.read_bytes()).hexdigest()+'\"' for path,asset in ASSETS.items()}
LIMITS=PublicLimits()

class Handler(QuietHandler):
    def setup(self):
        super().setup(); self.connection.settimeout(5)
    def log_message(self, *args): pass
    def send(self,status,value,kind='application/json',cache='no-store',etag=None):
        body=json.dumps(value).encode() if kind=='application/json' else value
        if status==200 and self.command!='HEAD' and not LIMITS.allow(public_client(self),len(body),bandwidth=True):
            status,body,kind,cache,etag=429,b'{\"error\":\"Please retry shortly.\"}','application/json','no-store',None
        self.send_response(status)
        if status==429:self.send_header('Retry-After','5')
        if etag:self.send_header('ETag',etag)
        if status!=304:self.send_header('Content-Length',str(len(body)))
        for k,v in {'Content-Type':kind,'Cache-Control':cache,'Content-Security-Policy':CSP,'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}.items(): self.send_header(k,v)
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)
    def do_GET(self):
        if not LIMITS.allow(public_client(self)):return self.send(429,{'error':'Please retry shortly.'})
        path=urlsplit(self.path).path
        if path=='/pi-api/session': return self.send(200,{'access_mode':'public','read_only':True})
        if path=='/public-api/metrics':
            try: return self.send(200,json.loads(METRICS.read_text()))
            except (OSError,ValueError): return self.send(503,{'error':'Metrics temporarily unavailable.'})
        if path in ('/','/admin/home'): path='/index.html'
        if path.startswith(('/pi-api/','/files','/api/','/admin/')): return self.send(403,{'error':'Private access required.'})
        target=ASSETS.get(path)
        if not target: return self.send(404,{'error':'Not found.'})
        cache='public, max-age=31536000, immutable' if re.search(r'\.[0-9a-f]{8,}\.',path) else 'public, max-age=300' if target.suffix in ('.png','.webp','.svg','.woff2','.ico') else 'no-cache'
        etag=ETAGS[path]
        if self.headers.get('If-None-Match')==etag:return self.send(304,b'','application/octet-stream',cache,etag)
        try: return self.send(200,target.read_bytes(),mimetypes.guess_type(target.name)[0] or 'application/octet-stream',cache,etag)
        except OSError: return self.send(503,{'error':'Temporarily unavailable.'})
    def do_HEAD(self): self.do_GET()
    def do_POST(self): self.send(403,{'error':'Public dashboard is read-only. Use the protected upload inbox.'})
    do_PUT=do_POST
    do_DELETE=do_POST

if __name__=='__main__':
    server=BoundedHTTPServer((os.environ.get('PI_PUBLIC_BIND','127.0.0.1'),int(os.environ.get('PI_PUBLIC_PORT','19110'))),Handler)
    server.daemon_threads=True
    server.serve_forever()
