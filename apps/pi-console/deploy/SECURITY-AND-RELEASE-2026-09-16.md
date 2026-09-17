# Gateway dashboard and security verification — 2026-09-16

Release: `20260916-amber-lcd-v2`. Designer source revision: `51393b3a6eb892b7c94220b2e5791c88da663caa` from the owner-supplied updated ZIP. Native React components retain its bar profiles, tachometer geometry, seven-segment numerals, lamp strips, colors and proportional layout. Desktop dock is top 50dvh; mobile dock is bottom 50dvh. Real CPU, RAM, CPU temperature, NAS capacity/disk busy and network counters feed the display. Missing sensors remain unavailable. Public token counts are generated locally for the owner's joke metric, starting at 28 billion; visible simulation labels are omitted at the owner's request. Private defaults to real system mode.

## Security changes included in this source snapshot

- Separate localhost public read-only application, private administrative application, and constrained upload application. Public routing never serves arbitrary filesystem directories or private API paths.
- Per-client/global request and byte budgets; bounded client registry and worker concurrency; socket deadlines; CPU/memory service limits.
- Proxy client identity accepted only from loopback; Caddy overwrites untrusted public identity headers. Tailnet-like headers do not confer private access.
- Anubis proof-of-work in front of a write-only 50 MB inbox; two active uploads; hourly/quota/retention controls; opaque filenames; no public download route. Origin and gateway-secret checks remain in place.
- Non-root public metrics process reads fixed snapshots. Public HTTP handler has no shell execution. Private service controls use a fixed allowlist, CSRF and Origin checks.
- HSTS, CSP, MIME/referrer/frame protections; Server banners removed; content-addressed asset caching, conditional requests, gzip/zstd compression. Private file framing remains same-origin only.
- Production JS is minified with source maps disabled; dashboard images optimized; polling pauses when hidden and backs off on errors.
- WebMCP uploads and messages use the same protected upload path and require an actual receipt before reporting success. No prompt templates. Subscription support is an in-page temperature watch.

## Verification in this release

- Production build passed. Frontend suite: 49 tests across 9 suites passed.
- Backend suite: `python3 -m unittest discover -s tests -p 'test_*.py'`: 59 tests passed. Includes path/traversal and forged-header denial, private CSRF/Origin/action validation, upload boundaries and accounting, bounded concurrency, request/byte limits, cache and banner behavior, telemetry and log redaction.
- In-app Chromium browser exercised both desktop 1440x1000 and mobile 390x844; live readings populated; new LCD geometry present; simulation labels absent. Desktop top dock and mobile bottom dock each occupy half the viewport.
- Rollback-protected release deployed over private SSH. Public/private HTTPS checks are rerun after deployment. Live host security configuration is compared with committed templates without exposing credentials.

## Limits

Resource limits do not prevent saturation of the home's upstream connection. Device-bound session credentials are not implemented. Router/DNS configuration and upstream volumetric mitigation remain separate. No new real upload or love letter was sent during this release check. Third-party upstream test tokens are test-only placeholders; runtime credentials, logs, databases, local test output and generated build artifacts are excluded from Git.
