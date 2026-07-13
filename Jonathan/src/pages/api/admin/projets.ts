import type { APIRoute } from 'astro';
import { adminGuard, errorResponse, redirectWithFlash } from '../../../server/api-helpers';
import { readProjets, writeProjets } from '../../../server/data-store';
import { parseSlugInput } from '../../../server/validation';
import { VALID_CATEGORIES } from '../../../types/content';
import type { ProjetData } from '../../../types/content';

export const prerender = false;

function parseCategories(raw: string | null | undefined, fallback: string): string[] {
  const list = (raw || fallback)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const unique = [...new Set(list.length ? list : [fallback])];
  for (const c of unique) {
    if (!VALID_CATEGORIES.includes(c as (typeof VALID_CATEGORIES)[number])) {
      throw new Error(`Catégorie invalide : ${c}`);
    }
  }
  return unique;
}

function projetFromForm(fd: FormData, base?: ProjetData): ProjetData {
  const slugRaw = fd.get('slug')?.toString()?.trim() || base?.slug || '';
  if (!slugRaw) throw new Error('Slug obligatoire.');
  const slug = parseSlugInput(slugRaw);
  const categorie = fd.get('categorie')?.toString() || base?.categorie || 'menuiserie';
  const categories = parseCategories(fd.get('categories')?.toString(), categorie);
  return {
    slug,
    titre: fd.get('titre')?.toString() || base?.titre || '',
    description: fd.get('description')?.toString() || base?.description || '',
    categorie,
    categories,
    annee: fd.get('annee')?.toString() || base?.annee || '',
    lieu: fd.get('lieu')?.toString() || base?.lieu || '',
    couverture: fd.get('couverture')?.toString() || base?.couverture || '01.jpeg',
    vedette: fd.get('vedette') === '1' || fd.get('vedette') === 'on',
    video: base?.video ?? null,
    images: (fd.get('images')?.toString() || (base?.images || []).join('\n'))
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    ordre: base?.ordre,
  };
}

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const action = fd.get('action')?.toString() || 'save';
  const projets = readProjets();

  if (action === 'delete') {
    const slug = fd.get('slug')?.toString();
    const next = projets.filter((p) => p.slug !== slug);
    if (next.length === projets.length) throw new Error('Projet introuvable.');
    writeProjets(next);
    return redirectWithFlash('/admin/projets', 'Projet supprimé.');
  }

  if (action === 'reorder') {
    const slug = fd.get('slug')?.toString();
    const dir = fd.get('dir')?.toString();
    const i = projets.findIndex((p) => p.slug === slug);
    if (i < 0) throw new Error('Projet introuvable.');
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < projets.length) {
      [projets[i], projets[j]] = [projets[j], projets[i]];
      writeProjets(projets);
    }
    return redirectWithFlash('/admin/projets', 'Ordre mis à jour.');
  }

  const idxStr = fd.get('idx')?.toString();
  if (action === 'create') {
    const p = projetFromForm(fd);
    if (projets.some((x) => x.slug === p.slug)) throw new Error('Ce slug existe déjà.');
    writeProjets([...projets, p]);
    return redirectWithFlash('/admin/projets', 'Projet créé.');
  }

  const idx = idxStr ? parseInt(idxStr, 10) : -1;
  if (idx < 0 || !projets[idx]) throw new Error('Projet introuvable.');
  const updated = projetFromForm(fd, projets[idx]);
  if (updated.slug !== projets[idx].slug && projets.some((p, k) => k !== idx && p.slug === updated.slug)) {
    throw new Error('Ce slug existe déjà.');
  }
  projets[idx] = updated;
  writeProjets(projets);
  return redirectWithFlash(`/admin/projets/${idx}/edit`, 'Projet enregistré.');
});

export const GET = adminGuard(async () => errorResponse('Méthode non autorisée.', 405));
