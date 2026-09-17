# METR dashboard release — 2026-09-15

Current release: `/opt/pi-console/releases/20260915-metr-web`.
Previous release: `/opt/pi-console/releases/20260913-observability-v3`.
Build archive SHA-256: `05cf597bfd2c2d412839998100545dc61cdb870c0427abb3c6b314d950d40419`.

The previous release was copied, preserving the deployed API, test history,
LAN boundary configuration and old hashed assets. The new prebuilt web files
were overlaid and the current symlink atomically switched. Only pi-console and
pi-console-lan were restarted. Both LAN and temporary-peer overlay checks passed.

To roll back, repoint `/opt/pi-console/current` to the previous release and
restart those two dashboard services. Do not change the Tailscale Serve mappings
or the LAN unit. No package, router, PCIe, disk or application-service changes
are part of this release.
