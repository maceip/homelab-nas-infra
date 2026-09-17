import hashlib,http.client,json,os,sys,tempfile,threading,unittest
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
import public_server as p
import upload_server as u
import telemetry as t

class HTTPFixture(unittest.TestCase):
 def start(self,handler):
  self.server=ThreadingHTTPServer(('127.0.0.1',0),handler)
  self.worker=threading.Thread(target=self.server.serve_forever,daemon=True);self.worker.start()
 def tearDown(self):self.server.shutdown();self.server.server_close();self.worker.join()
 def request(self,method,path,body=None,headers=None):
  c=http.client.HTTPConnection(*self.server.server_address,timeout=3);c.request(method,path,body,headers or {});r=c.getresponse();code=r.status;data=r.read();c.close();return code,data

class PublicBoundaryTests(HTTPFixture):
 def setUp(self):self.start(p.Handler)
 def test_no_private_endpoint_or_directory_fallback(self):
  for path in ['/pi-api/overview','/pi-api/settings','/pi-api/observability','/pi-api/services/nostr/logs','/files/','/api/resources/','/admin/settings','/../../etc/passwd','/%2e%2e/etc/passwd','/home/pi/.ssh/id_rsa']:
   self.assertIn(self.request('GET',path)[0],(403,404),path)
 def test_share_metadata_and_image_support_get_and_head(self):
  for path in ['/', '/social/gateway-card-v1.png']:
   responses={}
   for method in ['GET','HEAD']:
    c=http.client.HTTPConnection(*self.server.server_address,timeout=3)
    c.request(method,path);response=c.getresponse()
    responses[method]=(response.status,dict(response.getheaders()),response.read());c.close()
   self.assertEqual(responses['HEAD'][0],200)
   self.assertEqual(responses['HEAD'][2],b'')
   self.assertEqual(responses['HEAD'][1]['Content-Length'],str(len(responses['GET'][2])))
   self.assertEqual(responses['HEAD'][1]['Content-Type'],responses['GET'][1]['Content-Type'])
  html=self.request('GET','/')[1].decode()
  self.assertIn('<title>Matt\'s Gateway to America</title>',html)
  self.assertIn('property="og:image"',html)
  for path in ['/files/','/pi-api/settings','/../../etc/passwd']:
   self.assertIn(self.request('HEAD',path)[0],(403,404))
 def test_forged_headers_never_grant_tailnet_mode(self):
  code,body=self.request('GET','/pi-api/session',headers={'Tailscale-User-Login':'owner','X-Pi-Access':'tailnet','X-Forwarded-For':'100.64.0.4'})
  self.assertEqual(code,200);self.assertEqual(json.loads(body)['access_mode'],'public')
 def test_public_cannot_mutate(self):
  for path in ['/pi-api/settings','/pi-api/services/nostr/stop','/drop/upload']:
   self.assertEqual(self.request('POST',path,b'{}')[0],403)

class UploadTests(HTTPFixture):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.patches=[patch.object(u,'ROOT',Path(self.tmp.name)),patch.object(u,'SECRET','fixture-secret'),patch.object(u,'MAX_SIZE',10),patch.object(u,'MAX_TOTAL',20)]
  for item in self.patches:item.start()
  self.start(u.Handler)
 def tearDown(self):
  super().tearDown()
  for item in self.patches:item.stop()
  self.tmp.cleanup()
 def headers(self,**extra):return {'Origin':u.ORIGIN,'Content-Type':'application/octet-stream','X-Pi-Upload-Gateway':'fixture-secret','X-Real-IP':'198.51.100.4','X-File-Name':'../../escaped',**extra}
 def test_fixed_design_assets_require_gateway_and_never_expose_directories(self):
  for path in ['/drop/','/drop/style.css','/drop/upload.js','/drop/mark.svg','/drop/instrument.woff2']:
   self.assertEqual(self.request('GET',path,headers=self.headers())[0],200)
   self.assertEqual(self.request('GET',path)[0],403)
  for path in ['/drop/../server/upload_server.py','/drop/inbox.sqlite','/drop/']:
   if path!='/drop/':self.assertEqual(self.request('GET',path,headers=self.headers())[0],404)
 def test_exact_limit_opaque_storage_and_no_download(self):
  code,body=self.request('POST','/drop/upload',b'1234567890',self.headers());self.assertEqual(code,201)
  uid=json.loads(body)['receipt'];self.assertEqual((u.ROOT/(uid+'.upload')).read_bytes(),b'1234567890')
  self.assertFalse((u.ROOT/'escaped').exists())
  self.assertEqual(self.request('GET','/drop/'+uid,headers=self.headers())[0],404)
 def test_oversize_no_gateway_and_cross_origin_are_rejected(self):
  self.assertEqual(self.request('POST','/drop/upload',b'12345678901',self.headers())[0],413)
  self.assertEqual(self.request('POST','/drop/upload',b'x',{})[0],403)
  self.assertEqual(self.request('POST','/drop/upload',b'x',self.headers(Origin='https://evil.example'))[0],403)
  self.assertFalse(list(u.ROOT.glob('*.upload')))
 def test_global_quota_and_rate_are_enforced(self):
  for _ in range(2):self.assertEqual(self.request('POST','/drop/upload',b'1234567890',self.headers())[0],201)
  self.assertEqual(self.request('POST','/drop/upload',b'x',self.headers())[0],429)
  with patch.object(u,'HOURLY_LIMIT',1):self.assertEqual(self.request('POST','/drop/upload',b'x',self.headers())[0],429)
 def test_disconnect_after_commit_still_counts_toward_quota(self):
  original=u.Handler.send
  def disconnected(handler,status,*args,**kwargs):
   if status in (201,408):raise BrokenPipeError()
   return original(handler,status,*args,**kwargs)
  with patch.object(u.Handler,'send',disconnected):
   with self.assertRaises(http.client.RemoteDisconnected):self.request('POST','/drop/upload',b'1234567890',self.headers())
  with u.database() as c:
   row=c.execute('SELECT id,state,size FROM uploads').fetchone()
  self.assertEqual(row[1:],('complete',10));self.assertEqual((u.ROOT/(row[0]+'.upload')).stat().st_size,10)
  with patch.object(u,'MAX_TOTAL',10):self.assertEqual(self.request('POST','/drop/upload',b'x',self.headers())[0],429)
 def test_chunked_not_accepted(self):
  self.assertEqual(self.request('POST','/drop/upload',b'x',self.headers(**{'Transfer-Encoding':'chunked'}))[0],411)

class CoverageTests(unittest.TestCase):
 def test_lan_denial_and_disk_timeout_captured(self):
  with tempfile.TemporaryDirectory() as directory,patch.object(t,'STATE',Path(directory)):
   with t.db() as c:
    t.classify(c,{'MESSAGE':'PI_ACCESS {"status":403}','_SYSTEMD_UNIT':'pi-console-lan.service','__CURSOR':'a'})
    t.classify(c,{'MESSAGE':'ata1.00: qc timeout after 5000 msecs','SYSLOG_IDENTIFIER':'kernel','__CURSOR':'b'})
   counts=t.snapshot()['counts'];self.assertEqual(counts['dashboard_denial'],1);self.assertEqual(counts['hardware_fault'],1)
 def test_file_audit_is_recorded_without_filename(self):
  with tempfile.TemporaryDirectory() as directory,patch.object(t,'STATE',Path(directory)):
   with t.db() as c:t.classify(c,{'MESSAGE':'owner|192.168.0.5|private-file','SYSLOG_IDENTIFIER':'smbd_audit','__CURSOR':'a'})
   s=t.snapshot();self.assertEqual(s['counts']['smb_operation'],1);self.assertNotIn('private-file',json.dumps(s))

class GatewayThresholdTests(unittest.TestCase):
 def test_saved_web_threshold_controls_gateway_bursts(self):
  with tempfile.TemporaryDirectory() as directory,patch.object(t,'STATE',Path(directory)),patch.object(t,'settings',return_value={'web_probe_threshold':20}):
   with t.db() as c:
    for i in range(19):t.classify(c,{'MESSAGE':json.dumps({'logger':'http.log.access.log0','status':403,'request':{'remote_ip':'198.51.100.8'}}),'_SYSTEMD_UNIT':'pi-gateway.service','__CURSOR':str(i)})
    self.assertEqual(c.execute("SELECT count(*) FROM events WHERE kind='gateway_denial_burst'").fetchone()[0],0)
    t.classify(c,{'MESSAGE':json.dumps({'logger':'http.log.access.log0','status':403,'request':{'remote_ip':'198.51.100.8'}}),'_SYSTEMD_UNIT':'pi-gateway.service','__CURSOR':'20'})
    self.assertEqual(c.execute("SELECT count(*) FROM events WHERE kind='gateway_denial_burst'").fetchone()[0],1)
