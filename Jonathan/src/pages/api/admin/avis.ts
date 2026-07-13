import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readSite, writeSite } from '../../../server/data-store';

export const prerender = false;

function parseAvis(fd: FormData) {
  const updated = [];
  let i = 0;
  while (fd.has(`t_${i}`)) {
    const t = fd.get(`t_${i}`)?.toString().trim();
    if (t) updated.push({ texte: t, auteur: fd.get(`au_${i}`)?.toString() || '' });
    i += 1;
  }
  return updated;
}

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const action = fd.get('action')?.toString() || 'save';
  const s = readSite();
  let avis = [...(s.avis || [])];

  const move = fd.get('move')?.toString();
  const idx = parseInt(fd.get('idx')?.toString() || '-1', 10);
  if (move && idx >= 0) {
    const j = move === 'up' ? idx - 1 : idx + 1;
    if (j >= 0 && j < avis.length) {
      [avis[idx], avis[j]] = [avis[j], avis[idx]];
    }
    s.avis = avis;
    writeSite(s);
    return redirectWithFlash('/admin/avis', 'Ordre mis à jour.');
  }

  if (fd.get('delete_avis') !== null) {
    avis.splice(parseInt(fd.get('delete_avis')!.toString(), 10), 1);
    s.avis = avis;
    writeSite(s);
    return redirectWithFlash('/admin/avis', 'Avis supprimé.');
  }

  avis = parseAvis(fd);
  if (action === 'add') {
    const t = fd.get('new_t')?.toString().trim();
    if (t) avis.push({ texte: t, auteur: fd.get('new_au')?.toString() || '' });
  }
  s.avis = avis;
  writeSite(s);
  return redirectWithFlash('/admin/avis', action === 'add' ? 'Avis ajouté.' : 'Avis enregistrés.');
});
