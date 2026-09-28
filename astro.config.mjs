import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ymihh.xyz',
  output: 'static',
  trailingSlash: 'always',
  markdown: { shikiConfig: { theme: 'github-light' } },
});
