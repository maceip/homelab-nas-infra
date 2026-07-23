#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

config="/boot/firmware/config.txt"
backup="/var/backups/homelab-nas/config.txt.before-gen2-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 /var/backups/homelab-nas
cp -a "${config}" "${backup}"

if ! grep -Fq 'dtparam=pciex1_gen=3' "${config}"; then
  echo "Gen 3 override is not present; no change made."
  exit 0
fi

sed -i 's/^dtparam=pciex1_gen=3$/# dtparam=pciex1_gen=3 # disabled after failed Gen 3 validation/' "${config}"
echo "Gen 3 override disabled. Raspberry Pi 5 will use supported Gen 2 after reboot."
echo "Recovery copy: ${backup}"

