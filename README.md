# homelab-nas-infra

Rebuildable configuration for `homelab-nas`, a Raspberry Pi 5 NAS using a
Radxa Penta SATA HAT and four SSDs.

## Design

- Raspberry Pi OS 64-bit (Debian 13 / Trixie) boots only from microSD.
- The Radxa HAT runs at PCIe Gen 3 by explicit owner choice.
- The four SSDs form a maximum-throughput Linux `mdadm` RAID 0 stripe.
- The stripe is formatted as XFS and mounted at `/srv/storage`.
- Samba exports `/srv/storage/public` as a writable guest share.
- File Browser exposes the same directory through a mobile-friendly web UI.
- Avahi advertises SMB to Apple devices; `wsdd2` advertises it to Windows.
- The SSD array is never required for boot or SSH. Mount failures use
  `nofail` and bounded systemd timeouts.

RAID 0 has no redundancy. Failure of any member loses the whole array.

## Apply order

1. `sudo scripts/10-base-and-pcie.sh`
2. Reboot and run `scripts/15-verify-pcie.sh`
3. `sudo scripts/20-create-raid0.sh`
4. `sudo scripts/30-configure-samba.sh`
5. `sudo scripts/35-configure-network.sh`
6. `sudo scripts/40-configure-filebrowser.sh`
7. `sudo scripts/80-storage-benchmark.sh`
8. `scripts/90-verify.sh`

The storage script is intentionally destructive. It accepts only the four
SSD serial numbers recorded in `config/storage/disks.conf`, and refuses the
microSD boot device, mounted devices, or disks with an unexpected model.

PCIe Gen 3 is the target configuration. Fall back to Gen 2 only after the
verification and sustained I/O tests identify PCIe, AER, AHCI, or disk-link
errors attributable to Gen 3.

## Client access

- Any device with a browser: `http://homelab-nas.local:8080`
- Mac/iPhone: `smb://homelab-nas.local/Public`
- Windows: `\\homelab-nas\Public`
- Android: use an SMB-capable Files app and connect to
  `homelab-nas.local`, share `Public`, as guest.
- Wi-Fi address at initial build: `192.168.0.36`
- Direct Ethernet fallback: `192.168.100.50`

The SMB share and web file manager deliberately permit unauthenticated reads
and writes to anyone on the local network. Do not expose TCP ports 445 or 8080
to the Internet.

## Recovery

See [docs/RECOVERY.md](docs/RECOVERY.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Operations](docs/OPERATIONS.md)
- [Recovery](docs/RECOVERY.md)
- [Fan and performance](docs/FAN-AND-PERFORMANCE.md)
- [Initial build report](docs/BUILD-REPORT.md)
