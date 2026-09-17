#!/usr/bin/env bash
# Create NetworkManager connections matched to the MAC addresses in
# config/network/nics.conf. USB 2.5 GbE is the primary IPv4 default route.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_root "$@"

# shellcheck source=../config/network/nics.conf
source "${REPO_DIR}/config/network/nics.conf"

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
    ipv6.method link-local
  nmcli --wait 20 connection up homelab-2.5gbe ifname "${usb_interface}"
fi

# Delete netplan-eth0 after the MAC address connections exist.
if nmcli connection show netplan-eth0 >/dev/null 2>&1; then
  nmcli connection delete netplan-eth0
fi

if [[ $(<"/sys/class/net/${builtin_interface}/carrier") == 1 ]]; then
  nmcli --wait 20 connection up homelab-built-in ifname "${builtin_interface}"
fi

lock_wifi_profiles

echo "Network priorities:"
echo "  USB 2.5 GbE: metric 50 (primary when present)"
echo "  Built-in Ethernet: metric 100 plus 192.168.100.50/24"
echo "  Wi-Fi: metric 600"
