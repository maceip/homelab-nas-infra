"""Reproducible local validation; --live additionally reads the Pi over SSH.
Mutation assertions are always fake-runner tests, never live service actions.
"""
import argparse
import datetime
import json
import pathlib
import subprocess
import sys
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'server'))
from api_server import Adapter

parser = argparse.ArgumentParser()
parser.add_argument('--live', action='store_true')
args = parser.parse_args()
suites = []
failed = False
start = time.time()
(ROOT / 'tests/frontend-results.json').unlink(missing_ok=True)

def record(name, passed, detail):
    global failed
    failed |= not passed
    suites.append({'name': name, 'state': 'Passed' if passed else 'Failed', 'detail': detail})

with (ROOT / 'tests/frontend-test.log').open('w') as log:
    result = subprocess.run(['corepack', 'yarn', 'test', '--runInBand', '--json', '--outputFile=../tests/frontend-results.json'], cwd=ROOT / 'frontend', stdout=log, stderr=subprocess.STDOUT)
if (ROOT / 'tests/frontend-results.json').exists():
    report = json.loads((ROOT / 'tests/frontend-results.json').read_text())
    for name, pi in [('Original SPR frontend', False), ('Pi-specific frontend', True)]:
        matching = [s for s in report['testResults'] if ('/PiConsole.js' in s['name']) == pi]
        assertions = [a for s in matching for a in s['assertionResults']]
        good = bool(matching) and all(a['status'] == 'passed' for a in assertions) and all(s['status'] == 'passed' for s in matching)
        record(name, good, f"{sum(a['status'] == 'passed' for a in assertions)}/{len(assertions)} assertions passed in {len(matching)} suites. " + ('Adapted panes, navigation, filters, disabled controls and failure recovery.' if pi else 'Original tests run against their upstream fixtures; not live router tests.'))
else:
    record('Frontend tests', False, 'Jest did not produce a report; see frontend-test.log.')
failed |= result.returncode != 0

island_report = ROOT / 'tests/island-results.json'
island_report.unlink(missing_ok=True)
with (ROOT / 'tests/island-test.log').open('w') as log:
    result = subprocess.run(['corepack', 'yarn', 'test:island', '--json', '--outputFile=../tests/island-results.json'], cwd=ROOT / 'frontend', stdout=log, stderr=subprocess.STDOUT)
if island_report.exists():
    report = json.loads(island_report.read_text())
    record('Island design and glass fallback', result.returncode == 0 and report.get('success', False), f"{report['numPassedTests']}/{report['numTotalTests']} tests. Actual vendored web components, accessible metrics, navigation, stale/error states, reduced motion and experimental-renderer fallback. GPU optical output requires separate browser verification.")
else:
    record('Island design and glass fallback', False, 'No test report produced; see island-test.log.')

metr_report = ROOT / 'tests/metr-results.json'
metr_report.unlink(missing_ok=True)
with (ROOT / 'tests/metr-test.log').open('w') as log:
    result = subprocess.run(['corepack', 'yarn', 'test:metr', '--json', '--outputFile=../tests/metr-results.json'], cwd=ROOT / 'frontend', stdout=log, stderr=subprocess.STDOUT)
if metr_report.exists():
    report = json.loads(metr_report.read_text())
    record('METR native web dashboard', result.returncode == 0 and report.get('success', False), f"{report['numPassedTests']}/{report['numTotalTests']} tests: native navigation, service filters, protected controls, log escaping, storage gating and telemetry failure states. Fixture tests only.")
else:
    record('METR native web dashboard', False, 'No test report produced; see metr-test.log.')

with (ROOT / 'tests/adapter-test.log').open('w') as log:
    result = unittest.TextTestRunner(stream=log, verbosity=2).run(unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_*.py'))
record('Pi adapter and HTTP boundary', result.wasSuccessful(), f'{result.testsRun} tests: upstream auth/features contracts adapted to local sessions and service inventory, input validation, read-only controls, connectivity protection, secret redaction, SSH failures and bounded telemetry/archive handling. Fixture tests only.')

with (ROOT / 'tests/build.log').open('w') as log:
    result = subprocess.run(['corepack', 'yarn', 'build'], cwd=ROOT / 'frontend', stdout=log, stderr=subprocess.STDOUT)
record('Production frontend build', result.returncode == 0, 'Build uses the native METR Pi web entrypoint and existing Pi API. No SPR daemon is built or launched.')

if args.live:
    try:
        adapter = Adapter()
        snapshot = adapter.collect(force=True)
        vpn = adapter.vpn()
        logs = adapter.logs('nostr')
        assert snapshot['read_only'] and len(snapshot['services']) == 28
        assert snapshot['memory_total'] > 0 and snapshot['uptime'] > 0
        assert snapshot['storage']['healthy'] and snapshot['storage']['total'] > 0
        assert all(s['runtime'].get('LoadState') == 'loaded' for s in snapshot['services'] if s['unit'])
        assert isinstance(vpn['nodes'], list) and vpn['read_only']
        assert logs['service'] == 'nostr' and isinstance(logs['text'], str)
        count = sum(s['runtime'].get('ActiveState') == 'active' for s in snapshot['services'])
        record('Live Pi read-only connection', True, f'28 software groups, {count} active managed services, {len(vpn["nodes"])} registered Headscale nodes; system metrics, interfaces, routes and recent Nostr logs returned over SSH. No service actions executed.')
    except Exception as exc:
        record('Live Pi read-only connection', False, f'Read-only check failed ({type(exc).__name__}); inspect SSH connectivity.')
else:
    suites.append({'name': 'Live Pi read-only connection', 'state': 'Not run', 'detail': 'Run tests/run_checks.py --live to validate the SSH connection. No live results are inferred from fixtures.'})

suites.append({'name': 'Original Docker and Wi-Fi router integration', 'state': 'Not applicable', 'detail': 'Original source retained under upstream-tests/super. Requires SPR containers, virtual Wi-Fi clients, firewall and DHCP ownership; excluded from this standalone Pi dashboard. Not counted as passed.'})
report = {'state': 'Failed' if failed else 'Passed', 'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'duration_seconds': round(time.time()-start, 1), 'summary': 'Local dashboard checks only. Service health labels show process state; they do not prove every application is configured or usable.', 'suites': suites}
(ROOT / 'tests/results.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
sys.exit(1 if failed else 0)
