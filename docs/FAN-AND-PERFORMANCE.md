# Fan and performance

## Fan state on this build

The Pi reports one kernel-controlled PWM fan through `pwmfan`. At inspection it
was running at approximately 4,337 RPM with PWM 75/255. Raspberry Pi OS varies
that fan automatically using CPU thermal trip points beginning at 50 C.

The optional Radxa top-board fan is a separate device connected to physical
pin 33 (GPIO13). The `rockpi-penta` service is not installed and GPIO13 is not
claimed, so a Radxa top-board fan that is spinning is operating in its
hardware-default fail-safe state, normally full speed. That is safe and favors
SSD cooling and sustained performance.

Radxa warns that its current `rockpi-penta` package can fail on a fresh Debian
13 installation or leave the fan stuck at 100 percent. This build therefore
does not add that package merely to slow a safely running fan.

Run `scripts/50-health.sh` for current CPU fan RPM, CPU temperature, SSD
temperatures, SMART health, PCIe link state, RAID state, and services.

## Current performance ceiling

The JMB585 controller can use PCIe Gen 3 x2, but Raspberry Pi 5 exposes one
external PCIe lane. The link is already at its maximum Gen 3 x1 rate:

- Negotiated link: 8.0 GT/s x1
- Measured RAID write: 911 MB/s
- Measured RAID read: 904 MB/s

Those results are close to the practical ceiling of a Gen 3 x1 link. No
filesystem or Samba tuning can materially exceed it on this Pi.

The built-in Ethernet port is 1 Gb/s and is therefore the bottleneck for a
single network client, normally around 110 MB/s of file throughput. A USB 3
2.5 GbE adapter and 2.5 GbE switch are the practical next hardware upgrade.
The existing RAID has enough speed to saturate 2.5 GbE.

This appliance now uses a Realtek RTL8156 USB 3 adapter. Linux bound it to the
in-kernel `r8152` driver without an additional vendor package. The USB side
negotiated at 5 Gb/s and the switch side negotiated at 2.5 Gb/s full duplex.
