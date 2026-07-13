import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ site, request }) => {
  const origin = site?.href || new URL(request.url).origin;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${origin}/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
