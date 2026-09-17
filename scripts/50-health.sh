#!/usr/bin/env bash
# Print CPU temperature, pwmfan RPM, SSD SMART, PCIe link, RAID, and services.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
# shellcheck source=../config/network/nics.conf
source "${REPO_DIR}/config/network/nics.conf"
# shellcheck source=../config/storage/disks.conf
source "${REPO_DIR}/config/storage/disks.conf"

echo "== CPU and pwmfan =="
vcgencmd measure_temp
vcgencmd get_throttled
for hwmon in /sys/class/hwmon/hwmon*; do
  [[ -r ${hwmon}/name ]] || continue
  [[ $(<"${hwmon}/name") == pwmfan ]] || continue
  printf 'fan_rpm=%s pwm=%s/255 mode=%s\n' \
    "$(<"${hwmon}/fan1_input")" \
    "$(<"${hwmon}/pwm1")" \
    "$(<"${hwmon}/pwm1_enable")"
done

echo "== SSD temperature and health =="
for stable_path in "${RAID_DISKS[@]}"; do
  [[ -b ${stable_path} ]] || continue
  disk="$(readlink -f "${stable_path}")"
  temperature="$(
    sudo smartctl -A "${disk}" |
      awk '$1 == 190 { print $10; exit }'
  )"
  health="$(
    sudo smartctl -H "${disk}" |
      awk -F: '/overall-health/ {gsub(/^[ \t]+/, "", $2); print $2}'
  )"
  printf '%s temperature=%sC health=%s\n' "${disk}" "${temperature}" "${health}"
done

echo "== PCIe and RAID =="
slot="$(jmb585_pci_slot)"
if [[ -z ${slot} ]]; then
  echo "JMicron JMB585 SATA controller not detected" >&2
else
  printf 'pcie_speed='
  cat "/sys/bus/pci/devices/${slot}/current_link_speed"
  printf 'pcie_width='
  cat "/sys/bus/pci/devices/${slot}/current_link_width"
fi
sudo mdadm --detail /dev/md0 |
  grep -E 'Raid Level|Array Size|State :|Active Devices|Failed Devices|Chunk Size'
df -hT /srv/storage

echo "== Services and addresses =="
for service in ssh smbd nmbd wsdd2 avahi-daemon filebrowser; do
  printf '%-14s %s\n' "${service}" "$(systemctl is-active "${service}.service")"
done
ip -brief address

echo "== Network link speeds =="
for interface_path in /sys/class/net/*; do
  [[ -r ${interface_path}/speed ]] || continue
  interface="$(basename "${interface_path}")"
  speed="$(<"${interface_path}/speed")"
  [[ ${speed} =~ ^[0-9]+$ ]] || continue
  (( speed > 0 )) || continue
  printf '%-14s %s Mb/s %s\n' \
    "${interface}" "${speed}" "$(<"${interface_path}/duplex")"
done

usb_interface="$(interface_for_mac "${USB_25GBE_MAC}" || true)"
if [[ -n ${usb_interface} ]] && [[ -x /usr/sbin/ethtool ]]; then
  sudo /usr/sbin/ethtool -i "${usb_interface}" |
    grep -E '^(driver|version|firmware-version|bus-info):'
fi
