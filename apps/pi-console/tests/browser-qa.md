# Browser verification — September 11, 2026

Verified against the final production build served by the local adapter in the
Codex in-app browser. These are observed manual checks, separate from automated
assertions in `results.json`.

- Overview: connected to the actual Pi; 28 software groups, 17 active units,
  memory, system-disk capacity and temperature rendered. Setup work is listed
  separately from process status.
- Services: all 28 rows render; searching for Nostr reduces the list to its one
  matching entry. Its detail page shows the recorded setup notes and disabled
  start/stop/restart controls.
- Private access: actual Pi and Android phone both displayed online. Enrollment
  controls remain disabled.
- Network: actual wired and wireless interfaces and their default-route metrics
  displayed; no editable router controls.
- Tests: 275 upstream frontend assertions, 14 Pi frontend assertions and 17
  adapter tests shown as passed, together with build and live SSH results. The
  original Docker/Wi-Fi suite is explicitly marked not applicable.
- Settings: Default Light, Default Dark and Editorial render correctly. Theme
  selection survives page reload. Advanced View hides/restores Network and Tests.
- Responsive check at 390 × 844: navigation opens, selecting a destination closes
  it, service filters and cards wrap, and the peer list remains readable. Browser
  viewport override reset afterward; Default Light and Overview restored.
- Reload after local adapter restart reestablished the session and live data.
  Browser error log was empty during final search verification.
- A correctly authenticated request to restart Nostr returned HTTP 403 in the
  running preview, before any SSH action. Adapter mutation-path tests use fake
  runners. No live service start/stop/restart was performed.

Known build output: upstream dependency source-map and deprecation warnings are
retained in the local build log. The production build succeeds. Original 42
frontend test files were compared byte-for-byte with the pinned upstream source
and are unchanged. This session did not test actual phone browsers, cellular
roaming, or application protocols behind every service.

The delivered browser tab stays on the overview. The temporary source-transfer
HTTP server was stopped; only the loopback dashboard listener is needed.
