# METR design adaptation

Reference supplied by the owner: `/Users/mac/stems/public/metr/index.html`,
`assets/`, `asset-manifest.json`, and research/screenshots in
`/Users/mac/stems/docs/{research,design-references}/metr.org/`.

The reference integration specification describes its own iframe wrapper. For
this task, the owner explicitly requested customized native components, so that
wrapper was not used. Reference content, dataset, partner logos, newsletter,
translation and third-party scripts were not copied into the dashboard.

## Translation to the Pi

- Instrument Sans variable font copied locally with its SHA-256 provenance.
- White canvas, ink #222a34, body #4d5561, accent #589885, fine gray rules.
- 1200px content width; two-column introduction and green feature panels.
- Existing reference wave SVG used on storage/private-access feature panels.
- Shrinking desktop header (90px to 64px); green mobile navigation overlay.
- Native button-based service filters and expandable service cards.
- Live SVG telemetry retained, including breaks across missing samples.
- Native service, access, network and test pages use existing API contracts.
- File Browser stays embedded, with storage-health gating and a separate link.

The original scientific chart data and automatic log/linear switching are not
appropriate to CPU/temperature telemetry and are not included. Graphs retain
their real units and existing 24-hour window.

## Validation

18 tests passed across the METR, Files and Observability suites. A production
build passed with no compile errors. Native JavaScript is 63.13 kB gzipped,
versus 221.00 kB for the prior entrypoint (about 71% smaller).

Browser checks used the production build and the Pi’s live LAN API: desktop
1440px and mobile 390px; mobile menu, Escape/focus behavior, service search,
Nostr service logs, protected controls, private devices, interfaces/routes and
recorded tests. Checked real chart values, spacing, document scrolling and no
horizontal overflow. The legacy root overflow restriction was removed.

Fixture tests exercise failures and denied mutations; no service mutation or
file upload/deletion was performed by the visual verification.

## Deployment verification

Deployed to `/opt/pi-console/releases/20260915-metr-web`. Previous release
`20260913-observability-v3` is retained. Only the two dashboard processes were
restarted; no router, storage or application service settings were changed.

The actual LAN dashboard rendered the File Browser listing inside the files
page at desktop and phone sizes. The localhost preview frame remained blank,
so embedding was verified using the deployed LAN origin instead. Live remote
checks through a separate temporary owner-account Tailscale peer passed for
dashboard HTML, overview, storage, VPN, logs, file listing and telemetry. The
temporary peer was removed. This was not a test from the owner's cellular phone.

The latest 18-test result is added to the live Tests page. `tests/run_checks.py`
now includes `test:metr` in subsequent complete validation runs. The full legacy
SPR/Island suite was not rerun for this redesign; targeted tests and production
build were run.


## September 15 designer refresh

Shared Brand components restore the reference mark, Instrument Sans, editorial spacing, illustrated green cards, responsive navigation and landscape footer. Assets are copied locally from `/Users/mac/stems/public/metr/assets/`; content is adapted to Matt's Pi. Research content and partner marks are not reused.

SystemInstruments uses the two owner-supplied September 15 PNGs as unchanged decorative frame plates. React SVG overlays replace sample numbers, gauge fills, I/O bars and status lamps with live values. Desktop and mobile have independent coordinates and a 700px breakpoint. Missing readings show a dash; unreported lamps remain unlit. Network display combines RX+TX bytes per second; the caption retains separate bit rates. Existing access gates and API isolation are unchanged.

Instrument numerals use Rajdhani Bold from the official Google Fonts repository, licensed under SIL OFL. Font and license are vendored in frontend/src/pi/metr-assets/.
https://github.com/google/fonts/tree/main/ofl/rajdhani

The supplied artwork preserves the physical frame and grain; dynamic typography/icons and geometry are native approximations, not a claim of pixel-identical vector reconstruction.
