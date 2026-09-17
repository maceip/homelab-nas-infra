import http.client,sys,threading,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
import public_server as p
from http_limits import PublicLimits,BoundedHTTPServer,QuietHandler,public_client

class LimitsTests(unittest.TestCase):
 def test_rate_global_bandwidth_and_bounded_client_registry(self):
  limits=PublicLimits()
  limits.global_requests.rate=0;limits.global_requests.tokens=2
  self.assertTrue(limits.allow('one'));self.assertTrue(limits.allow('two'));self.assertFalse(limits.allow('three'))
  self.assertFalse(limits.allow('one',8_000_001,True))
  for i in range(4200):limits.allow(str(i))
  self.assertLessEqual(len(limits.clients),4096)
 def test_remote_clients_cannot_supply_proxy_identity(self):
  h=SimpleNamespace(client_address=('192.0.2.1',12),headers={'X-Pi-Client-IP':'198.51.100.1'})
  self.assertEqual(public_client(h),'192.0.2.1')
  h.client_address=('127.0.0.1',12);self.assertEqual(public_client(h),'198.51.100.1')
  h.headers['X-Pi-Client-IP']='spoof, invalid';self.assertEqual(public_client(h),'127.0.0.1')

class HTTPTests(unittest.TestCase):
 def setUp(self):
  self.limits=PublicLimits();self.patch=patch.object(p,'LIMITS',self.limits);self.patch.start()
  self.server=BoundedHTTPServer(('127.0.0.1',0),p.Handler,max_workers=2)
  self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
 def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.patch.stop()
 def get(self,path='/',headers=None):
  c=http.client.HTTPConnection(*self.server.server_address,timeout=3);c.request('GET',path,headers=headers or {})
  r=c.getresponse();result=(r.status,dict(r.getheaders()),r.read());c.close();return result
 def test_cache_conditional_requests_and_no_server_banner(self):
  code,headers,body=self.get();self.assertEqual(code,200);self.assertNotIn('Server',headers);self.assertEqual(headers['Cache-Control'],'no-cache')
  code,headers,body=self.get(headers={'If-None-Match':headers['ETag']});self.assertEqual(code,304);self.assertEqual(body,b'');self.assertNotIn('Content-Length',headers)
  path=next(path for path in p.ASSETS if path.startswith('/static/js/main.'))
  self.assertIn('immutable',self.get(path)[1]['Cache-Control'])
  self.assertEqual(self.get('/pi-api/session')[1]['Cache-Control'],'no-store')
 def test_rate_limit_returns_retry_and_recovers(self):
  self.limits.global_requests.tokens=0;self.limits.global_requests.rate=0
  status,headers,_=self.get();self.assertEqual(status,429);self.assertEqual(headers['Retry-After'],'5')
  self.limits.global_requests.tokens=1;self.assertEqual(self.get()[0],200)
 def test_bandwidth_budget_returns_429(self):
  self.limits.global_bytes.tokens=0;self.limits.global_bytes.rate=0
  self.assertEqual(self.get()[0],429)
 def test_worker_exhaustion_returns_bounded_503(self):
  self.server.slots.acquire();self.server.slots.acquire()
  try:self.assertEqual(self.get()[0],503)
  finally:self.server.slots.release();self.server.slots.release()
  self.assertEqual(self.get()[0],200)
