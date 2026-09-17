#!/usr/bin/env bash
# Install File Browser 2.63.18, verify the Linux arm64 SHA-256 in this
# repository, and enable the systemd unit. Command execution stays disabled.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_root "$@"

version="2.63.18"
archive="linux-arm64-filebrowser.tar.gz"
release_url="https://github.com/filebrowser/filebrowser/releases/download/v${version}"
checksum_file="${REPO_DIR}/config/filebrowser/v${version}-linux-arm64.sha256"

findmnt --mountpoint /srv/storage >/dev/null || {
  echo "Refusing: /srv/storage is not mounted." >&2
  exit 1
}
id nas-share >/dev/null 2>&1 || {
  echo "Refusing: run scripts/30-configure-samba.sh first." >&2
  exit 1
}

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -f "${tmp_dir}/${archive}" "${tmp_dir}/filebrowser" \
    "${tmp_dir}/$(basename "${checksum_file}")"
  rmdir "${tmp_dir}" 2>/dev/null || true
}
trap cleanup EXIT

curl --fail --silent --show-error --location \
  --output "${tmp_dir}/${archive}" "${release_url}/${archive}"
install -m 0644 "${checksum_file}" "${tmp_dir}/$(basename "${checksum_file}")"
(
  cd "${tmp_dir}"
  sha256sum --check "$(basename "${checksum_file}")"
)
tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}" filebrowser
install -m 0755 "${tmp_dir}/filebrowser" /usr/local/bin/filebrowser

install -d -o nas-share -g nas-share -m 0750 /var/lib/filebrowser
database="/var/lib/filebrowser/filebrowser.db"
systemctl stop filebrowser.service 2>/dev/null || true
if [[ ! -f ${database} ]]; then
  runuser -u nas-share -- /usr/local/bin/filebrowser \
    --database "${database}" config init \
    --address 0.0.0.0 \
    --port 8080 \
    --root /srv/storage/public \
    --auth.method noauth \
    --branding.name "Homelab NAS" \
    --branding.disableExternal \
    --disableExec \
    --fileMode 0o666 \
    --dirMode 0o777 \
    --singleClick
else
  runuser -u nas-share -- /usr/local/bin/filebrowser \
    --database "${database}" config set \
    --address 0.0.0.0 \
    --port 8080 \
    --root /srv/storage/public \
    --auth.method noauth \
    --branding.name "Homelab NAS" \
    --branding.disableExternal \
    --disableExec \
    --fileMode 0o666 \
    --dirMode 0o777 \
    --singleClick
fi

if ! runuser -u nas-share -- /usr/local/bin/filebrowser \
  --database "${database}" users ls 2>/dev/null |
  awk 'NR > 1 { found=1 } END { exit !found }'; then
  bootstrap_password="$(openssl rand -hex 32)"
  runuser -u nas-share -- /usr/local/bin/filebrowser \
    --database "${database}" users add public "${bootstrap_password}" \
    --scope . \
    --singleClick \
    --perm.execute=false
  unset bootstrap_password
fi

install -m 0644 "${REPO_DIR}/config/systemd/filebrowser.service" \
  /etc/systemd/system/filebrowser.service
install -m 0644 "${REPO_DIR}/config/avahi/filebrowser.service" \
  /etc/avahi/services/filebrowser.service
systemctl daemon-reload
systemctl enable --now filebrowser.service
systemctl restart avahi-daemon.service

if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow from 192.168.0.0/16 to any port 8080 proto tcp
fi

/usr/local/bin/filebrowser version
echo "File Browser is ready at http://homelab-nas.local:8080"
