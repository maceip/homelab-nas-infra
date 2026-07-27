#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
version="2.63.18"
archive="linux-arm64-filebrowser.tar.gz"
checksum_file="filebrowser_${version}_checksums.txt"
release_url="https://github.com/filebrowser/filebrowser/releases/download/v${version}"

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
  rm -f "${tmp_dir}/${archive}" "${tmp_dir}/${checksum_file}" \
    "${tmp_dir}/filebrowser"
  rmdir "${tmp_dir}" 2>/dev/null || true
}
trap cleanup EXIT

curl --fail --silent --show-error --location \
  --output "${tmp_dir}/${archive}" "${release_url}/${archive}"
curl --fail --silent --show-error --location \
  --output "${tmp_dir}/${checksum_file}" "${release_url}/${checksum_file}"
(
  cd "${tmp_dir}"
  grep " ${archive}$" "${checksum_file}" | sha256sum --check -
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

install -m 0644 "${repo_dir}/config/systemd/filebrowser.service" \
  /etc/systemd/system/filebrowser.service
install -m 0644 "${repo_dir}/config/avahi/filebrowser.service" \
  /etc/avahi/services/filebrowser.service
systemctl daemon-reload
systemctl enable --now filebrowser.service
systemctl restart avahi-daemon.service

/usr/local/bin/filebrowser version
echo "Web file manager ready at http://homelab-nas.local:8080"
