#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../config/network/interfaces.conf
source "${repo_dir}/config/network/interfaces.conf"

echo "== CPU and kernel-controlled Pi fan =="
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
for disk in /dev/sd?; do
  model="$(lsblk -dno MODEL "${disk}" | xargs)"
  [[ ${model} == "Samsung SSD 870 QVO 8TB" ]] || continue
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
printf 'pcie_speed='
cat /sys/bus/pci/devices/0001:01:00.0/current_link_speed
printf 'pcie_width='
cat /sys/bus/pci/devices/0001:01:00.0/current_link_width
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
if [[ -x /usr/sbin/ethtool ]] &&
  [[ -e /sys/class/net/eth1/address ]] &&
  [[ $(< /sys/class/net/eth1/address) == "${USB_25GBE_MAC}" ]]; then
  sudo /usr/sbin/ethtool -i eth1 |
    grep -E '^(driver|version|firmware-version|bus-info):'
fi
