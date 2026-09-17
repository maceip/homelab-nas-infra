#!/usr/bin/env bash
# Confirm SSH, Samba, discovery, File Browser, the RAID mount, PCIe Gen 3.0
# x1, and (when present) 2.5 GbE full duplex.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
# shellcheck source=../config/network/nics.conf
source "${REPO_DIR}/config/network/nics.conf"

fail=0
check() {
  if "$@"; then
    printf 'PASS: %s\n' "$*"
  else
    printf 'FAIL: %s\n' "$*" >&2
    fail=1
  fi
}

# Invoked as `check wifi_ipv6_link_local`.
# shellcheck disable=SC2317
wifi_ipv6_link_local() {
  local name type method
  while IFS=: read -r name type; do
    [[ ${type} == "802-11-wireless" ]] || continue
    method="$(nmcli -g ipv6.method connection show "${name}")"
    [[ ${method} == "link-local" ]] || return 1
  done < <(nmcli -t -f NAME,TYPE connection show)
  return 0
}

# Invoked as `check verify_filebrowser`.
# shellcheck disable=SC2317
verify_filebrowser() {
  local token
  token="$(curl --fail --silent --show-error \
    --request POST http://127.0.0.1:8080/api/login)"
  curl --fail --silent --show-error \
    --header "X-Auth: ${token}" \
    http://127.0.0.1:8080/api/resources/ \
    --output /dev/null
}

check systemctl is-active --quiet ssh.service
check systemctl is-active --quiet smbd.service
check systemctl is-active --quiet nmbd.service
check systemctl is-active --quiet wsdd2.service
check systemctl is-active --quiet avahi-daemon.service
check systemctl is-active --quiet filebrowser.service
check findmnt --mountpoint /srv/storage
check test -d /srv/storage/public

slot="$(jmb585_pci_slot)"
check test -n "${slot}"
if [[ -n ${slot} ]]; then
  check test "$(cat "/sys/bus/pci/devices/${slot}/current_link_speed")" = "8.0 GT/s PCIe"
  check test "$(cat "/sys/bus/pci/devices/${slot}/current_link_width")" = "1"
fi

usb_interface="$(interface_for_mac "${USB_25GBE_MAC}" || true)"
if [[ -n ${usb_interface} ]]; then
  check test "$(< "/sys/class/net/${usb_interface}/speed")" = "2500"
  check test "$(< "/sys/class/net/${usb_interface}/duplex")" = "full"
fi

check smbclient -N -c 'ls' //localhost/Public
check verify_filebrowser
check wifi_ipv6_link_local
check test "$(vcgencmd get_throttled)" = "throttled=0x0"

sudo mdadm --detail /dev/md0
df -hT /srv/storage
ip -brief address
exit "${fail}"
