#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
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

install -m 0644 "${repo_dir}/config/samba/smb.conf" /etc/samba/smb.conf
install -m 0644 "${repo_dir}/config/avahi/smb.service" \
  /etc/avahi/services/smb.service
testparm -s /etc/samba/smb.conf >/dev/null

# This is a standalone file server, never an Active Directory controller.
systemctl disable --now samba-ad-dc.service winbind.service 2>/dev/null || true
systemctl mask samba-ad-dc.service winbind.service 2>/dev/null || true
systemctl unmask smbd.service nmbd.service wsdd2.service avahi-daemon.service
systemctl enable --now smbd.service nmbd.service wsdd2.service avahi-daemon.service

if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow Samba
fi

echo "Samba guest share configured. Backup: ${backup_dir}"
smbclient -N -L localhost
