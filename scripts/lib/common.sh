# shellcheck shell=bash
# Shared paths and helpers for the homelab-nas scripts.

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  echo "source scripts/lib/common.sh from another script" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
# Used by every script that sources this file.
# shellcheck disable=SC2034
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

require_root() {
  if [[ ${EUID} -ne 0 ]]; then
    exec sudo "$0" "$@"
  fi
}

interface_for_mac() {
  local expected_mac="${1,,}"
  local interface_path interface
  for interface_path in /sys/class/net/*; do
    [[ -r ${interface_path}/address ]] || continue
    interface="$(basename "${interface_path}")"
    [[ $(<"${interface_path}/address") == "${expected_mac}" ]] || continue
    printf '%s\n' "${interface}"
    return 0
  done
  return 1
}

jmb585_pci_slot() {
  lspci -Dnn | awk '/JMicron.*JMB585|JMicron.*SATA/ {print $1; exit}'
}
