import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readProjets } from '../../../server/data-store';
import { saveProjetUpload } from '../../../server/images';

export const prerender = false;

export const POST = adminGuard(async ({ request }) => {
  const maxBytes = parseInt(process.env.MAX_UPLOAD_MB || '10', 10) * 1024 * 1024;
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${maxBytes / 1024 / 1024} Mo).`);
  }

  const fd = await request.formData();
  const slug = fd.get('slug')?.toString() || '';
  const file = fd.get('file');
  if (!(file instanceof File)) throw new Error('Fichier manquant.');
  if (file.size > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${maxBytes / 1024 / 1024} Mo).`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = saveProjetUpload(slug, file.name, buffer);

  const projets = readProjets();
  const idx = projets.findIndex((p) => p.slug === slug);
  const returnPath = fd.get('return')?.toString() || (idx >= 0 ? `/admin/projets/${idx}/edit` : '/admin/projets');

  if (idx >= 0 && !projets[idx].images.includes(saved.fileName)) {
    projets[idx].images.push(saved.fileName);
    if (!projets[idx].couverture) projets[idx].couverture = saved.fileName;
    const { writeProjets } = await import('../../../server/data-store');
    writeProjets(projets);
  }

  return redirectWithFlash(returnPath, `Image ${saved.fileName} téléversée.`);
});
