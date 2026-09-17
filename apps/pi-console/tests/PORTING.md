# Test provenance and coverage

Pinned upstream revision: see `../UPSTREAM_COMMIT`.

| Source | Treatment | What it proves |
| --- | --- | --- |
| Original `frontend/src/__tests__` (42 suites) | Copied unchanged, run with upstream Jest setup and fixtures | Regression coverage of the retained upstream source; not the Pi adapter or live SPR router |
| `PaneSmoke.js` and `Widgets.js` | Adapted in `PiConsole.js`, retaining real Gluestack/shared components | Pi screens, values, search/filter, navigation, logs, disabled actions, peer list, theme picker and error recovery |
| `tests/runner/code/test/auth.js` | Behavioral equivalent in `test_adapter.py::HTTPTests.test_upstream_auth_contract` | Anonymous status denied; local session can read status |
| `tests/runner/code/test/features.js` | Adapted to catalog/read-only capabilities in `test_upstream_features_adapted_to_standalone_catalog` | Standalone inventory instead of assumed SPR router features |
| New SSH/API tests | `test_adapter.py` | Fixed command allowlist, protected units, CSRF/origin, malformed input, path traversal, redaction and remote failures |
| Island UI and Liquid DOM | `frontend/tests/island.test.js`, separate DOM Jest configuration | Actual vendored components, live metric presentation, navigation, stale/error states, capability detection, reduced motion and async cleanup; not GPU optical correctness |
| Real Pi connection | Optional `run_checks.py --live` | Actual read-only SSH response for metrics, units, routes, Headscale peers and Nostr logs |
| Docker/simulated Wi-Fi suite | Original source retained under `../upstream-tests/super`, not executed | Requires the original SPR environment; no applicable result claimed |

The test runner records each category separately, and always marks the original
router integration suite as not applicable. It does not run setup/teardown
scripts that could change host networking. Live application protocol tests,
phone cellular roaming, and service restart validation are outside this local
dashboard test run.

Browser QA is recorded separately in `browser-qa.md`. Those manual observations
are not represented as automated Jest assertions.
