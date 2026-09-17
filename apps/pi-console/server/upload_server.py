"""Write-only public inbox behind Anubis. Never serves uploaded content."""
import hashlib
from http_limits import QuietHandler, BoundedHTTPServer
import hmac
import ipaddress
import json
import os
from pathlib import Path
import secrets
import sys
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,unquote

ROOT=Path(os.environ.get('PI_UPLOAD_DIR','/var/lib/pi-upload'))
WEB=Path(__file__).resolve().parents[1]/'upload-web'
MAX_SIZE=50_000_000
MAX_TOTAL=2_000_000_000
HOURLY_LIMIT=10
RETENTION=7*86400
LOCK=threading.Lock()
SLOTS=threading.BoundedSemaphore(2)
ORIGIN='https://matts.public.computer'
SECRET=os.environ.get('PI_UPLOAD_GATEWAY','')

def database():
    ROOT.mkdir(mode=0o700,parents=True,exist_ok=True)
    c=sqlite3.connect(ROOT/'inbox.sqlite',timeout=5)
    c.execute('CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, client TEXT, ts REAL, size INTEGER, name TEXT, state TEXT, digest TEXT)')
    return c

def reserve(client,name,size):
    with LOCK,database() as c:
        now=time.time()
        # Fixed opaque IDs are the only filesystem paths; supplied names are metadata.
        for uid, in c.execute('SELECT id FROM uploads WHERE ts<?',(now-RETENTION,)).fetchall():
            for suffix in ('.upload','.part'):(ROOT/(uid+suffix)).unlink(missing_ok=True)
            c.execute('DELETE FROM uploads WHERE id=?',(uid,))
        if c.execute('SELECT count(*) FROM uploads WHERE client=? AND ts>?',(client,now-3600)).fetchone()[0]>=HOURLY_LIMIT:
            raise ValueError('Upload rate limit reached. Try again in an hour.')
        total=c.execute("SELECT coalesce(sum(size),0) FROM uploads WHERE state IN ('pending','complete')").fetchone()[0]
        if total+size>MAX_TOTAL: raise ValueError('The upload inbox is full. Please try later.')
        uid=secrets.token_hex(16)
        c.execute('INSERT INTO uploads VALUES(?,?,?,?,?,?,?)',(uid,client,now,size,name,'pending',None))
        return uid

class Handler(QuietHandler):
    def setup(self):
        super().setup();self.connection.settimeout(30)
    def log_message(self,*args):pass
    def send(self,status,value,kind='application/json'):
        data=json.dumps(value).encode() if kind=='application/json' else value
        self.send_response(status)
        headers={'Content-Type':kind,'Content-Length':str(len(data)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}
        for k,v in headers.items():self.send_header(k,v)
        self.end_headers();self.wfile.write(data)
    def authorized(self):
        return bool(SECRET) and hmac.compare_digest(self.headers.get('X-Pi-Upload-Gateway',''),SECRET)
    def do_GET(self):
        if not self.authorized():return self.send(403,{'error':'Protected gateway required.'})
        path=urlsplit(self.path).path
        assets={'/drop/':'index.html','/drop/upload.js':'upload.js','/drop/style.css':'style.css','/drop/mark.svg':'mark.svg','/drop/instrument.woff2':'instrument.woff2'}
        if path not in assets:return self.send(404,{'error':'No public file listing or downloads.'})
        name=assets[path];kind={'html':'text/html; charset=utf-8','js':'application/javascript','css':'text/css','svg':'image/svg+xml','woff2':'font/woff2'}[name.rsplit('.',1)[1]]
        return self.send(200,(WEB/name).read_bytes(),kind)
    def do_POST(self):
        if not self.authorized():return self.send(403,{'error':'Protected gateway required.'})
        if urlsplit(self.path).path!='/drop/upload':return self.send(404,{'error':'Unknown endpoint.'})
        if self.headers.get('Origin')!=ORIGIN or self.headers.get('Sec-Fetch-Site')=='cross-site':return self.send(403,{'error':'Open the upload page first.'})
        if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length',[]))!=1:return self.send(411,{'error':'An explicit file size is required.'})
        try:size=int(self.headers['Content-Length'])
        except (ValueError,TypeError):return self.send(400,{'error':'Invalid file size.'})
        if not 0<size<=MAX_SIZE:return self.send(413,{'error':'Choose a file between 1 byte and 50 MB (50,000,000 bytes).'})
        if self.headers.get('Content-Type')!='application/octet-stream':return self.send(415,{'error':'Binary file content required.'})
        try:source=str(ipaddress.ip_address(self.headers.get('X-Real-IP','')))
        except ValueError:return self.send(403,{'error':'Verified source address required.'})
        client=hashlib.sha256((SECRET+source).encode()).hexdigest()
        name=unquote(self.headers.get('X-File-Name','file'))[:180]
        name=''.join(ch for ch in name if ch.isprintable())
        if not SLOTS.acquire(False):return self.send(429,{'error':'Inbox busy. Please retry shortly.'})
        uid=None;committed=False
        try:
            try:uid=reserve(client,name,size)
            except ValueError as exc:return self.send(429,{'error':str(exc)})
            remaining=size;start=time.monotonic();digest=hashlib.sha256()
            path=ROOT/(uid+'.part')
            with path.open('xb') as f:
                while remaining:
                    if time.monotonic()-start>120:raise TimeoutError()
                    block=self.rfile.read(min(65536,remaining))
                    if not block:raise ConnectionError()
                    f.write(block);digest.update(block);remaining-=len(block)
                f.flush();os.fsync(f.fileno())
            path.rename(ROOT/(uid+'.upload'))
            with database() as c:c.execute('UPDATE uploads SET state=?,digest=? WHERE id=?',('complete',digest.hexdigest(),uid))
            committed=True
            print('PI_UPLOAD '+json.dumps({'status':'accepted','bytes':size,'receipt':uid}),flush=True)
            return self.send(201,{'receipt':uid,'bytes':size,'message':'File received in the private inbox.'})
        except (OSError,TimeoutError,ConnectionError,sqlite3.Error):
            if uid and not committed:
                for suffix in ('.part','.upload'):(ROOT/(uid+suffix)).unlink(missing_ok=True)
                with database() as c:c.execute('UPDATE uploads SET state=? WHERE id=?',('failed',uid))
            try:self.send(408,{'error':'Upload interrupted. Please retry.'})
            except OSError:pass
        finally:SLOTS.release()
    def do_PUT(self):self.send(405,{'error':'Method not allowed.'})
    do_DELETE=do_PUT

if __name__=='__main__':
    os.umask(0o027)
    if '--cleanup' in sys.argv:
        with database() as c:
            for uid, in c.execute('SELECT id FROM uploads WHERE ts<?',(time.time()-RETENTION,)).fetchall():
                for suffix in ('.upload','.part'):(ROOT/(uid+suffix)).unlink(missing_ok=True)
                c.execute('DELETE FROM uploads WHERE id=?',(uid,))
        raise SystemExit(0)
    # Incomplete reservations from a prior process cannot consume capacity forever.
    with database() as c:
        for uid, in c.execute("SELECT id FROM uploads WHERE state='pending'"):
            for suffix in ('.part','.upload'):(ROOT/(uid+suffix)).unlink(missing_ok=True)
        c.execute("UPDATE uploads SET state='failed' WHERE state='pending'")
    server=BoundedHTTPServer(('127.0.0.1',19112),Handler);server.daemon_threads=True;server.serve_forever()
