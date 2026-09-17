"""Pi equivalents of upstream runner/code/auth.js and features.js, plus the
SSH adapter's safety and failure cases. All mutation tests use a fake runner.
"""
import http.client
import json
import pathlib
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'server'))
from api_server import Adapter, CATALOG, SSHRunner, make_server, redact


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        def runner(argv):
            self.calls.append(argv)
            return json.dumps({'units': {}, 'hostname': 'fixture-pi'})
        self.adapter = Adapter(runner)

    def test_catalog_and_cached_read(self):
        first = self.adapter.collect()
        self.assertEqual(len(first['services']), 28)
        self.assertTrue(first['read_only'])
        self.assertIs(first, self.adapter.collect())
        self.assertEqual(len(self.calls), 1)
        self.adapter.collect(force=True)
        self.assertEqual(len(self.calls), 2)

    def test_preview_rejects_all_mutations_without_ssh(self):
        for verb in ['start', 'stop', 'restart']:
            with self.assertRaises(PermissionError):
                self.adapter.action('nostr', verb)
        with self.assertRaises(PermissionError):
            self.adapter.register('hskey-authreq-example123456')
        self.assertEqual(self.calls, [])

    def test_protected_connectivity_services(self):
        self.adapter.allow_control = True
        for item in CATALOG:
            if item['protected'] and item['unit']:
                with self.assertRaises(PermissionError):
                    self.adapter.action(item['id'], 'stop')
        self.assertEqual(self.calls, [])

    def test_allowlisted_argv_and_cache_invalidation(self):
        self.adapter.allow_control = True
        self.adapter.snapshot_time = 42
        from unittest.mock import patch
        with patch.object(self.adapter, 'control') as control:
            self.adapter.action('nostr', 'restart')
            control.assert_called_once_with({'service':'nostr','action':'restart'})
        self.assertEqual(self.calls, [])
        self.assertEqual(self.adapter.snapshot_time, 0)

    def test_injection_and_unknown_services_never_reach_ssh(self):
        self.adapter.allow_control = True
        for service, action in [('nostr; touch /tmp/bad', 'stop'), ('nostr', 'restart; id'), ('unknown', 'start')]:
            with self.assertRaises(ValueError):
                self.adapter.action(service, action)
        for auth_id in ['hskey-authreq-short', 'hskey-authreq-example123456; id', None, []]:
            with self.assertRaises(ValueError):
                self.adapter.register(auth_id)
        self.assertEqual(self.calls, [])

    def test_log_redaction(self):
        secret_log = 'password=sample-secret token=token-value Bearer bearer-value hskey-authreq-example123456\n-----BEGIN PRIVATE KEY-----\nkey-body\n-----END PRIVATE KEY-----'
        self.adapter.runner = lambda argv: secret_log
        result = self.adapter.logs('nostr')['text']
        for secret in ['sample-secret', 'token-value', 'bearer-value', 'example123456', 'key-body']:
            self.assertNotIn(secret, result)
        self.assertIn('redacted', result)

    def test_unknown_log_service(self):
        with self.assertRaises(ValueError):
            self.adapter.logs('not-installed')
        self.assertEqual(self.calls, [])

    def test_standard_ssh_uses_quoted_command_and_batch_auth(self):
        with patch.dict('os.environ', {'PI_CONSOLE_SSH_TARGET': 'pi-alias'}), patch('api_server.subprocess.run') as run:
            run.return_value.returncode = 0
            run.return_value.stdout = 'ok\n'
            self.assertEqual(SSHRunner()(['python3', '-c', 'print("hello")']), 'ok')
            argv = run.call_args.args[0]
            self.assertEqual(argv[:3], ['ssh', '-o', 'BatchMode=yes'])
            self.assertEqual(argv[-2], 'pi-alias')
            self.assertEqual(argv[-1], 'python3 -c \'print("hello")\'')

    def test_ssh_failure_is_redacted(self):
        with patch.dict('os.environ', {'PI_CONSOLE_SSH_TARGET': 'pi-alias'}), patch('api_server.subprocess.run') as run:
            run.return_value.returncode = 1
            run.return_value.stderr = 'password=sample-secret connection failed'
            with self.assertRaisesRegex(RuntimeError, 'redacted') as exc:
                SSHRunner()(['true'])
            self.assertNotIn('sample-secret', str(exc.exception))


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.adapter = Adapter(lambda argv: json.dumps({'units': {}, 'hostname': 'fixture-pi'}))
        cls.server = make_server(0, cls.adapter)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def get(self, path, headers=None, body=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        conn.request('POST' if body is not None else 'GET', path, body=body, headers=headers or {})
        response = conn.getresponse()
        data = response.read()
        result = response.status, dict(response.getheaders()), data
        conn.close()
        return result

    def session(self):
        status, headers, body = self.get('/pi-api/session')
        self.assertEqual(status, 200)
        return {'Cookie': headers['Set-Cookie'].split(';')[0], 'X-Pi-CSRF': json.loads(body)['csrf'], 'Content-Type': 'application/json'}

    def test_observability_requires_session_and_no_cache(self):
        self.assertEqual(self.get('/pi-api/observability')[0],401)
        with patch.object(self.adapter,'observability',return_value={'available':False,'samples':[],'events':[]}):
            status,headers,body=self.get('/pi-api/observability',self.session())
            self.assertEqual(status,200)
            self.assertFalse(json.loads(body)['available'])
            self.assertEqual(headers['Cache-Control'],'no-store')

    def test_upstream_auth_contract(self):
        self.assertEqual(self.get('/pi-api/status')[0], 401)
        status, headers, body = self.get('/pi-api/status', self.session())
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)['read_only'])
        self.assertEqual(headers['Cache-Control'], 'no-store')

    def test_upstream_features_adapted_to_standalone_catalog(self):
        status, _, body = self.get('/pi-api/overview', self.session())
        result = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(len({s['id'] for s in result['services']}), 28)
        self.assertNotIn('firewall', result)

    def test_cookie_restrictions(self):
        _, headers, _ = self.get('/pi-api/session')
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', headers['Set-Cookie'])
        self.assertEqual(self.get('/pi-api/status', {'Cookie': 'pi_session=wrong'})[0], 401)

    def test_foreign_origin_and_dns_rebinding_rejected(self):
        for headers in [{'Host': 'evil.example'}, {'Origin': 'https://evil.example'}, {'Sec-Fetch-Site': 'cross-site'}, {'Sec-Fetch-Site': 'same-site'}, {'Host': 'user@localhost'}]:
            self.assertEqual(self.get('/pi-api/session', headers)[0], 403)

    def test_missing_csrf_and_preview_control(self):
        headers = self.session()
        self.assertEqual(self.get('/pi-api/services/nostr/restart', headers, '{}')[0], 403)
        headers.pop('X-Pi-CSRF')
        self.assertEqual(self.get('/pi-api/services/nostr/restart', headers, '{}')[0], 403)

    def test_invalid_input(self):
        headers = self.session()
        self.assertEqual(self.get('/pi-api/vpn/register', headers, '{bad')[0], 400)
        self.assertEqual(self.get('/pi-api/vpn/register', headers, '[]')[0], 400)
        self.assertEqual(self.get('/pi-api/vpn/register', headers, ' ' * 4097)[0], 413)
        headers['Content-Type'] = 'text/plain'
        self.assertEqual(self.get('/pi-api/vpn/register', headers, '{}')[0], 415)

    def test_missing_endpoints_and_path_traversal(self):
        self.assertEqual(self.get('/pi-api/unknown', self.session())[0], 404)
        self.assertEqual(self.get('/%2e%2e/server/catalog.json')[0], 403)
        self.assertEqual(self.get('/missing.js')[0], 404)

    def test_remote_failure_is_disconnected_and_redacted(self):
        old_runner = self.adapter.runner
        old_snapshot = self.adapter.snapshot
        def fail(argv):
            raise RuntimeError('SSH failed password=do-not-show')
        try:
            self.adapter.runner = fail
            self.adapter.snapshot = None
            status, _, body = self.get('/pi-api/overview', self.session())
            self.assertEqual(status, 502)
            self.assertFalse(json.loads(body)['connected'])
            self.assertNotIn(b'do-not-show', body)
        finally:
            self.adapter.runner = old_runner
            self.adapter.snapshot = old_snapshot


if __name__ == '__main__':
    unittest.main(verbosity=2)

class DeploymentTests(unittest.TestCase):
    def test_local_runner_reads_journal_without_sudo(self):
        from api_server import LocalRunner
        with patch('api_server.subprocess.run') as run:
            run.return_value.returncode = 0
            run.return_value.stdout = 'entry\n'
            self.assertEqual(LocalRunner()(['sudo', 'journalctl', '-n', '5']), 'entry')
            self.assertEqual(run.call_args.args[0], ['journalctl', '-n', '5'])

    def test_remote_host_requires_explicit_deployment(self):
        with patch.dict('os.environ', {'PI_CONSOLE_LOCAL':'1', 'PI_CONSOLE_PUBLIC_HOST':'100.64.0.1'}):
            adapter = Adapter(lambda argv: json.dumps({'units':{},'hostname':'pi'}))
            server = make_server(0, adapter)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                def status(headers):
                    c = http.client.HTTPConnection('127.0.0.1', server.server_port)
                    c.request('GET','/pi-api/session',headers=headers)
                    r=c.getresponse(); result=r.status; r.read(); c.close(); return result
                self.assertEqual(status({'Host':'100.64.0.1'}),200)
                self.assertEqual(status({'Host':'evil.example'}),403)
                self.assertEqual(status({'Host':'100.64.0.1','Origin':'http://evil.example'}),403)
                self.assertEqual(status({'Host':'100.64.0.1','Sec-Fetch-Site':'cross-site'}),403)
                adapter.deployed=False
                self.assertEqual(status({'Host':'100.64.0.1'}),403)
            finally:
                server.shutdown(); server.server_close(); thread.join()
