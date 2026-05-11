/**
 * Normalise un numéro FR affiché (06…, +33…) vers chiffres internationaux sans « + » (ex. 33699519359).
 */
export function phoneDigitsInternational(input: string): string {
  const d = input.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('33')) return d;
  if (d.startsWith('0') && d.length === 10) return `33${d.slice(1)}`;
  return d;
}

/** Valeur pour `href="tel:…"` (E.164). */
export function telHref(input: string): string {
  const d = phoneDigitsInternational(input);
  return d ? `+${d}` : '';
}

/** Identifiant pour `https://wa.me/{digits}` (indicatif pays, sans +). */
export function whatsAppPathDigits(input: string): string {
  return phoneDigitsInternational(input);
}
