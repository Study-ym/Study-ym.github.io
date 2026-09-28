#!/usr/bin/env bash
set -euo pipefail
archive=${1:?archive required}
release=${2:?release id required}
[[ "$release" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
root=/srv/garden
release_dir="$root/releases/$release"
[[ ! -e "$release_dir" ]] || { echo 'Release already exists' >&2; exit 2; }
previous=$(readlink "$root/current" || true)
install -d -m 755 "$release_dir"
tar -xzf "$archive" -C "$release_dir" --no-same-owner
chmod -R go-w "$release_dir"
/usr/bin/node "$release_dir/deploy/render-nginx.mjs" "$release_dir/dist" > "$release_dir/deploy/nginx-rendered.conf"
cp /etc/nginx/conf.d/garden.conf /etc/nginx/conf.d/garden.conf.rollback
install -m 644 "$release_dir/deploy/nginx-rendered.conf" /etc/nginx/conf.d/garden.conf
if ! nginx -t; then cp /etc/nginx/conf.d/garden.conf.rollback /etc/nginx/conf.d/garden.conf; exit 1; fi
install -m 644 "$release_dir/deploy/garden.service" /etc/systemd/system/garden.service
install -m 644 "$release_dir/deploy/garden-backup.service" /etc/systemd/system/garden-backup.service
install -m 644 "$release_dir/deploy/garden-backup.timer" /etc/systemd/system/garden-backup.timer
ln -s "$release_dir" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
systemctl daemon-reload
systemctl enable garden.service
systemctl restart garden.service
healthy=false
for attempt in {1..15}; do if curl -fsS http://127.0.0.1:8787/api/health >/dev/null; then healthy=true; break; fi; sleep 1; done
if [[ "$healthy" != true ]]; then
  if [[ -n "$previous" ]]; then ln -s "$previous" "$root/current.next"; mv -Tf "$root/current.next" "$root/current"; systemctl restart garden.service; fi
  cp /etc/nginx/conf.d/garden.conf.rollback /etc/nginx/conf.d/garden.conf
  echo 'API health check failed; previous configuration restored' >&2
  exit 1
fi
systemctl reload nginx
systemctl enable --now garden-backup.timer
systemctl start garden-backup.service
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\n/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/garden-nginx
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/garden-nginx
systemctl enable --now certbot-renew.timer
printf 'Deployed %s\n' "$release"
systemctl is-active garden nginx
