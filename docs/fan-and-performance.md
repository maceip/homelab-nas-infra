# Fan and performance

## Fan state on this build

The Pi reports one `pwmfan` device. At build time it was running at about
4,337 RPM with PWM 75/255. Raspberry Pi OS varies that fan from CPU thermal
trip points beginning at 50 C.

The optional Radxa top-board fan is a separate device on physical pin 33
(GPIO13). The `rockpi-penta` package is not installed and GPIO13 is not
claimed. A Radxa top-board fan that is spinning is using its hardware default,
normally full speed. That is safe and cools the SSDs.

Radxa warns that the current `rockpi-penta` package can fail on a fresh Debian
13 installation or leave the fan at 100 percent. This build does not install
that package only to slow a fan that is already running safely.

Run `scripts/50-health.sh` for CPU fan RPM, CPU temperature, SSD temperatures,
SMART health, PCIe link state, RAID state, and services.

## Link and throughput

The JMB585 can use PCIe Gen 3.0 ×2, but Raspberry Pi 5 exposes one external
PCIe lane. The link is already at Gen 3.0 ×1:

- Negotiated link: 8.0 GT/s ×1
- Measured RAID write: 911 MB/s
- Measured RAID read: 904 MB/s

Those results are close to the limit of a Gen 3.0 ×1 link. Filesystem or Samba
tuning will not raise it much on this Pi.

Built-in Ethernet is 1 Gb/s, about 110 MB/s for a single client. This Pi uses
a Realtek RTL8156 USB 3 adapter as the primary 2.5 GbE path. Linux bound it to
the in-kernel `r8152` driver. USB negotiated at 5 Gb/s and the switch
negotiated at 2.5 Gb/s full duplex. The RAID array can saturate 2.5 GbE.
