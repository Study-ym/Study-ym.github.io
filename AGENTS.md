# Digital garden

- Public personal website for Study-ym, deployed to https://study-ym.github.io.
- Astro 7 static output. Node 22.12+; use Node 24 for CI. Install with `npm ci`.
- `npm run dev` starts local development. Verified production preview: `npm run preview -- --port 4321` (localhost only).
- Relevant verification: `npm run check`, `npm test`, `npm run build`. Rebuild after source changes before testing production preview.
- Markdown collections live in `src/content/notes` and `src/content/ideas`; all public outputs must use `publicNotes` / `publicIdeas` from `src/lib/content.ts` to exclude drafts.
- `draft: true` is presentation filtering, not privacy: this GitHub repository is public.
- Preserve original JSON numeric tokens in the formatter; never parse/stringify user input as a formatting implementation (large IDs lose precision).
- Tools operate entirely in the browser and must not transmit input. JSON/time/URL tools do not persist input. The explicitly local-only cycle calendar at `/tools/cycle/` persists only date records in browser localStorage; never place actual records in source code, server logs, Git or analytics.
- Cycle calendar logic: `src/lib/cycle.mjs`; UI/state: `src/scripts/cycle.ts`; separate minimal layout: `src/pages/tools/cycle/index.astro`. Backups are versioned, validated and require confirmation before replacing data. Maintain local-date arithmetic and overlap/ongoing-record invariants; do not add medical predictions.
- Production domain is configured in `astro.config.mjs`; repository metadata is in `src/site.ts`. Internal links assume the root username.github.io site, not a repository subpath.
- Keep local screenshots, validation artifacts and unpublished delivery notes in ignored `artifacts/`.
- Global company Git hooks remain enabled; do not alter them for this project.
