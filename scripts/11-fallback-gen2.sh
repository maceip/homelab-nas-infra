#!/usr/bin/env bash
# Comment out dtparam=pciex1_gen=3 so the Pi returns to PCIe Gen 2.0.
# Use only after PCIe Gen 3.0 has failed verification. See docs/recovery.md.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_root "$@"

config="/boot/firmware/config.txt"
backup="/var/backups/homelab-nas/config.txt.before-gen2-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 /var/backups/homelab-nas
cp -a "${config}" "${backup}"

if ! grep -Fq 'dtparam=pciex1_gen=3' "${config}"; then
  echo "dtparam=pciex1_gen=3 is not present; no change made."
  exit 0
fi

sed -i 's/^dtparam=pciex1_gen=3$/# dtparam=pciex1_gen=3 # disabled after failed Gen 3.0 verification/' "${config}"
echo "PCIe Gen 3.0 disabled. Raspberry Pi 5 will use Gen 2.0 after reboot."
echo "Recovery copy: ${backup}"
