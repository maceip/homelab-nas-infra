#!/usr/bin/env bash
# Sequential and random fio against /srv/storage, then SMART on the RAID
# members. Fails if the kernel log shows PCIe, SATA, or block I/O errors.
set -euo pipefail

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_root "$@"

# shellcheck source=../config/storage/disks.conf
source "${REPO_DIR}/config/storage/disks.conf"

findmnt --mountpoint /srv/storage >/dev/null || {
  echo "Refusing: /srv/storage is not mounted." >&2
  exit 1
}

result_dir="/var/log/homelab-nas"
install -d -m 0755 "${result_dir}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
kernel_before="${result_dir}/${stamp}-kernel-before.log"
result="${result_dir}/${stamp}-fio.txt"
kernel_after="${result_dir}/${stamp}-kernel-after.log"

journalctl -b -k --no-pager > "${kernel_before}"
fio \
  --name=sequential \
  --filename=/srv/storage/.benchmark \
  --size=32G \
  --rw=write \
  --bs=1M \
  --direct=1 \
  --ioengine=libaio \
  --iodepth=32 \
  --end_fsync=1 \
  --group_reporting | tee "${result}"
fio \
  --name=sequential-read \
  --filename=/srv/storage/.benchmark \
  --size=32G \
  --rw=read \
  --bs=1M \
  --direct=1 \
  --ioengine=libaio \
  --iodepth=32 \
  --group_reporting | tee -a "${result}"
fio \
  --name=random-mixed \
  --filename=/srv/storage/.benchmark \
  --size=32G \
  --rw=randrw \
  --rwmixread=70 \
  --bs=4K \
  --direct=1 \
  --ioengine=libaio \
  --iodepth=64 \
  --runtime=60 \
  --time_based \
  --group_reporting | tee -a "${result}"
rm -f /srv/storage/.benchmark
sync
journalctl -b -k --no-pager > "${kernel_after}"

if grep -Ei 'AER:.*error|PCIe Bus Error|ata[0-9].*(error|failed|reset|timeout)|I/O error|blk_update_request' \
  "${kernel_after}"; then
  echo "Kernel I/O errors detected; inspect ${kernel_after}." >&2
  exit 1
fi

for stable_path in "${RAID_DISKS[@]}"; do
  disk="$(readlink -f "${stable_path}")"
  smartctl -H -l error "${disk}"
done
vcgencmd get_throttled
vcgencmd measure_temp
echo "Benchmark passed without PCIe/SATA/I/O errors. Results: ${result}"
