# Recovery

## Boot and SSH do not depend on the SSD array

The operating system stays on the microSD card. The RAID mount uses `nofail`
with `x-systemd.device-timeout=10s`, so missing or failed SSDs cannot prevent
boot or SSH.

## Disable the Radxa PCIe configuration

If a later kernel or HAT problem affects boot:

1. Power off the Pi.
2. Insert the microSD card into another computer.
3. Open `bootfs/config.txt`.
4. Remove the block between:
   - `# BEGIN homelab-nas managed Radxa Penta SATA HAT`
   - `# END homelab-nas managed Radxa Penta SATA HAT`
5. Boot again. The Pi should return without the SATA controller enabled.

The Pi also stores dated copies in `/var/backups/homelab-nas/`.

## Fall back from PCIe Gen 3.0 to Gen 2.0

Use this only after Gen 3.0 verification shows repeatable PCIe, AER, AHCI, or
storage I/O errors:

```bash
sudo scripts/11-fallback-gen2.sh
sudo reboot
```

Gen 2.0 is the Raspberry Pi 5 default. The script comments out only
`dtparam=pciex1_gen=3`. `dtparam=pciex1` and `dtoverlay=pcie-32bit-dma-pi5`
stay enabled.

## Network access

- Hostname: `homelab-nas.local`
- Wi-Fi uses DHCP.
- Ethernet uses DHCP when available and also has `192.168.100.50/24` for a
  direct cable.
- SSH stays enabled independently of Samba.

No Wi-Fi or account passwords belong in this repository.

## RAID 0

RAID 0 increases aggregate throughput and capacity and has no redundancy.
Failure of any SSD destroys the array. Recreate it with
`scripts/20-create-raid0.sh` after replacing or identifying all four members.
