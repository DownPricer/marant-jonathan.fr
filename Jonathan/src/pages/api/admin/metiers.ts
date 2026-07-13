import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readSite, writeSite } from '../../../server/data-store';

export const prerender = false;

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const s = readSite();
  s.metiers = s.metiers.map((m, i) => ({
    ...m,
    sousTitre: fd.get(`metier_${i}_sousTitre`)?.toString() ?? m.sousTitre,
    description: fd.get(`metier_${i}_description`)?.toString() ?? m.description,
    alt: fd.get(`metier_${i}_alt`)?.toString() ?? m.alt,
  }));
  writeSite(s);
  return redirectWithFlash('/admin/metiers', 'Services enregistrés.');
});
