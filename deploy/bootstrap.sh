#!/usr/bin/env bash
set -euo pipefail
id garden >/dev/null 2>&1 || sudo -n useradd --system --home-dir /var/lib/garden --shell /sbin/nologin garden
sudo -n install -d -m 755 /srv/garden/releases /var/www/letsencrypt/.well-known/acme-challenge
sudo -n install -d -o garden -g garden -m 700 /var/lib/garden
sudo -n install -m 644 /tmp/garden-nginx-http.conf /etc/nginx/conf.d/garden.conf
sudo -n nginx -t
sudo -n systemctl enable --now nginx
sudo -n nginx -s reload
