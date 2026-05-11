import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/** Déposez tout le dossier du projet sur Netlify : voir _redirects à la racine + npm run build:netlify-drop */
const netlifyDrop = process.env.NETLIFY_DROP === '1';
const siteUrl = (process.env.SITE_URL || 'https://jonathan-artisan.fr').replace(/\/+$/, '');

const __dirname = dirname(fileURLToPath(import.meta.url));
const projets = JSON.parse(readFileSync(join(__dirname, 'src', 'data', 'projets.json'), 'utf8'));

function siteOriginFallback() {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return 'https://jonathan-artisan.fr';
  }
}

/** Préfixe d’URL pour les assets statiques (/images/…) selon le déploiement (racine ou /dist/). */
function assetBase(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (u.pathname.startsWith('/dist/') || u.pathname === '/dist') {
      return `${u.origin}/dist`;
    }
    return u.origin;
  } catch {
    return siteOriginFallback();
  }
}

/** Entrées `<image:image>` pour le sitemap (Google Images). */
function imagesForSitemapEntry(item) {
  const base = assetBase(item.url);
  let path = '';
  try {
    path = new URL(item.url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return [];
  }

  if (path === '/' || path === '/dist') {
    return [
      { url: `${base}/images/logo-mj.png`, title: 'Logo', caption: 'Marant Jonathan Menuiserie' },
      {
        url: `${base}/images/projets/escalier-colimacon/01.webp`,
        title: 'Réalisation artisanale',
        caption: 'Menuiserie, charpente et travaux du bois',
      },
    ];
  }

  const isRealisationsIndex =
    path === '/realisations' ||
    path === '/dist/realisations' ||
    path.endsWith('/realisations');

  if (isRealisationsIndex) {
    return projets.slice(0, 30).map((p) => {
      const webp = p.couverture.replace(/\.(jpe?g|png)$/i, '.webp');
      return {
        url: `${base}/images/projets/${p.slug}/${webp}`,
        title: p.titre,
        caption: p.description.slice(0, 100),
      };
    });
  }

  const m = path.match(/\/(?:dist\/)?realisations\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    const p = projets.find((x) => x.slug === slug);
    if (!p) return [];
    return p.images.slice(0, 15).map((file) => {
      const webp = file.replace(/\.(jpe?g|png)$/i, '.webp');
      return {
        url: `${base}/images/projets/${slug}/${webp}`,
        title: p.titre,
        caption: p.description.slice(0, 120),
      };
    });
  }

  return [];
}

export default defineConfig({
  site: siteUrl,
  base: netlifyDrop ? '/dist/' : '/',
  compressHTML: true,
  build: { inlineStylesheets: 'auto' },
  integrations: [
    sitemap({
      namespaces: {
        news: false,
        video: false,
        xhtml: true,
        image: true,
      },
      filter: (page) =>
        !page.includes('/mentions-legales') &&
        !page.includes('/politique-confidentialite'),
      serialize(item) {
        let path = '';
        try {
          path = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        } catch {
          return item;
        }

        let next = { ...item };
        if (path === '/' || path === '/dist') {
          next = { ...next, priority: 1, changefreq: 'weekly' };
        } else if (/\/(?:dist\/)?realisations\/[^/]+$/.test(path)) {
          next = { ...next, priority: 0.75, changefreq: 'monthly' };
        } else if (
          path === '/realisations' ||
          path === '/dist/realisations' ||
          path.endsWith('/realisations')
        ) {
          next = { ...next, priority: 0.9, changefreq: 'weekly' };
        } else {
          next = { ...next, priority: 0.7, changefreq: 'monthly' };
        }

        const imgs = imagesForSitemapEntry(item);
        if (imgs.length) {
          next.img = imgs;
        }
        return next;
      },
    }),
  ],
});
