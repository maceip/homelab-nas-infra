#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../config/network/interfaces.conf
source "${repo_dir}/config/network/interfaces.conf"

interface_for_mac() {
  local expected_mac="${1,,}"
  local interface
  for interface_path in /sys/class/net/*; do
    [[ -r ${interface_path}/address ]] || continue
    interface="$(basename "${interface_path}")"
    [[ $(<"${interface_path}/address") == "${expected_mac}" ]] || continue
    printf '%s\n' "${interface}"
    return 0
  done
  return 1
}

builtin_interface="$(interface_for_mac "${BUILTIN_ETHERNET_MAC}")"
usb_interface="$(interface_for_mac "${USB_25GBE_MAC}" || true)"

if ! nmcli connection show homelab-built-in >/dev/null 2>&1; then
  nmcli connection add type ethernet \
    con-name homelab-built-in \
    ifname "${builtin_interface}" \
    802-3-ethernet.mac-address "${BUILTIN_ETHERNET_MAC}"
fi
nmcli connection modify homelab-built-in \
  connection.interface-name "${builtin_interface}" \
  connection.autoconnect yes \
  connection.autoconnect-priority 50 \
  802-3-ethernet.mac-address "${BUILTIN_ETHERNET_MAC}" \
  ipv4.method auto \
  ipv4.addresses "192.168.100.50/24" \
  ipv4.dhcp-timeout 10 \
  ipv4.may-fail yes \
  ipv4.route-metric 100 \
  ipv6.method link-local

if [[ -n ${usb_interface} ]]; then
  if ! nmcli connection show homelab-2.5gbe >/dev/null 2>&1; then
    nmcli connection add type ethernet \
      con-name homelab-2.5gbe \
      ifname "${usb_interface}" \
      802-3-ethernet.mac-address "${USB_25GBE_MAC}"
  fi
  nmcli connection modify homelab-2.5gbe \
    connection.interface-name "${usb_interface}" \
    connection.autoconnect yes \
    connection.autoconnect-priority 100 \
    802-3-ethernet.mac-address "${USB_25GBE_MAC}" \
    ipv4.method auto \
    ipv4.addresses "" \
    ipv4.dhcp-timeout 15 \
    ipv4.may-fail yes \
    ipv4.route-metric 50 \
    ipv6.method auto
  nmcli --wait 20 connection up homelab-2.5gbe ifname "${usb_interface}"
fi

# Remove the old catch-all profile only after deterministic replacements exist.
if nmcli connection show netplan-eth0 >/dev/null 2>&1; then
  nmcli connection delete netplan-eth0
fi

if [[ $(<"/sys/class/net/${builtin_interface}/carrier") == 1 ]]; then
  nmcli --wait 20 connection up homelab-built-in ifname "${builtin_interface}"
fi

wifi_connection="$(
  nmcli -t -f NAME,TYPE,DEVICE connection show --active |
    awk -F: '$2 == "802-11-wireless" && $3 == "wlan0" {print $1; exit}'
)"
if [[ -n ${wifi_connection} ]]; then
  nmcli connection modify "${wifi_connection}" \
    802-11-wireless.powersave 2 \
    ipv4.route-metric 600
fi

echo "Network priorities:"
echo "  USB 2.5 GbE: metric 50 (primary when present)"
echo "  Built-in Ethernet: metric 100 plus direct recovery at 192.168.100.50"
echo "  Wi-Fi: metric 600 (independent recovery)"
