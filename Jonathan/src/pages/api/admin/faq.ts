import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readSite, writeSite } from '../../../server/data-store';

export const prerender = false;

function parseFaq(fd: FormData) {
  const updated = [];
  let i = 0;
  while (fd.has(`q_${i}`)) {
    const q = fd.get(`q_${i}`)?.toString().trim();
    if (q) updated.push({ question: q, answer: fd.get(`a_${i}`)?.toString() || '' });
    i += 1;
  }
  return updated;
}

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const action = fd.get('action')?.toString() || 'save';
  const s = readSite();
  let faq = [...(s.faq || [])];

  const move = fd.get('move')?.toString();
  const idx = parseInt(fd.get('idx')?.toString() || '-1', 10);
  if (move && idx >= 0) {
    const j = move === 'up' ? idx - 1 : idx + 1;
    if (j >= 0 && j < faq.length) {
      [faq[idx], faq[j]] = [faq[j], faq[idx]];
    }
    s.faq = faq;
    writeSite(s);
    return redirectWithFlash('/admin/faq', 'Ordre mis à jour.');
  }

  if (fd.get('delete_faq') !== null) {
    faq.splice(parseInt(fd.get('delete_faq')!.toString(), 10), 1);
    s.faq = faq;
    writeSite(s);
    return redirectWithFlash('/admin/faq', 'Question supprimée.');
  }

  faq = parseFaq(fd);
  if (action === 'add') {
    const q = fd.get('new_q')?.toString().trim();
    if (q) faq.push({ question: q, answer: fd.get('new_a')?.toString() || '' });
  }
  s.faq = faq;
  writeSite(s);
  return redirectWithFlash('/admin/faq', action === 'add' ? 'Question ajoutée.' : 'FAQ enregistrée.');
});
