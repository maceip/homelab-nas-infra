"""Private Unix-socket broker: fixed service IDs and verbs, no shell or arbitrary paths."""
import json,os,socketserver,subprocess
from pathlib import Path
CATALOG=json.loads((Path(__file__).parent/'catalog.json').read_text())
ALLOWED={s['id']:s['unit'] for s in CATALOG if s.get('unit') and not s.get('protected')}
class Handler(socketserver.StreamRequestHandler):
 def handle(self):
  self.connection.settimeout(20)
  try:
   raw=self.rfile.readline(2049)
   if len(raw)>2048:raise ValueError()
   data=json.loads(raw)
   if set(data)!={'service','action'} or data['service'] not in ALLOWED or data['action'] not in ('start','stop','restart'):raise ValueError()
   p=subprocess.run(['/usr/bin/systemctl',data['action'],ALLOWED[data['service']]],capture_output=True,timeout=15)
   if p.returncode:raise RuntimeError()
   print('PI_CONTROL '+json.dumps({'service':data['service'],'action':data['action'],'ok':True}),flush=True)
   self.wfile.write(b'{"ok":true}\n')
  except Exception:self.wfile.write(b'{"ok":false,"error":"Action rejected or unavailable."}\n')
if __name__=='__main__':
 path=Path('/run/pi-control/control.sock');path.unlink(missing_ok=True)
 server=socketserver.UnixStreamServer(str(path),Handler)
 os.chmod(path,0o660)
 server.serve_forever()
