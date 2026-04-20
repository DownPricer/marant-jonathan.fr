/**
 * Extrait les libellés métiers depuis `sousTitre` (ex. « A · B · C - D - E »).
 */
export function metiersLabelsFromSousTitre(sousTitre: string): string[] {
  return sousTitre
    .split(/\s*·\s*/)
    .flatMap((segment) => {
      const s = segment.trim();
      if (!s) return [];
      if (/\s-\s/.test(s)) {
        return s.split(/\s*-\s*/).map((x) => x.trim()).filter(Boolean);
      }
      return [s];
    });
}
