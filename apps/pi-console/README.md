# Matt’s Pi dashboard

Native React web interface for the Pi’s standalone services. The current design
uses the owner-supplied METR reference: Instrument Sans, a white canvas, muted
green feature panels, fine rules, restrained cards and an amber LCD instrument cluster from the owner-supplied dashboard template.
The cluster is fixed to the top half on desktop and the bottom half on mobile.
The METR website is not embedded. Only the existing File Browser is framed.

## Access

Use https://matts.public.computer. Public visitors receive read-only system
metrics and the Anubis-protected upload inbox. Tailnet DNS selects the private
listener for settings, service controls and the complete file browser. LAN DNS
configuration is managed separately by the owner.

The native pages cover overview, files and storage, service search and details,
redacted logs, private access, network interfaces, recorded tests, and sources.
Live metrics and 24-hour CPU, temperature and suspicious-activity charts use the
existing Pi API. File frames disappear when storage is unhealthy or unreachable.
A running process is not evidence that every application is configured.

Service mutations and phone enrollment continue respecting the existing API’s
read-only and protected-service controls. This frontend change does not alter
router configuration, storage, PCIe settings, or public port mappings.

## Build and test

From `frontend` using the existing pinned dependencies:

```sh
npm run test:metr
CI=true GENERATE_SOURCEMAP=false npm run build
```

The METR suite includes native navigation, service filtering, expansion, logs,
disabled controls, and the existing storage/observability regression checks.
The original SPR and Island source and tests are retained, with their existing
licenses; they are not bundled by the METR entrypoint.

Entry: `frontend/src/index.js` → `frontend/src/pi/MetrApp.js`.
Styles: `frontend/src/pi/metr.css`. Local font and illustration plus source
hashes: `frontend/src/pi/metr-assets/`. See `METR-DESIGN.md` for the reference
mapping and verification boundary.

## Runtime

The Python adapter remains in `server/api_server.py`. Normal local preview
binds loopback port 19100 and uses the existing SSH transport. Deployed
`pi-console.service` reads the Pi directly and serves the Tailscale forward.
`pi-console-lan.service` binds 192.168.0.56:80 and admits the configured home
subnet. Host/Origin checks, same-site session cookies, CSRF checks and disabled
service controls are preserved. The session mechanism is for this private
network; it is not an internet-facing login system.

The existing SSH helper is external to this repository. For a durable local
preview, configure `PI_CONSOLE_SSH_TARGET` with an existing SSH host alias.
`PI_CONSOLE_BIND`, `PI_CONSOLE_PORT`, and `PI_CONSOLE_ALLOWED_NETWORKS` are
explicit listener options. Defaults admit loopback only.

See `deploy/` for deployment history, `OBSERVABILITY.md` for log collection,
`tests/PORTING.md` for the upstream test boundary, and `vendor/README.md` for
retained historical design-library provenance. No SPR runtime is installed.
