# Digital garden

- Public personal website for Study-ym, deployed to https://study-ym.github.io.
- Astro 7 static output. Node 22.12+; use Node 24 for CI. Install with `npm ci`.
- `npm run dev` starts local development. Verified production preview: `npm run preview -- --port 4321` (localhost only).
- Relevant verification: `npm run check`, `npm test`, `npm run build`. Rebuild after source changes before testing production preview.
- Markdown collections live in `src/content/notes` and `src/content/ideas`; all public outputs must use `publicNotes` / `publicIdeas` from `src/lib/content.ts` to exclude drafts.
- `draft: true` is presentation filtering, not privacy: this GitHub repository is public.
- Preserve original JSON numeric tokens in the formatter; never parse/stringify user input as a formatting implementation (large IDs lose precision).
- Tools operate entirely in the browser and must not transmit or persist input.
- Production domain is configured in `astro.config.mjs`; repository metadata is in `src/site.ts`. Internal links assume the root username.github.io site, not a repository subpath.
- Keep local screenshots, validation artifacts and unpublished delivery notes in ignored `artifacts/`.
- Global company Git hooks remain enabled; do not alter them for this project.
