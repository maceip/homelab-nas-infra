# Initial build report

Built and validated on 2026-07-23.

## Platform

- Raspberry Pi 5
- Raspberry Pi OS 64-bit, Debian 13 (Trixie)
- Kernel `6.18.34+rpt-rpi-2712`
- Radxa Penta SATA HAT with JMicron JMB585
- Four Samsung SSD 870 QVO 8 TB drives
- PCIe Gen 3 negotiated at 8.0 GT/s x1
- Four SATA links negotiated at 6.0 Gb/s
- RAID 0 usable size: 29.11 TiB / 32.01 TB

## Storage validation

Before array creation:

- All four SMART overall-health checks passed.
- All four SMART short self-tests completed without error.
- All four SMART error logs contained no errors.
- Reallocated sector count was zero on all four SSDs.
- Each SSD sustained approximately 568 MB/s in a direct 4 GiB read.

Array stress test:

- 32 GiB sequential write: 869 MiB/s (911 MB/s)
- 32 GiB sequential read: 862 MiB/s (904 MB/s)
- 60-second 70/30 random 4 KiB mix:
  - Read: approximately 107,000 IOPS / 439 MB/s
  - Write: approximately 46,000 IOPS / 188 MB/s
- Post-test SMART health passed on every SSD.
- No PCIe AER, link reset, SATA, block I/O, or undervoltage errors.
- Maximum observed temperature after the stress test: 59.8 C.
- `vcgencmd get_throttled`: `0x0`.

Raw benchmark output is retained on the Pi under
`/var/log/homelab-nas/20260723T215952Z-fio.txt`.

## Service validation

- Reboot caused a real SSH disconnect and SSH returned 22 seconds later.
- RAID 0 assembled automatically after reboot.
- XFS mounted cleanly at `/srv/storage`.
- SSH, Samba, NetBIOS discovery, wsdd2, and Avahi were all enabled and active.
- No failed systemd units after reboot.
- Guest SMB read/write/delete passed locally.
- Native macOS SMB read/write/delete passed over Wi-Fi.
- Native macOS SMB read/write/delete passed over direct Ethernet.
- `homelab-nas.local` resolved to both `192.168.0.36` and
  `192.168.100.50`.
- File Browser 2.63.18 was installed with checksum verification.
- Its no-authentication web flow and create/read/delete API round trip passed
  from macOS.
- Realtek RTL8156 USB Ethernet was detected by the in-kernel `r8152` driver.
- USB negotiated at 5,000 Mb/s and Ethernet negotiated at 2,500 Mb/s full
  duplex.

PCIe Gen 2 fallback was not used because Gen 3 passed every link, health,
stress, reboot, and client-access check.
