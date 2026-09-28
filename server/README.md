# Private garden API

Requires **Node 24 LTS**; locally verified with Node 24.15.0. Uses only Node built-ins. Nginx serves the existing static site and proxies `/api/` to `127.0.0.1:8787`. This process does not serve files, expose the database, or open a public listening address.

```sh
GARDEN_DATA_DIR=/var/lib/garden GARDEN_ORIGIN=https://ymihh.xyz node server/index.mjs
```

Run as a dedicated unprivileged service account. Keep `/var/lib/garden` outside the release and web root, owned by that account. This directory is forced to mode `0700`; database and setup token are `0600`. Set `UMask=0077` for the service. Nginx should enforce a 1 MiB request limit, HTTPS, no API access logging and a request rate limit. Do not cache `/api/`. Canonicalize `www` to the configured exact origin before serving the application. No cross-origin CORS is provided.

## First account

On first start the service creates `/var/lib/garden/setup-token`, containing a 256-bit random initialization secret. It is never logged. Transfer it only through a trusted admin connection into the HTTPS setup form. Do not put it in source control, screenshots, URLs or chat messages. The token plus username and password initialize the single owner and create a session. Initialization is disabled permanently once a user exists. An ordinary restart cannot recreate this privilege. The token file is then removed.

This release supports **one private account**, not multiple users or shared records. Only authenticated sessions for that owner can access records. Sessions last 30 days, use opaque random tokens with database-side SHA-256 hashes, and are sent in `__Host-` cookies with Secure, HttpOnly, SameSite=Lax and Path=/. Passwords use asynchronous scrypt (N=65536, r=8, p=2) with independent random salts. At most two password hashes execute concurrently. A shared limit of 30 auth attempts per 15 minutes bounds resource use; restarting resets this in-memory limit, so Nginx should also limit requests.

## API

- `GET /api/health`: `{ok:true}`
- `GET /api/session`: `{user:null|{id,username},setupRequired:boolean}`
- `POST /api/auth/setup`: `{token,username,password}`
- `POST /api/auth/login`: `{username,password}`
- `POST /api/auth/logout`: `{}`
- `GET /api/cycle`: `{version,records}`
- `PUT /api/cycle`: `{version,records}` returns the new version and normalized records. Stale versions return HTTP 409 without changing data.

Every write requires exact `Origin: https://ymihh.xyz` (or the configured origin) and `Content-Type: application/json`. Error bodies use `{error:"message"}`. Usernames: 3–40 ASCII letters/digits/underscore/hyphen; initial passwords: 12–128 characters. Validation uses date-only arithmetic and today's date in Asia/Shanghai. Records are capped at 1000. Responses have `Cache-Control: no-store`; requests and health data are not logged by the application.

## Backup and recovery

Generate a new consistent SQLite backup, never copy an active database file directly:

```sh
GARDEN_DATA_DIR=/var/lib/garden node server/backup.mjs /var/backups/garden/garden-20260928.sqlite
```

The command uses `VACUUM INTO` and verifies `PRAGMA integrity_check`. It refuses to overwrite existing files. Backups contain **private records, password hashes and session hashes**: encrypt them before transferring to private off-server storage. A backup on the same disk does not protect against losing the server. Automated off-server backup requires a configured private destination; this API alone does not establish that destination. The daily wrapper below manages only local backups.

The daily wrapper defaults to `/var/lib/garden` and respects the same `GARDEN_DATA_DIR` environment variable:

```sh
GARDEN_DATA_DIR=/var/lib/garden node server/backup-daily.mjs
```

It writes `backups/garden-YYYYMMDDTHHmmssSSSZ.sqlite`, verifies the new backup, then deletes only regular files matching its own valid timestamp naming scheme older than 30 days. If backup creation fails it does not prune old copies. For a systemd oneshot unit use `EnvironmentFile=/etc/garden.env`, the same service user and `UMask=0077`, and `ExecStart=/absolute/path/to/node /opt/garden/current/server/backup-daily.mjs`. A timer may invoke it daily; use the actual installed Node path and release path. Local backups do not replace off-server backups.

For restore, stop the API first. Preserve the current data directory for rollback, verify the selected backup, and restore it as `garden.sqlite` into a clean private directory owned by the service account (no old WAL/SHM files). Delete restored sessions before starting so an old logout cannot be undone by restoring a backup. Restart and verify login, data and health. Never restore over a running process.

## Verification

```sh
node --test tests/server.test.mjs
```

Tests use disposable local databases and actual loopback HTTP requests. They cover anonymous access denial, origin/content-type checks, setup token use, one-time initialization, login/logout, session persistence, concurrent version conflict, invalid record rejection, restart persistence, live-database backup integrity and auth/body limits. They do not verify production TLS, Nginx, firewall, deployment or off-server backup.
