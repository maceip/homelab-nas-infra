#!/bin/sh
# Run as root on the Pi from this app's release directory.
set -eu
apt-get install -y python3-aiosmtpd
install -d -m 0755 /opt/pi-observability
install -d -o pi -g pi -m 0750 /var/lib/pi-observability
install -m 0644 server/telemetry.py /opt/pi-observability/telemetry.py
if [ ! -f /var/lib/pi-observability/router-tls.key ]; then
  umask 077
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /var/lib/pi-observability/router-tls.key \
    -out /var/lib/pi-observability/router-tls.crt -days 3650 \
    -subj /CN=pi-router-logs.local -addext subjectAltName=IP:192.168.0.56
  chown pi:pi /var/lib/pi-observability/router-tls.key /var/lib/pi-observability/router-tls.crt
fi
install -m 0644 deploy/pi-observability.service deploy/pi-router-logs.service /etc/systemd/system/
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=persistent\nSystemMaxUse=512M\nMaxRetentionSec=90day\nSyncIntervalSec=15s\n' > /etc/systemd/journald.conf.d/95-pi-observability.conf
systemctl restart systemd-journald
systemctl daemon-reload
systemctl enable pi-observability pi-router-logs
systemctl restart pi-observability pi-router-logs
