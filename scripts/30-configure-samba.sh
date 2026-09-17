#!/usr/bin/env bash
# Install smb.conf, the Avahi SMB service, and start smbd, nmbd, and wsdd2.
# Guest access to the Public share. See wiki.samba.org standalone server.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_root "$@"

findmnt --mountpoint /srv/storage >/dev/null || {
  echo "Refusing: /srv/storage is not mounted." >&2
  exit 1
}

if ! id nas-share >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --no-create-home \
    --shell /usr/sbin/nologin nas-share
fi
install -d -o nas-share -g nas-share -m 0777 /srv/storage/public

backup_dir="/var/backups/homelab-nas/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "${backup_dir}"
[[ ! -f /etc/samba/smb.conf ]] || cp -a /etc/samba/smb.conf "${backup_dir}/smb.conf"

install -m 0644 "${REPO_DIR}/config/samba/smb.conf" /etc/samba/smb.conf
install -m 0644 "${REPO_DIR}/config/avahi/smb.service" \
  /etc/avahi/services/smb.service
install -d -m 0755 /etc/systemd/system/smbd.service.d
install -m 0644 "${REPO_DIR}/config/systemd/smbd.service.d/requires-storage.conf" \
  /etc/systemd/system/smbd.service.d/requires-storage.conf
testparm -s /etc/samba/smb.conf >/dev/null

# Standalone file server, not an Active Directory domain controller.
systemctl disable --now samba-ad-dc.service winbind.service 2>/dev/null || true
systemctl mask samba-ad-dc.service winbind.service 2>/dev/null || true
systemctl daemon-reload
systemctl unmask smbd.service nmbd.service wsdd2.service avahi-daemon.service
systemctl enable --now smbd.service nmbd.service wsdd2.service avahi-daemon.service

if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow from 192.168.0.0/16 to any app Samba
fi

echo "Samba guest share configured. Backup: ${backup_dir}"
smbclient -N -L localhost
