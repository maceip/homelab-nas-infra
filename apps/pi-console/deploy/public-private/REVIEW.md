# Public/private dashboard deployment — 2026-09-15

Live release: `/opt/pi-console/releases/20260915-public-private`.
Source: `/Users/mac/homelab-nas-infra/apps/pi-console`.

## Access boundaries

| Connection | Address selected by DNS | Experience |
|---|---|---|
| Internet | 164.152.137.196 | Read-only metrics and Anubis-protected upload inbox |
| Home Wi-Fi, using Pi DNS | 192.168.0.56 | Same public experience, without internet hairpinning |
| Tailnet, using Tailscale DNS | 100.64.0.1 | Private settings, service controls, full file widget, received-upload inbox |

All use `https://matts.public.computer`. No exit node or default internet route was added. Tailnet membership is the administrative trust boundary: enrolled peers must be trusted. Devices that disable Tailscale DNS or use their own encrypted DNS may receive the public experience instead. Router DHCP/DNS changes are being handled by the owner; the Pi's UDP/TCP DNS override is installed and ordinary DNS forwarding also works. Reserve 192.168.0.56 on the router, advertise it as DNS, and renew client leases. Avoid a public secondary DNS server if consistent local resolution is required.

Public Caddy port 443 proxies a separate loopback application on 19110. The private application remains on loopback 19100, reached only through tailnet TCP 443 -> loopback TLS 19443. Full files are loopback 8080 behind the audited private gateway. Public requests cannot switch modes by supplying a header. Headscale coordination endpoints remain available at the original hostname; its admin API is not publicly proxied.

The custom Tailscale socket is `/home/pi/upstream-software/state/tailscale/tailscaled.sock`. Both Funnel and Serve status commands were executed against it. Neither configuration has enabled AllowFunnel entries. Serve contains TCP application forwards, not filesystem paths. Actual listeners and command outputs are in `host-audit.json`.

## Public inbox

Anubis 1.27.0 ARM64, official release SHA256 `3091be707f9454d172cbe611f36ea74046701d735b4a574c99cee6e41884ecb1`. Every inbox visitor is challenged, without search-bot exemptions. Difficulty 4, five-minute secure proof cookie. Proof of work raises the cost of abuse; it is not identity verification or a guarantee against spam.

Limit is exactly 50,000,000 bytes per file; ten attempts/hour/address, two concurrent uploads, 2 GB total outstanding content, bounded transfer times, seven-day retention with hourly cleanup. Uploaded content uses opaque generated paths outside the NAS share. The public application cannot list or download uploads. The private dashboard lists received files and serves them as download attachments. A post-commit disconnect remains counted against quota.

Public applications run as separate unprivileged users. The metrics HTTP process has fixed GET routes and an asset allowlist, no command execution, no home/NAS/Docker-socket access, and only a sanitized metric snapshot. The separate collector reads approved host telemetry and writes that snapshot; its command-reading code is not reachable through the public API. Public data excludes host addresses, peers, service configuration and security logs. Private controls use a Unix-socket broker with fixed service IDs and verbs; connectivity services are protected.

HTTPS responses include one-year HSTS, a restrictive CSP, no-sniff, no-referrer and frame protections. Only the private file widget permits same-origin framing. Certificates are automatically managed by Caddy; TLS-ALPN-01 issuance on public 443 succeeded. HTTP-01 port 80 was unavailable, and is not required for the successful TLS challenge.

## Verification performed

- Production React build passed; 28 frontend tests and 51 backend tests passed.
- Public site loaded in a real browser at phone and desktop widths. No horizontal overflow or public file iframe. Full-page browser screenshot stitching was unreliable; the actual viewport and DOM dimensions were checked directly.
- External Tor-exit HTTPS requests reached the public listener both before and after reboot, with TLS certificate validation enabled. Headers retained in the work evidence files.
- Public private-API, files, sensitive-path and traversal requests returned 403/404, including forged tailnet identity/address headers. Public metrics contained only the allowed schema.
- Real Anubis proof solved and accepted. Exactly 50 MB uploaded successfully. 50,000,001 bytes rejected with HTTP 413. Direct POST without a proof received a challenge.
- Private downloaded test upload was exactly 50 MB with SHA256 `a038789e3907dd531c77c65586127e35f86cb1502fcb72fb7162612e91ebe62f`.
- Private settings saved and restored. Missing CSRF, foreign Origin, and protected Tailscale stop were rejected. Allowlisted OpenCanary restart succeeded. Full file HTML loaded and framing policy allowed the widget.
- Independent ephemeral tailnet peer enrolled, exchanged encrypted traffic, loaded private HTTPS and the full file page, and received DNS A=100.64.0.1 from the actual Tailscale resolver. Temporary credentials/peer were removed. The userspace SOCKS hostname lookup returned the public path, so the private HTTPS probe explicitly used the returned overlay IP while preserving hostname/SNI. This is not a completed phone/browser OS-DNS test; actual phones were not operated.
- A real SMB connection produced `smbd_audit` events, which reached the dashboard collector. Gateway denials, file operations, uploads and service changes also reached the collector. Controlled verification requests account for some new denial/burst events; those are not evidence of compromise.
- Pi reboot completed. Every dashboard component, Headscale, Tailscale, DNS, Nebula, OpenCanary and full file service recovered. No failed systemd units at the final check. Four-member RAID0 reassembled and mounted with expected XFS UUID `6de5180a-92a5-4818-b664-e0a3842f760e`.
- `cgroup_enable=memory` restored the memory controller. An isolated 128 MB allocation under a 64 MB/zero-swap limit was killed at exactly 67,108,864 bytes. Actual application memory accounting is now populated. The intentional test unit was cleared afterward.

## Operational fixes

Namespace readiness now starts dependent Nebula/OpenCanary applications after their DHCP namespace becomes ready, including retries. LAN-bound services wait for the configured address using a sandbox-compatible socket check. Storage readiness checks expected filesystem identity. Samba retains its existing Apple metadata VFS modules and adds selected full-audit operations. Journals are persistent and capped at 512 MB with a 14-day maximum age. Security graphs retain threshold-based warnings rather than treating each denied SSH attempt as compromise.

## Remaining limitations

- Owner is handling router DNS/DHCP changes and router settings. This work does not prove the router's complete forwarding/remote-management configuration was reviewed. Only the intended public HTTPS path was exercised externally.
- No off-device backup destination has been supplied. RAID0 is not a backup; off-device backup and restore verification remain outstanding.
- No actual phone was used for the final tailnet browser/DNS check. Clients must accept Tailscale DNS to select the private interface under the shared hostname.
- No PCIe-generation change or new disk stress test was performed in this deployment. A successful reboot/readable array does not establish long-term drive reliability.
- Existing services requiring owner accounts, radio hardware, or separate service setup remain subject to those prerequisites. Publishing the dashboard does not complete those accounts.

Primary references: [Tailscale Serve](https://tailscale.com/docs/reference/examples/serve), [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel), [Anubis pinned policies](https://github.com/TecharoHQ/anubis/blob/v1.27.0/docs/docs/admin/policies.mdx), [Headscale DNS](https://headscale.net/stable/ref/dns/).
