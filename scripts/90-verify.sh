#!/usr/bin/env bash
set -euo pipefail

fail=0
check() {
  if "$@"; then
    printf 'PASS: %s\n' "$*"
  else
    printf 'FAIL: %s\n' "$*" >&2
    fail=1
  fi
}

check systemctl is-active --quiet ssh.service
check systemctl is-active --quiet smbd.service
check systemctl is-active --quiet nmbd.service
check systemctl is-active --quiet wsdd2.service
check systemctl is-active --quiet avahi-daemon.service
check findmnt --mountpoint /srv/storage
check test -d /srv/storage/public
check test "$(cat /sys/bus/pci/devices/0001:01:00.0/current_link_speed)" = "8.0 GT/s PCIe"
check test "$(cat /sys/bus/pci/devices/0001:01:00.0/current_link_width)" = "1"
check smbclient -N -c 'ls' //localhost/Public
check test "$(vcgencmd get_throttled)" = "throttled=0x0"

sudo mdadm --detail /dev/md0
df -hT /srv/storage
ip -brief address
exit "${fail}"
