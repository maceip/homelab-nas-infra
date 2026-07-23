#!/usr/bin/env bash
set -euo pipefail

echo "== Power =="
vcgencmd get_throttled

echo "== PCIe =="
sudo lspci -nnk

controller="$(lspci -Dnn | awk '/JMicron.*JMB585|JMicron.*SATA/ {print $1; exit}')"
if [[ -z ${controller} ]]; then
  echo "JMB585 SATA controller not detected" >&2
  exit 1
fi

sudo lspci -vv -s "${controller}" | grep -E 'LnkCap:|LnkSta:'

echo "== Disks =="
lsblk -e7 -o NAME,PATH,SIZE,TYPE,FSTYPE,MODEL,SERIAL,ROTA,TRAN,MOUNTPOINTS

echo "== Kernel errors =="
if sudo dmesg --color=never | grep -iE 'AER:.*error|I/O error|ata[0-9].*error|pcie.*error|under.?voltage'; then
  exit 1
fi

