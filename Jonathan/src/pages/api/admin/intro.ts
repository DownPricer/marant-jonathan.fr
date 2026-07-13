import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readSite, writeSite } from '../../../server/data-store';

export const prerender = false;

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const s = readSite();
  s.titre = fd.get('titre')?.toString() ?? s.titre;
  s.sousTitre = fd.get('sousTitre')?.toString() ?? s.sousTitre;
  s.baseline = fd.get('baseline')?.toString() ?? s.baseline;
  s.introAccueil = {
    paragraphe1: fd.get('p1')?.toString() || '',
    paragraphe2: fd.get('p2')?.toString() || '',
    zone: fd.get('zone')?.toString() || '',
    cta: fd.get('cta')?.toString() || '',
  };
  writeSite(s);
  return redirectWithFlash('/admin/intro', "Texte d'accueil enregistré.");
});
