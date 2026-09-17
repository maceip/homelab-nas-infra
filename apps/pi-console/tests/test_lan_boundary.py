import sys, unittest, ipaddress
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from api_server import Handler
class LANBoundaryTests(unittest.TestCase):
    def check(self, source, networks=(), deployed=True, **headers):
        h=object.__new__(Handler)
        h.client_address=(source,12345)
        h.headers={'Host':'192.168.0.56', **headers}
        h.server=SimpleNamespace(adapter=SimpleNamespace(deployed=deployed),allowed_networks=tuple(ipaddress.ip_network(n) for n in networks))
        with patch.dict('os.environ',{'PI_CONSOLE_PUBLIC_HOST':'192.168.0.56'}):
            return h.boundary()
    def test_lan_requires_explicit_network(self):
        self.assertFalse(self.check('192.168.0.20'))
        self.assertTrue(self.check('192.168.0.20',['192.168.0.0/24']))
        self.assertFalse(self.check('192.168.0.20',['192.168.0.0/24'],False))
    def test_other_networks_denied(self):
        for source in ['198.51.100.8','192.168.1.8','100.64.0.4','::ffff:192.168.0.20']:
            self.assertFalse(self.check(source,['192.168.0.0/24']))
    def test_browser_boundary_preserved(self):
        for headers in [{'Host':'evil.example'},{'Origin':'http://evil.example'},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}]:
            self.assertFalse(self.check('192.168.0.20',['192.168.0.0/24'],**headers))
    def test_loopback_preserved(self):
        self.assertTrue(self.check('127.0.0.1'))
if __name__=='__main__': unittest.main()
