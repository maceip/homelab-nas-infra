# Recovery

## Boot and SSH are independent of the SSD array

The operating system remains on the microSD card. The RAID mount must use
`nofail` and a bounded device timeout, so missing or failed SSDs cannot prevent
boot or SSH.

## Disable the Radxa PCIe configuration

If a future kernel or HAT problem affects boot:

1. Power off the Pi.
2. Insert the microSD card into another computer.
3. Open `bootfs/config.txt`.
4. Remove the block between:
   - `# BEGIN homelab-nas managed Radxa Penta SATA HAT`
   - `# END homelab-nas managed Radxa Penta SATA HAT`
5. Boot again. The Pi should return without the SATA controller enabled.

The Pi also stores timestamped copies in `/var/backups/homelab-nas/`.

## Fall back from PCIe Gen 3 to Gen 2

Only use this after Gen 3 validation produces repeatable PCIe/AER/AHCI or
storage I/O errors:

```bash
sudo scripts/11-fallback-gen2.sh
sudo reboot
```

Gen 2 is the Raspberry Pi 5 default. The fallback disables only
`dtparam=pciex1_gen=3`; PCIe and the Radxa DMA compatibility overlay remain
enabled.

## Network access

- Hostname: `homelab-nas.local`
- Wi-Fi uses DHCP.
- Ethernet uses DHCP when available and also has `192.168.100.50/24` for a
  direct cable.
- SSH remains enabled independently of Samba.

No Wi-Fi or account passwords belong in this repository.

## RAID 0 warning

RAID 0 provides maximum aggregate throughput and capacity but no redundancy.
Failure of any SSD destroys the array. Recreate it with
`scripts/20-create-raid0.sh` after replacing or identifying all four members.
