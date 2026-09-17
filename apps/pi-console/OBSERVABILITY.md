# Pi dashboard observability — 2026-09-13

Dashboard: http://100.64.0.1/ with the enrolled phone's Tailscale connection enabled.
This is the private overlay address, not the public Headscale HTTPS endpoint.

## Installed behavior

- Overview places CPU utilization, temperature, and suspicious activity on adjacent 24-hour graphs. Metrics are sampled every 30 seconds. Missing metric intervals are not joined; unavailable/stale data is labeled. History builds from installation rather than inventing prior values.
- A storage-health-gated File Browser widget appears directly below the graphs. It uses the existing private File Browser endpoint. Uploads and downloads are real changes to the shared NAS.
- Explainable signals: five rejected SSH attempts or ten sensitive-path web probes from one address in five minutes, unfamiliar successful SSH logins, sensitive-path HTTP success responses, watched configuration changes. Isolated denied probes remain informational. Hardware faults appear in details and are excluded from the security graph. Signal counts are not an intrusion verdict.
- Known administrator SSH source baseline: 192.168.0.142, 192.168.100.1, loopback. This is an address baseline, not cryptographic attribution. DHCP changes can produce review signals, and a compromised known device can evade that rule.
- Collected journals: SSH, Headscale HTTP access records, selected dashboard request metadata, and recent kernel faults. This is not packet inspection, a full network IDS, or a complete audit of every installed web application and every File Browser operation.
- Dashboard records session creation, failed requests, and non-GET requests without cookies, query strings, credentials, enrollment IDs, or request bodies. The overlay proxy may mask original source addresses.
- Watched hashes cover passwd, sshd configuration, top-level custom service units and service drop-ins, journal configuration, and boot/tryboot configuration. Changes show paths, never file contents.

## Archer log shipping

Actual router delivery was verified at 13:26 and 13:28 PDT, including the compressed attachment format and decoded log text in the deployed dashboard.

Router System > System Log > Mail Log:

| Setting | Value |
| --- | --- |
| Email From | archer@router.local |
| SMTP Server | 192.168.0.56 |
| Email To | router-logs@pi.local |
| Require Password | Off |
| Mail Automatically | On |
| Frequency | After a Specific Interval, 1 hour |

The Archer uses implicit TLS on TCP 465 (verified from connection metadata). The receiver binds only 192.168.0.56, accepts only source 192.168.0.1 and the fixed sender/recipient, and cannot relay mail. A systemd IP allowlist additionally restricts the service to the router. There is no WAN forward for 465. Its dedicated self-signed TLS certificate was accepted by the Archer without changing any client validation setting. This provides encryption; the router's acceptance does not establish certificate pinning or strong sender authentication. Source-IP filtering cannot make a compromised router's logs trustworthy.

Exports are periodic snapshots, not real-time syslog. Delivery gaps over two hours are labeled overdue. Existing entries may precede delivery. The receiver parses bounded tar/gzip attachments in memory and never extracts archive paths to disk. Identical authentication-failure line sets are deduplicated across overlapping exports. The preview is at most 80 lines (the Archer lists newest first) with common credential fields redacted. Original archives remain restricted on the Pi.

- State: `/var/lib/pi-observability/telemetry.sqlite`
- Router originals: `/var/lib/pi-observability/router/*.eml.gz`
- Router retention: 30 days / 1 GiB maximum, whichever is reached first
- Metric retention: 24 hours; activity retention: 30 days / 20,000 events
- Full system journal: persistent on the SD card, 512 MiB cap, 90-day maximum, sync every 15 seconds. The size cap may shorten retention. Sudden power loss can still lose the newest unsynced records.
- Services: `pi-observability`, `pi-router-logs`, `pi-console`
- Reproducible setup: `deploy/install-observability.sh` on the Pi as root, after reviewing the LAN-specific addresses in the units.

## Connectivity verified

Pi USB Ethernet 192.168.0.56, MAC 00:E0:4C:43:A5:B8, is reserved on the Archer. Wired link negotiated 1 Gb/s. Mac Wi-Fi-to-Pi SSH works; Wi-Fi/LAN isolation was not changed.

Manual forwards are TCP 443 and UDP 59422 to the Pi. Tailscaled now binds fixed UDP 59422. UPnP is off, and the old Headscale UPnP renewal timer is disabled. Existing overlay Serve forwards for SSH, dashboard, and files were retained.

From a separate external server, matts.public.computer resolved to 164.152.137.196 and HTTPS `/health` returned HTTP 200 with status pass. Tested TCP 22, 25, 80, 465, 8080, 8443 and 19100 were unreachable; 443 was reachable. This is a bounded exposure check, not an exhaustive all-port or historical audit. The router's remote-admin checkbox was off; old pre-reset exposure cannot be reconstructed from this alone.

An isolated temporary overlay peer on the Pi exercised dashboard HTML, live overview, storage status, VPN/device list, service logs, and File Browser list/upload/download/delete. Its node and files were cleaned up. The telemetry API and rendered deployed dashboard were additionally checked through an SSH tunnel. This is not a completed cellular-phone test; that still needs the actual phone away from home.

## PCIe Gen 3 trial

A one-boot trial was prepared in `/boot/firmware/tryboot.txt`, preserving `/boot/firmware/config.txt`. The Pi was rebooted with `reboot '0 tryboot'` and negotiated **8.0 GT/s PCIe x1** on the JMB585 controller. All four drives assembled into md0, XFS was readable, and the dashboard, log receiver, Headscale and Tailscale started.

A bounded 128 MiB direct read from md0 to `/dev/null` completed without errors. Kernel inspection found AER initialization messages, but no new PCIe/SATA/I/O fault messages. This is a read check, not an integrity or sustained-load validation. Automatic approval review rejected the proposed 4 GiB write/checksum plus three-minute load test on the shared RAID0 array; it was not run and its scratch file was not created.

**Current trial behavior: Gen 3 for this boot; the next ordinary reboot/power cycle loads the original Gen 2 configuration.** A hard hang can still require a physical power cycle; tryboot does not itself reboot a hung OS. Bulk model downloads remain paused by the existing storage diagnostics guard. No filesystem repair, reformat, RAID migration, or user-file deletion was performed.

Baseline and trial logs are retained in `/var/backups/homelab-nas/20260913-gen3-trial`. Prior storage failure cause remains unknown. The old boot-config comment “disabled after failed Gen 3 validation” came from a generic fallback script; it is not evidence establishing causality. Firmware-update failure remains a hypothesis for the Wi-Fi incident, not a verified explanation.

Reference for one-boot recovery behavior: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#fail-safe-os-updates-tryboot

## Validation

- 31 backend tests: adapter boundaries, telemetry rules, replay deduplication, archive size/path handling, source/recipient restrictions, unavailable data and aggregation independent of event-list limit.
- 23 frontend tests: prior Island/files behavior plus telemetry rendering, stale data, overdue router logs, escaped log text, file-widget gating and graph gaps.
- Production frontend build succeeded. Browser verified the deployed graph layout and decoded Archer records, with no recorded JavaScript errors during inspection.
- Prior release retained at `/opt/pi-console/releases/20260912-remote`; current release `/opt/pi-console/releases/20260913-observability-v3`.

During mobile QA, twelve newly watched pre-existing configuration files were initially misclassified as changes. A regression test now separates watch-scope expansion from actual changes. The original telemetry database was preserved before reclassifying exactly those twelve derived records as informational baseline additions; original router and system logs were not edited.
