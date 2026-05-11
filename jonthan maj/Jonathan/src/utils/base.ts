/**
 * Préfixe un chemin absolu (/) avec `import.meta.env.BASE_URL`.
 * Nécessaire pour `npm run build:netlify-drop` (site servi sous /dist/).
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return base + p;
}

/** Incrémenter après remplacement d’images dans `public/` (évite cache CDN / navigateur sur les mêmes URLs). */
export const AVATAR_IMAGE_REV = '4';

/** Ajoute `?v=` pour forcer le rechargement des assets statiques. */
export function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${AVATAR_IMAGE_REV}`;
}
