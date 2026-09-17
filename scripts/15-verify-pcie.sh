#!/usr/bin/env bash
# Check power, PCIe link, disks, and kernel messages after the first reboot.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

echo "== Power =="
vcgencmd get_throttled

echo "== PCIe =="
sudo lspci -nnk

controller="$(jmb585_pci_slot)"
if [[ -z ${controller} ]]; then
  echo "JMicron JMB585 SATA controller not detected" >&2
  exit 1
fi

sudo lspci -vv -s "${controller}" | grep -E 'LnkCap:|LnkSta:'

echo "== Disks =="
lsblk -e7 -o NAME,PATH,SIZE,TYPE,FSTYPE,MODEL,SERIAL,ROTA,TRAN,MOUNTPOINTS

echo "== Kernel errors =="
if sudo dmesg --color=never | grep -iE 'AER:.*error|I/O error|ata[0-9].*error|pcie.*error|under.?voltage'; then
  exit 1
fi
