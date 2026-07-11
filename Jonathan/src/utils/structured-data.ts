/** Données structurées réutilisables (Schema.org). */

export type FaqEntry = { question: string; answer: string };

export type HowToStepInput = { name: string; text: string };

export function buildFaqPageJsonLd(entries: FaqEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: e.answer,
      },
    })),
  };
}

export function buildHowToJsonLd(input: {
  name: string;
  description: string;
  steps: HowToStepInput[];
  totalTime?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    step: input.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

type WithBase = (path: string) => string;

export function buildItemListRealisationsJsonLd(
  listPageCanonicalHref: string,
  site: URL,
  withBase: WithBase,
  projects: { slug: string; titre: string }[]
): Record<string, unknown> {
  const abs = (pathFromWithBase: string) =>
    new URL(pathFromWithBase.replace(/^\//, ''), site).href;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${listPageCanonicalHref}#itemlist`,
    name: 'Réalisations portfolio',
    numberOfItems: projects.length,
    itemListElement: projects.map((proj, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: proj.titre,
      item: abs(withBase(`/realisations/${proj.slug}`)),
    })),
  };
}

export function buildCollectionPageRealisationsJsonLd(
  listPageCanonicalHref: string,
  siteHref: string,
  name: string,
  description: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${listPageCanonicalHref}#collection`,
    url: listPageCanonicalHref,
    name,
    description,
    isPartOf: { '@id': `${siteHref}#website` },
    mainEntity: { '@id': `${listPageCanonicalHref}#itemlist` },
  };
}

export function buildMetiersServiceItemListJsonLd(
  siteHref: string,
  serviceUrlForMetierId: (id: string) => string,
  metiers: Array<{ id: string; titre: string; description: string; sousTitre?: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${siteHref}#services-metiers`,
    name: 'Savoir-faire et prestations',
    numberOfItems: metiers.length,
    itemListElement: metiers.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Service',
        '@id': `${siteHref}#service-${m.id}`,
        name: m.sousTitre ?? m.titre,
        alternateName: m.titre,
        description: m.description,
        serviceType: m.titre,
        provider: { '@id': `${siteHref}#business` },
        url: serviceUrlForMetierId(m.id),
      },
    })),
  };
}

export function buildImageGalleryJsonLd(input: {
  pageCanonical: string;
  name: string;
  description: string;
  imageUrls: string[];
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    '@id': `${input.pageCanonical}#gallery`,
    url: input.pageCanonical,
    name: input.name,
    description: input.description,
    image: input.imageUrls.map((url) => ({
      '@type': 'ImageObject',
      url,
      caption: input.name,
    })),
  };
}
