import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/** Déposez tout le dossier du projet sur Netlify : voir _redirects à la racine + npm run build:netlify-drop */
const netlifyDrop = process.env.NETLIFY_DROP === '1';
const siteUrl = process.env.SITE_URL || 'https://jonathan-artisan.fr';

export default defineConfig({
  site: siteUrl,
  base: netlifyDrop ? '/dist/' : '/',
  compressHTML: true,
  build: { inlineStylesheets: 'auto' },
  integrations: [sitemap()],
});
