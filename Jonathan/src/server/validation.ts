import type { ProjetData, SiteData } from '../types/content';
import { VALID_CATEGORIES } from '../types/content';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TEXT = 8000;
const MAX_SHORT = 500;

export function cleanPhone(value: string): string {
  return value.replace(/[^\d+\s().-]/g, '').trim().slice(0, 40);
}

export function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUrl(value: string): boolean {
  if (!value?.trim()) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateSlug(slug: string): void {
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error('Slug invalide (lettres minuscules, chiffres et tirets uniquement).');
  }
}

/** Slug saisi par l'utilisateur : doit déjà être valide, pas seulement normalisable. */
export function parseSlugInput(raw: string): string {
  const slug = raw.trim().toLowerCase();
  validateSlug(slug);
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    throw new Error('Slug invalide.');
  }
  return slug;
}

export function validateSiteData(data: SiteData): SiteData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Données site invalides.');
  }
  if (!data.nom?.trim()) throw new Error('Le nom du site est obligatoire.');
  if (!Array.isArray(data.metiers)) throw new Error('Le champ metiers doit être un tableau.');
  if (data.email && !isValidEmail(data.email)) throw new Error('Email invalide.');
  if (data.facebookUrl && !isValidUrl(data.facebookUrl)) throw new Error('URL Facebook invalide.');
  if (data.googleAvisUrl && !isValidUrl(data.googleAvisUrl)) throw new Error('URL Google Avis invalide.');
  if (data.pagesJaunesUrl && !isValidUrl(data.pagesJaunesUrl)) throw new Error('URL Pages Jaunes invalide.');
  if (data.telephone) data.telephone = cleanPhone(data.telephone);
  if (data.nom.length > MAX_SHORT) throw new Error('Nom trop long.');
  return data;
}

export function validateProjetsData(data: ProjetData[]): ProjetData[] {
  if (!Array.isArray(data)) throw new Error('Données projets invalides.');
  const slugs = new Set<string>();
  for (const p of data) {
    if (!p?.slug?.trim()) throw new Error('Chaque projet doit avoir un slug.');
    validateSlug(p.slug);
    if (slugs.has(p.slug)) throw new Error(`Slug dupliqué : ${p.slug}`);
    slugs.add(p.slug);
    if (!p.titre?.trim()) throw new Error(`Titre obligatoire pour ${p.slug}.`);
    if (!VALID_CATEGORIES.includes(p.categorie as (typeof VALID_CATEGORIES)[number])) {
      throw new Error(`Catégorie invalide pour ${p.slug}.`);
    }
    const cats = p.categories?.length ? p.categories : [p.categorie];
    for (const c of cats) {
      if (!VALID_CATEGORIES.includes(c as (typeof VALID_CATEGORIES)[number])) {
        throw new Error(`Catégorie multiple invalide pour ${p.slug}.`);
      }
    }
    p.categories = [...new Set(cats)];
    if (p.description.length > MAX_TEXT) throw new Error(`Description trop longue pour ${p.slug}.`);
    if (!Array.isArray(p.images)) p.images = [];
    p.images = p.images.map((i) => String(i).trim()).filter(Boolean);
  }
  return data;
}

export function stripUnknownSiteFields(data: Record<string, unknown>, template: SiteData): SiteData {
  const out = structuredClone(template);
  const allowed = new Set(Object.keys(template));
  for (const key of allowed) {
    if (key in data) (out as Record<string, unknown>)[key] = data[key];
  }
  return out as SiteData;
}
