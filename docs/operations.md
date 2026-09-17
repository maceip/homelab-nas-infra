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

- Browser: `http://homelab-nas.local:8080`
- macOS and iOS: `smb://homelab-nas.local/Public`
- Windows: `\\homelab-nas\Public`
- Direct Ethernet: `smb://192.168.100.50/Public`

File Browser and Samba serve the same files. Both allow unauthenticated access
on the home LAN. Do not forward ports 139, 445, or 8080 from the public
Internet.

## Network paths

- USB 2.5 GbE: primary route, DHCP, metric 50
- Built-in Gigabit Ethernet: DHCP plus `192.168.100.50/24`, metric 100
- Wi-Fi: DHCP, metric 600

NetworkManager connections are matched to the MAC addresses in
`config/network/nics.conf`. Unplugging the USB adapter does not take over the
built-in Ethernet connection.

## Updates

```bash
sudo apt update
sudo apt full-upgrade
sudo reboot
```

Run `scripts/90-verify.sh` after reboot.

## Health report

```bash
scripts/50-health.sh
```

## RAID 0

There is no degraded mode and no disk replacement procedure for RAID 0.
Failure of any SSD loses the filesystem. Recreate the array with
`scripts/20-create-raid0.sh`. It refuses to overwrite an existing filesystem
or an array whose four members do not match `config/storage/disks.conf`.
