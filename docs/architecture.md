# Architecture

`homelab-nas` keeps Raspberry Pi OS on the microSD card and the SSD array on
the Radxa Penta SATA HAT:

1. Raspberry Pi OS boots from the 512 GB microSD card.
2. SSH and networking do not depend on the SATA HAT or the array.
3. The Raspberry Pi 5 FPC connector runs PCIe Gen 3.0 (8 GT/s ×1).
4. A JMicron JMB585 presents four Samsung 870 QVO 8 TB SATA SSDs.
5. Linux md RAID 0 stripes all four drives with a 512 KiB chunk.
6. XFS uses matching `su=512k,sw=4` geometry.
7. Samba exports one guest-writable `Public` share.
8. File Browser serves the same directory on TCP port 8080.
9. Avahi and wsdd2 provide macOS, browser, and Windows discovery.
10. A Realtek RTL8156 USB 3 adapter is the primary 2.5 GbE path. Built-in
    Ethernet and Wi-Fi stay available if that adapter is unplugged.

The array is mounted with `nofail`, `x-systemd.device-timeout=10s`, and
`x-systemd.mount-timeout=30s`. A failed SSD destroys stored data but must not
prevent the Pi from booting, joining the network, or accepting SSH.

The external PCIe connector on Raspberry Pi 5 is one lane, so Gen 3.0 ×1 is
the maximum negotiated link. The JMB585 advertises ×2, but the Pi negotiates
×1.
