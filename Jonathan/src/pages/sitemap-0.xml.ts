import type { APIRoute } from 'astro';
import { readProjets } from '../server/data-store';

export const prerender = false;

const STATIC_PATHS = [
  '/',
  '/a-propos',
  '/contact',
  '/realisations',
  '/mentions-legales',
  '/politique-confidentialite',
];

export const GET: APIRoute = ({ site, request }) => {
  const origin = site?.href || new URL(request.url).origin;
  const projets = readProjets();
  const urls = [
    ...STATIC_PATHS.map((p) => ({ loc: `${origin}${p}`, priority: p === '/' ? '1.0' : '0.8' })),
    ...projets.map((p) => ({
      loc: `${origin}/realisations/${p.slug}`,
      priority: '0.7',
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
