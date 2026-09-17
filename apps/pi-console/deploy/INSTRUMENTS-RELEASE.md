# Live instrument panel — 2026-09-15

Release: `/opt/pi-console/releases/20260915-live-instruments`.
Previous: `/opt/pi-console/releases/20260915-metr-web`.
Archive SHA-256: `dd791cc93acce917281b8fd89e409a39438a2e02af95b4cbda2e1156d368d6a2`.

`SystemInstruments.js` and `instruments.css` implement the supplied cream/green
instrument reference using native React, SVG seven-segment digits, elliptical
segmented gauges and CSS recessed housing. No rasterized UI, external font,
new dependency, continuous canvas loop or fabricated measurement is used.
The center moves below the two gauges on phones. Reduced-motion preferences
remove gauge transitions. Values are accessible through image labels.

Measurements update every 30 seconds:

- CPU: delta of Linux aggregate CPU ticks, excluding idle and I/O wait.
- Memory: `(MemTotal - MemAvailable) / MemTotal`. This uses `/proc/meminfo`
  and is independent of the currently disabled cgroup memory controller.
- Disk I/O: maximum delta of busy milliseconds across the physical members
  of md0, divided by elapsed monotonic time. It is sampled busy time, not a
  capacity measurement or a benchmark of maximum disk throughput.
- Capacity: used/total from the existing NAS health probe, only while fresh
  and readable. The storage light means readable, not redundant or backed up.
- Network: byte counter deltas on the lowest-metric default-route interface,
  converted to bits per second. No summing of overlay or bridge traffic.
- Lamps: measured CPU temperature, NAS readability, collector freshness.

Counters return unknown on the first sample, reboot, interface change, reset,
missing member or sample gap over 180 seconds. Old samples receive NULL for new
fields. Stale telemetry hides live gauge readings; history remains available.
The UI checks age independently of API completion, including a hung request.
CPU and memory gauge digits round to whole percent; accessible labels and the
CPU history retain one decimal. Network digits use decimal kb/s, Mb/s or Gb/s.

Validation: 23 frontend tests; 40 backend tests; production build; desktop
1440px and phone 390px rendering; no horizontal overflow; live LAN API and
browser readings verified. Browser console had no errors. Existing sample
history was retained (2,714 samples at the first post-deploy check). This is
not a cellular end-to-end test or a disk load test. Build: 65.48 kB gzipped JS,
7.4 kB gzipped CSS. Only the collector and two dashboard listeners restarted.
The router-log receiver, NAS services, networking and boot settings were not
changed.

## Rollback

The old collector uses positional SQL inserts, so simply copying its original
file back is insufficient after the additive column migration. Use the saved
`rollback/telemetry.compat.py`: it is the old collector with explicit original
column names for its INSERT. Keep the new columns/history in place.

1. Stop `pi-observability`.
2. Copy the release's `rollback/telemetry.compat.py` to
   `/opt/pi-observability/telemetry.py`.
3. Atomically repoint `/opt/pi-console/current` to the previous release.
4. Restart `pi-observability`, `pi-console` and `pi-console-lan`.
5. Verify new CPU samples and successful LAN/overlay dashboard requests.

`rollback/telemetry.original.py` and a consistent pre-migration SQLite backup
are retained for recovery. Do not restore the database as part of normal
rollback: that would discard subsequent events. Startup-failure rollback uses
the compatible collector and preserves current history.
