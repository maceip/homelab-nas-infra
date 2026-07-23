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

- Apple: `smb://homelab-nas.local/Public`
- Windows: `\\homelab-nas\Public`
- Direct Ethernet recovery: `smb://192.168.100.50/Public`

## Updates

```bash
sudo apt update
sudo apt full-upgrade
sudo reboot
```

Run `scripts/90-verify.sh` after reboot.

## RAID 0 warning

There is no degraded mode and no disk replacement procedure for RAID 0.
Failure of any SSD loses the complete filesystem. Recreate the array using
`scripts/20-create-raid0.sh`; it refuses to overwrite an existing filesystem or
an array whose four members do not exactly match the recorded SSDs.
