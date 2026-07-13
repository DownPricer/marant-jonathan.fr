import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

/** URL publique du site (canonical, sitemap, JSON-LD). Surcharge : SITE_URL=https://… */
const siteOrigin = (process.env.SITE_URL || 'https://marant-jonathan.fr').replace(/\/$/, '');

export default defineConfig({
  site: siteOrigin,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  compressHTML: true,
  build: { inlineStylesheets: 'auto' },
  security: {
    checkOrigin: true,
    allowedDomains: [
      { hostname: 'marant-jonathan.fr', protocol: 'https' },
      { hostname: 'www.marant-jonathan.fr', protocol: 'https' },
      { hostname: 'localhost', protocol: 'http' },
      { hostname: '127.0.0.1', protocol: 'http' },
    ],
  },
});
