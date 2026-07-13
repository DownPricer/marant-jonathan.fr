import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readSite, writeSite } from '../../../server/data-store';

export const prerender = false;

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const s = readSite();
  s.aPropos = s.aPropos || { paragraphe1: '', paragraphe2: '', certifications: [] };
  s.aPropos.paragraphe1 = fd.get('p1')?.toString() || '';
  s.aPropos.paragraphe2 = fd.get('p2')?.toString() || '';
  const certs: string[] = [];
  let ci = 0;
  while (fd.has(`cert_${ci}`)) {
    const v = fd.get(`cert_${ci}`)?.toString().trim();
    if (v) certs.push(v);
    ci += 1;
  }
  if (certs.length) s.aPropos.certifications = certs;
  writeSite(s);
  return redirectWithFlash('/admin/apropos', 'Page À propos enregistrée.');
});
