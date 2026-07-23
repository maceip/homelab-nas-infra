#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../config/storage/disks.conf
source "${repo_dir}/config/storage/disks.conf"

[[ ${#RAID_DISKS[@]} -eq 4 ]] || {
  echo "Refusing: exactly four configured disks are required." >&2
  exit 1
}

declare -A seen=()
resolved=()
for stable_path in "${RAID_DISKS[@]}"; do
  [[ -b ${stable_path} ]] || {
    echo "Refusing: configured disk is absent: ${stable_path}" >&2
    exit 1
  }
  device="$(readlink -f "${stable_path}")"
  [[ ${device} == /dev/sd? ]] || {
    echo "Refusing unexpected device: ${device}" >&2
    exit 1
  }
  [[ -z ${seen[${device}]:-} ]] || {
    echo "Refusing duplicate device: ${device}" >&2
    exit 1
  }
  seen["${device}"]=1
  [[ $(lsblk -dnro TYPE "${device}") == disk ]] || {
    echo "Refusing non-disk device: ${device}" >&2
    exit 1
  }
  [[ $(lsblk -dno MODEL "${device}" | xargs) == "Samsung SSD 870 QVO 8TB" ]] || {
    echo "Refusing unexpected model on ${device}" >&2
    exit 1
  }
  if lsblk -nrpo MOUNTPOINTS "${device}" | grep -qE '/'; then
    echo "Refusing mounted device: ${device}" >&2
    exit 1
  fi
  resolved+=("${device}")
done

root_source="$(findmnt -nro SOURCE /)"
root_parent="/dev/$(lsblk -no PKNAME "${root_source}" | head -n1)"
for device in "${resolved[@]}"; do
  [[ ${device} != "${root_parent}" ]] || {
    echo "Refusing to touch root disk ${device}" >&2
    exit 1
  }
done

create_array=1
if [[ -e /dev/md0 ]]; then
  detail="$(mdadm --detail /dev/md0)"
  grep -qE 'Raid Level : raid0$' <<< "${detail}" || {
    echo "Refusing: existing /dev/md0 is not RAID 0." >&2
    exit 1
  }
  grep -qE 'Raid Devices : 4$' <<< "${detail}" || {
    echo "Refusing: existing /dev/md0 does not have four members." >&2
    exit 1
  }
  for device in "${resolved[@]}"; do
    grep -qE "[[:space:]]${device}$" <<< "${detail}" || {
      echo "Refusing: existing /dev/md0 does not contain ${device}." >&2
      exit 1
    }
  done
  [[ -z $(blkid -s TYPE -o value /dev/md0 || true) ]] || {
    echo "Refusing: existing /dev/md0 already has a filesystem." >&2
    exit 1
  }
  create_array=0
  echo "Resuming with the validated, unformatted /dev/md0."
fi

if (( create_array )); then
  echo "Validated RAID members:"
  for device in "${resolved[@]}"; do
    lsblk -dn -o PATH,SIZE,MODEL,SERIAL "${device}"
  done
  echo "Destroying existing signatures on the four explicitly configured SSDs."

  for device in "${resolved[@]}"; do
    wipefs --all --force "${device}"
    mdadm --zero-superblock --force "${device}" 2>/dev/null || true
  done

  mdadm --create /dev/md0 \
    --metadata=1.2 \
    --level=0 \
    --raid-devices=4 \
    --chunk=512 \
    --name=storage \
    "${resolved[@]}"
fi

udevadm settle
mkfs.xfs -f -L HOMELAB -d su=512k,sw=4 /dev/md0

install -d -m 0755 /srv/storage
uuid="$(blkid -s UUID -o value /dev/md0)"
begin="# BEGIN homelab-nas managed storage"
end="# END homelab-nas managed storage"
sed -i "\|${begin}|,\|${end}|d" /etc/fstab
{
  echo "${begin}"
  echo "UUID=${uuid} /srv/storage xfs defaults,noatime,nofail,x-systemd.device-timeout=10s,x-systemd.mount-timeout=30s 0 0"
  echo "${end}"
} >> /etc/fstab

mount /srv/storage
findmnt --mountpoint /srv/storage >/dev/null

tmp_conf="$(mktemp)"
grep -vE '^[[:space:]]*ARRAY[[:space:]]+/dev/md0([[:space:]]|$)' \
  /etc/mdadm/mdadm.conf > "${tmp_conf}" || true
mdadm --detail --scan /dev/md0 >> "${tmp_conf}"
install -m 0644 "${tmp_conf}" /etc/mdadm/mdadm.conf
rm -f "${tmp_conf}"
update-initramfs -u

echo "RAID 0 and XFS are ready at /srv/storage."
mdadm --detail /dev/md0
df -hT /srv/storage
