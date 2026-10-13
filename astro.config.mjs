import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://raison-institut.fr',
  base: process.env.SITE_BASE || '/',
  output: 'static',
  trailingSlash: 'always',
  redirects: { '/publications/': '/productions/' },
});
