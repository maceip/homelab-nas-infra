#!/usr/bin/env bash
# Install packages, append the Radxa Penta SATA HAT PCIe settings to
# /boot/firmware/config.txt, and boot without the graphical login.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_root "$@"

backup_dir="/var/backups/homelab-nas/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "${backup_dir}"
cp -a /boot/firmware/config.txt "${backup_dir}/config.txt"
cp -a /boot/firmware/cmdline.txt "${backup_dir}/cmdline.txt"
cp -a /etc/fstab "${backup_dir}/fstab"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y full-upgrade
apt-get install -y \
  mdadm xfsprogs samba samba-vfs-modules avahi-daemon wsdd2 \
  smartmontools hdparm fio jq git curl smbclient ethtool pciutils

config="/boot/firmware/config.txt"
begin="# BEGIN homelab-nas managed Radxa Penta SATA HAT"
if ! grep -Fq "${begin}" "${config}"; then
  {
    printf '\n[all]\n'
    cat "${REPO_DIR}/config/boot/radxa-penta-sata-hat.conf"
  } >> "${config}"
fi

# Boot without the graphical login. Desktop packages stay installed for HDMI.
systemctl set-default multi-user.target
systemctl disable lightdm.service 2>/dev/null || true
systemctl disable NetworkManager-wait-online.service 2>/dev/null || true

systemctl enable fstrim.timer
systemctl enable smartmontools.service 2>/dev/null || true
systemctl enable avahi-daemon.service

# Disable Wi-Fi power saving.
while IFS=: read -r connection _ device; do
  [[ ${device} == "wlan0" ]] || continue
  nmcli connection modify "${connection}" 802-11-wireless.powersave 2
done < <(nmcli -t -f NAME,TYPE,DEVICE connection show --active)

echo "Base system and PCIe configuration applied."
echo "Recovery copies: ${backup_dir}"
echo "Reboot required."
