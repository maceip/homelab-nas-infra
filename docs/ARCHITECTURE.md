# Architecture

`homelab-nas` separates the recoverable operating system from disposable
high-speed storage:

1. Raspberry Pi OS boots from the 512 GB microSD.
2. SSH and networking do not depend on the SATA HAT or array.
3. The Pi 5 external PCIe lane runs at Gen 3 (8 GT/s x1).
4. A JMicron JMB585 exposes four Samsung 870 QVO 8 TB SATA SSDs.
5. Linux md RAID 0 stripes all four drives with a 512 KiB chunk.
6. XFS uses matching `su=512k,sw=4` geometry.
7. Samba exposes one guest-writable `Public` share.
8. File Browser exposes the same directory through a mobile-friendly web UI.
9. Avahi and wsdd2 provide Apple, browser, and Windows discovery.

The array is mounted with `nofail` and bounded device/mount timeouts. A failed
SSD therefore destroys stored data but must not prevent the Pi from booting,
joining the network, or accepting SSH.

The external PCIe connector on Raspberry Pi 5 is physically one lane, so Gen 3
x1 is the maximum negotiated link. The JMB585 advertises x2 capability, but the
Pi correctly negotiates x1.
