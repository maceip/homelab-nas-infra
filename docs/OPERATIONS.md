# Operations

## Health

```bash
scripts/90-verify.sh
sudo mdadm --detail /dev/md0
sudo smartctl -x /dev/sda
sudo journalctl -b -k | grep -Ei 'AER|ata.*(error|reset)|I/O error'
vcgencmd get_throttled
```

## Access

Use the `Public` share without a username or password:

- Browser on any device: `http://homelab-nas.local:8080`
- Apple: `smb://homelab-nas.local/Public`
- Windows: `\\homelab-nas\Public`
- Direct Ethernet recovery: `smb://192.168.100.50/Public`

The browser interface and SMB expose the same files. Both are intentionally
unauthenticated on the home LAN. Never forward ports 445 or 8080 from the
Internet.

## Network paths

- USB 2.5 GbE: primary route, DHCP, metric 50
- Built-in Gigabit Ethernet: DHCP plus `192.168.100.50/24`, metric 100
- Wi-Fi: DHCP, metric 600

The profiles are locked to the physical MAC addresses recorded in
`config/network/interfaces.conf`, so plugging or unplugging the USB adapter
cannot steal the built-in Ethernet recovery configuration.

## Updates

```bash
sudo apt update
sudo apt full-upgrade
sudo reboot
```

Run `scripts/90-verify.sh` after reboot.

## One-command health report

```bash
scripts/50-health.sh
```

## RAID 0 warning

There is no degraded mode and no disk replacement procedure for RAID 0.
Failure of any SSD loses the complete filesystem. Recreate the array using
`scripts/20-create-raid0.sh`; it refuses to overwrite an existing filesystem or
an array whose four members do not exactly match the recorded SSDs.
