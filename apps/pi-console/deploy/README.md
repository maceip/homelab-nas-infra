# Pi deployment

Deployed 2026-09-12 to `/opt/pi-console/releases/20260912-remote`, selected by
`/opt/pi-console/current`. The root-owned release contains the prebuilt frontend,
Python adapter, test results, and unit file. No SPR runtime is installed.

## Access

Connect the enrolled phone's Tailscale client to Headscale, then open:

- Dashboard: `http://100.64.0.1/`
- Integrated files: `http://100.64.0.1/admin/files`
- Standalone files: `http://100.64.0.1:8080/files/`

These private overlay addresses require Tailscale. HTTP is carried inside the
Tailscale encrypted transport; there is no browser TLS certificate at these IP
URLs. No internet port mapping, exit node, or subnet advertisement was added.
The existing LAN File Browser address remains available.

## Runtime

`pi-console.service` runs as `pi` with local probes, service controls disabled,
and a loopback listener on 19100. It starts at boot and restarts on failure.
The service can read the journal through its supplementary systemd-journal
group. The deployed host allowlist admits `100.64.0.1`; sessions, origin checks,
CSRF protection and traversal protection remain enabled.

The existing userspace Tailscale daemon forwards private TCP ports:

- 22 -> 127.0.0.1:22 (pre-existing, preserved)
- 80 -> 127.0.0.1:19100 (dashboard)
- 8080 -> 127.0.0.1:8080 (files)

Mappings were added with `tailscale serve --bg --tcp=PORT tcp://127.0.0.1:TARGET`
using socket `/home/pi/upstream-software/state/tailscale/tailscaled.sock`.
Serve persists these mappings in the existing daemon state. Before-state is
saved in `/var/backups/homelab-nas/20260912-dashboard/serve-before.json`.

## Verification

326 dashboard assertions passed plus production build and live read probes.
A separate temporary ephemeral Headscale client joined as `owner` at
100.64.0.2 and accessed 100.64.0.1 through its own userspace network stack.
Dashboard HTML, session, live overview, storage, VPN and journal endpoints passed.
File Browser listed 24 entries; a new test file uploaded, downloaded identically,
and was deleted. The temporary peer and its runtime files were removed.
This exercises the private overlay path, but is not a test from the user's
actual cellular phone.

## Rollback

Stop/disable only `pi-console.service`. Remove only Serve ports 80 and 8080
using `tailscale --socket=... serve --tcp=PORT off`. Do not reset all Serve
configuration, which would also remove the existing private SSH forwarding.
The dashboard deployment does not change the storage or PCIe configuration.
