import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (!site) {
    return new Response('User-agent: *\nAllow: /\n', { headers });
  }
  const base = import.meta.env.BASE_URL;
  const baseNorm = base === '/' ? '' : base.replace(/\/$/, '');
  const rel = `${baseNorm ? `${baseNorm.slice(1)}/` : ''}sitemap-index.xml`;
  const sitemapUrl = new URL(rel, site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, { headers });
};
