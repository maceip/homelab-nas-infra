# homelab-nas-infra

Configuration for `homelab-nas`, a Raspberry Pi 5 NAS with a Radxa Penta
SATA HAT and four SSDs.

This repository is the configuration for one named Raspberry Pi. Disk serials
and NIC MAC addresses are included so the storage script can refuse unknown
disks.

## Design

- Raspberry Pi OS 64-bit (Debian 13 / Trixie) boots from the microSD card only.
- PCIe Gen 3.0 is enabled on the Raspberry Pi 5 FPC connector. Raspberry Pi
  does not certify Gen 3.0; the default is Gen 2.0.
- The four SSDs are an `mdadm` RAID 0 array (no redundancy).
- The array is XFS, mounted at `/srv/storage`.
- Samba exports `/srv/storage/public` as a guest-writable share named `Public`.
- File Browser serves the same directory on TCP port 8080. Command execution
  is disabled.
- Avahi publishes SMB for macOS and iOS; `wsdd2` publishes it for Windows.
- Boot and SSH do not depend on the array. `/etc/fstab` uses `nofail` with
  `x-systemd.device-timeout=10s` and `x-systemd.mount-timeout=30s`.

RAID 0 has no redundancy. If any member fails, the array is lost.

## Apply order

1. `sudo scripts/10-base-and-pcie.sh`
2. Reboot and run `scripts/15-verify-pcie.sh`
3. `sudo scripts/20-create-raid0.sh`
4. `sudo scripts/30-configure-samba.sh`
5. `sudo scripts/35-configure-network.sh`
6. `sudo scripts/40-configure-filebrowser.sh`
7. `sudo scripts/80-storage-benchmark.sh`
8. `scripts/90-verify.sh`

`scripts/20-create-raid0.sh` wipes the four SSDs listed in
`config/storage/disks.conf`. It refuses the microSD boot device, mounted
devices, and disks whose model is not Samsung SSD 870 QVO 8 TB.

PCIe Gen 3.0 is the intended link speed. Use
`sudo scripts/11-fallback-gen2.sh` only after verification and the storage
benchmark show PCIe, AER, AHCI, or disk-link errors from Gen 3.0.

`scripts/50-health.sh` prints fan, SMART, PCIe, RAID, and service state.

## Client access

- Browser: `http://homelab-nas.local:8080`
- macOS and iOS: `smb://homelab-nas.local/Public`
- Windows: `\\homelab-nas\Public`
- Android: SMB to `homelab-nas.local`, share `Public`, guest
- Addresses at build: Wi-Fi `192.168.0.36`, USB 2.5 GbE `192.168.0.56`,
  direct Ethernet `192.168.100.50`

The SMB share and File Browser allow unauthenticated read and write for anyone
on the home LAN (`192.168.0.0/16`). Do not forward TCP 139, 445, or 8080 to
the public Internet. See [Security](docs/security.md).

## Recovery

See [docs/recovery.md](docs/recovery.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Operations](docs/operations.md)
- [Recovery](docs/recovery.md)
- [Fan and performance](docs/fan-and-performance.md)
- [Initial build report](docs/build-report.md)
- [Security](docs/security.md)
