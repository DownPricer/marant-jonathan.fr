import type { APIRoute } from 'astro';
import { readProjetImage } from '../../../../server/images';

export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const slug = params.slug || '';
  const file = params.file || '';
  const result = readProjetImage(slug, file);
  if (!result) return new Response('Not found', { status: 404 });
  return new Response(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': result.mime,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
};
