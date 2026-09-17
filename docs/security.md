# Security

Trust model: anyone on the home LAN (`192.168.0.0/16`) may read and write the
`Public` share. SSH uses the existing Raspberry Pi OS account. This repository
does not contain Wi-Fi passphrases, SSH keys, or account passwords.

File Browser's own guidance is not to expose it on the public Internet, to
keep command execution disabled, and to run it unprivileged with only the
directory it should serve. Samba is a standalone server with `guest ok` on
`Public`. Raspberry Pi documents that PCIe Gen 3.0 is not certified.

## What is wired

| Control | Where |
| --- | --- |
| Guest SMB limited to `192.168.0.0/16`, loopback, and IPv6 link-local | `config/samba/smb.conf` `hosts allow` |
| `server min protocol = SMB2_10` (no SMB1) | `config/samba/smb.conf` |
| Samba starts only if `/srv/storage/public` is mounted | `config/systemd/smbd.service.d/requires-storage.conf` |
| File Browser root, `noauth`, and `--disableExec` on `ExecStart` | `config/systemd/filebrowser.service` |
| File Browser incoming sources match Samba (`localhost`, link-local, `192.168.0.0/16`) | systemd `IPAddressAllow` |
| File Browser runs as `nas-share`, no extra capabilities | `config/systemd/filebrowser.service` |
| File Browser Linux arm64 SHA-256 pinned in git | `config/filebrowser/v2.63.18-linux-arm64.sha256` |
| IPv6 is link-local on built-in Ethernet, USB 2.5 GbE, and every saved Wi-Fi profile | `scripts/35-configure-network.sh` |
| If UFW is already active, Samba and TCP 8080 are allowed from `192.168.0.0/16` only | Samba and File Browser scripts |
| RAID 0 create refuses unknown serials, models, mounts, and the root disk | `scripts/20-create-raid0.sh` |
| Array mount uses `nofail` so boot and SSH do not depend on the SSDs | `/etc/fstab` from `scripts/20-create-raid0.sh` |
| NetworkManager profiles are matched to MAC addresses | `config/network/nics.conf` |

Go's listener for `--address 0.0.0.0` is dual-stack on Linux (`:8080` also
accepts IPv6). `IPAddressAllow` is what keeps File Browser on the same source
range as Samba, including if TCP 8080 is forwarded by mistake.

## What this does not do

- It does not authenticate SMB or File Browser on the LAN. A LAN client can
  read, write, and delete everything under `/srv/storage/public`.
- It does not enable UFW. Samba `hosts allow` and File Browser
  `IPAddressAllow` still apply when UFW is inactive.
- It does not configure the home router. Port forwarding, UPnP, and IPv6
  prefix delegation on the router are outside this repository.
- RAID 0 is not a backup. There is no off-device copy in this tree.
- The File Browser SHA-256 pin stops a substituted tarball. It does not
  protect against a compromised GitHub release that still matches a hash
  someone later retargets in git.

## Identifiers in this public repository

`config/storage/disks.conf` and `config/network/nics.conf` contain this Pi's
SSD serial numbers and NIC MAC addresses, plus the LAN addresses recorded at
build time. They are required for rebuild and for the destructive disk
checks. Treat them as identifying.

`.gitignore` already excludes `inventory/private/` and `secrets/` for anything
that must not be published.

## Checks that match the design

- `scripts/90-verify.sh` requires SSH, smbd, nmbd, wsdd2, Avahi, File Browser,
  the RAID mount, PCIe Gen 3.0 ×1, guest SMB `ls`, the File Browser HTTP API,
  and `ipv6.method=link-local` on every saved Wi-Fi profile.
- `scripts/15-verify-pcie.sh` and the health script locate the JMB585 with
  `lspci` rather than a fixed PCI address.
- `scripts/80-storage-benchmark.sh` runs SMART only on the four RAID members.

Re-apply on the Pi:

```bash
sudo scripts/30-configure-samba.sh
sudo scripts/35-configure-network.sh
sudo scripts/40-configure-filebrowser.sh
scripts/90-verify.sh
```
