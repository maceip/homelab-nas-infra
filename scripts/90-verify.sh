#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../config/network/interfaces.conf
source "${repo_dir}/config/network/interfaces.conf"

fail=0
check() {
  if "$@"; then
    printf 'PASS: %s\n' "$*"
  else
    printf 'FAIL: %s\n' "$*" >&2
    fail=1
  fi
}

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
check test "$(cat /sys/bus/pci/devices/0001:01:00.0/current_link_speed)" = "8.0 GT/s PCIe"
check test "$(cat /sys/bus/pci/devices/0001:01:00.0/current_link_width)" = "1"
if [[ -e /sys/class/net/eth1/address ]] &&
  [[ $(< /sys/class/net/eth1/address) == "${USB_25GBE_MAC}" ]]; then
  check test "$(< /sys/class/net/eth1/speed)" = "2500"
  check test "$(< /sys/class/net/eth1/duplex)" = "full"
fi
check smbclient -N -c 'ls' //localhost/Public
check verify_filebrowser
check test "$(vcgencmd get_throttled)" = "throttled=0x0"

sudo mdadm --detail /dev/md0
df -hT /srv/storage
ip -brief address
exit "${fail}"
