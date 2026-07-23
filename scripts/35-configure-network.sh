#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

eth_connection="$(
  nmcli -t -f NAME,TYPE connection show |
    awk -F: '$2 == "802-3-ethernet" {print $1; exit}'
)"
[[ -n ${eth_connection} ]] || {
  echo "No Ethernet NetworkManager profile found; leaving networking unchanged." >&2
  exit 0
}

# Keep normal DHCP for a router connection and add a deterministic direct-link
# address for recovery from a Mac or PC.
nmcli connection modify "${eth_connection}" \
  ipv4.method auto \
  ipv4.addresses "192.168.100.50/24" \
  ipv4.dhcp-timeout 10 \
  ipv4.may-fail yes \
  ipv4.route-metric 100 \
  ipv6.method link-local

wifi_connection="$(
  nmcli -t -f NAME,TYPE,DEVICE connection show --active |
    awk -F: '$2 == "802-11-wireless" && $3 == "wlan0" {print $1; exit}'
)"
if [[ -n ${wifi_connection} ]]; then
  nmcli connection modify "${wifi_connection}" \
    802-11-wireless.powersave 2 \
    ipv4.route-metric 600
fi

nmcli device reapply eth0 2>/dev/null || true
echo "Ethernet retains DHCP and also answers at 192.168.100.50."
