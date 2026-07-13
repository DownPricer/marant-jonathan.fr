export type IntroAccueil = {
  paragraphe1: string;
  paragraphe2: string;
  zone: string;
  cta: string;
};

export type Metier = {
  id: string;
  titre: string;
  sousTitre: string;
  description: string;
  alt: string;
  image: string;
};

export type FaqItem = { question: string; answer: string };
export type AvisItem = { texte: string; auteur: string };

export type SiteData = {
  nom: string;
  nomListing: string;
  marque: string;
  titre: string;
  sousTitre: string;
  baseline: string;
  introAccueil?: IntroAccueil;
  motsCles: string[];
  telephone: string;
  email: string;
  googleAvisUrl?: string;
  facebookUrl?: string;
  telephoneHint?: string;
  emailHint?: string;
  adresse: { rue: string; codePostal: string; ville: string };
  juridique: Record<string, string>;
  horaires: string;
  zone: string;
  pagesJaunesUrl?: string;
  prestations: string[];
  metiers: Metier[];
  faq: FaqItem[];
  howToDevis?: Record<string, unknown>;
  aPropos: { paragraphe1: string; paragraphe2: string; certifications: string[] };
  avis: AvisItem[];
};

export type ProjetData = {
  slug: string;
  titre: string;
  categorie: string;
  categories?: string[];
  annee: string;
  lieu: string;
  description: string;
  images: string[];
  couverture: string;
  video: string | null;
  vedette: boolean;
  ordre?: number;
};

export const VALID_CATEGORIES = [
  'menuiserie',
  'charpente',
  'ebenisterie',
  'couverture',
  'zinguerie',
] as const;

export type CategoryId = (typeof VALID_CATEGORIES)[number];
