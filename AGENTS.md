# Digital garden

- Public personal website for Study-ym, deployed to https://ymihh.xyz; GitHub Pages remains a local-only fallback.
- Astro 7 static output. Node 22.12+; use Node 24 for CI. Install with `npm ci`.
- `npm run dev` starts local development. Verified production preview: `npm run preview -- --port 4321` (localhost only).
- Relevant verification: `npm run check`, `npm test`, `npm run build`. Rebuild after source changes before testing production preview.
- Markdown collections live in `src/content/notes` and `src/content/ideas`; all public outputs must use `publicNotes` / `publicIdeas` from `src/lib/content.ts` to exclude drafts.
- `draft: true` is presentation filtering, not privacy: this GitHub repository is public.
- Preserve original JSON numeric tokens in the formatter; never parse/stringify user input as a formatting implementation (large IDs lose precision).
- JSON/time/URL tools remain browser-only and never persist or transmit inputs. The cycle calendar has two build modes: default GitHub Pages is local-only; `PUBLIC_GARDEN_CLOUD=true` enables same-origin authenticated server storage. Never put real health records in source code, server logs, Git or analytics; never upload old local records automatically.
- Cycle calendar logic: `src/lib/cycle.mjs`; UI/state: `src/scripts/cycle.ts`; shared minimal layout: `src/components/CyclePage.astro`; cloud route `/private/cycle/`, legacy Pages route `/tools/cycle/`. Backups are versioned, validated and require confirmation before replacing data. Maintain date-only arithmetic and overlap/ongoing-record invariants; do not add medical predictions. Server date validation uses Asia/Shanghai.
- Production domain is configured in `astro.config.mjs`; repository metadata is in `src/site.ts`. Internal links assume the root username.github.io site, not a repository subpath.
- Keep local screenshots, validation artifacts and unpublished delivery notes in ignored `artifacts/`.
- Cloud API: `server/app.mjs`, Node 24 built-ins, single owner, SQLite, exact Origin checks, secure host-only session cookies and atomic versions. Run `npm test` with loopback port access for real HTTP tests.
- Deploy with `PUBLIC_GARDEN_CLOUD=true npm run build`, generate CSP with `deploy/render-nginx.mjs`. Releases go to `/srv/garden/releases`, live symlink `/srv/garden/current`, private DB `/var/lib/garden`; never deploy over data. See `deploy/README.md`.
- Global company Git hooks remain enabled; do not alter them for this project.

- Public/private boundary: `/private/` pages use Nginx `auth_request` against `/api/auth/check`; data APIs independently verify sessions. Authenticated pages are no-store, noindex, excluded from public search and sitemap. Public GitHub content is never private, even if draft. Login return paths must use the allowlist in `src/lib/private-routes.mjs`.
