/**
 * Libellés d’affichage pour les catégories de projets (accents, formulations SEO).
 */
export const CATEGORIE_LABELS: Record<string, string> = {
  menuiserie: 'Menuiserie',
  charpente: 'Charpente',
  ebenisterie: 'Ébénisterie',
  couverture: 'Couverture de toit',
  zinguerie: 'Zinguerie',
};

export function labelCategorie(id: string): string {
  const k = id.trim().toLowerCase();
  return CATEGORIE_LABELS[k] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
