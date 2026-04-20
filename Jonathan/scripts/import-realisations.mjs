/**
 * Trouve le dossier « réalisations » à la racine du projet, copie les photos
 * dans public/images/projets/<slug>/ en 01.jpeg, 02.png, …
 * et réécrit src/data/projets.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEST_ROOT = path.join(ROOT, 'public', 'images', 'projets');
const PROJETS_JSON = path.join(ROOT, 'src', 'data', 'projets.json');

const IMG_EXT = /\.(jpe?g|png|webp)$/i;

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function slugify(name) {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Titres d’affichage (évitent les accents perdus par slugify). */
const TITRES_PAR_SLUG = {
  bibliotheque: 'Bibliothèque',
  chenneaux: 'Chéneaux',
  'creation-mobiliers': 'Création de mobiliers',
  dressing: 'Dressing',
  'escalier-colimacon': 'Escalier sur mesure',
  'espace-detente': 'Espace détente',
  pergolas: 'Carport',
  'porte-sur-mesure': 'Porte sur mesure',
  'restauration-balcon': 'Restauration de balcon',
  'terasse-bois': 'Terrasse bois',
  toiture: 'Toiture',
  'toiture-bac-acier': 'Toiture bac acier',
  'toiture-zinc-roulotte': 'Toiture zinc — roulotte',
};

function titreDepuisDossier(name) {
  const base = stripDiacritics(name).replace(/\s+/g, ' ').trim();
  return base
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

function titrePourProjet(folder, slug) {
  return TITRES_PAR_SLUG[slug] ?? titreDepuisDossier(folder);
}

function categorie(slug) {
  if (slug.includes('zinc') || slug.includes('chenneaux')) return 'zinguerie';
  if (slug === 'toiture' || slug.includes('bac-acier')) return 'charpente';
  return 'menuiserie';
}

function description(slug, cat) {
  if (cat === 'zinguerie')
    return 'Réalisation en zinguerie et étanchéité : mise en œuvre soignée, matériaux adaptés et finitions propres pour une protection durable.';
  if (cat === 'charpente')
    return 'Chantier de charpente / couverture : structure, ossature bois ou couverture, travail artisanal et suivi de bout en bout.';
  return 'Création ou agencement bois sur mesure : étude, fabrication et pose avec le souci du détail et des finitions.';
}

function findSourceDir() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const d of entries) {
    if (!d.isDirectory()) continue;
    if (d.name === 'public' || d.name === 'src' || d.name === 'node_modules' || d.name === 'dist' || d.name === '.astro' || d.name === 'clip')
      continue;
    const sub = fs.readdirSync(path.join(ROOT, d.name));
    if (sub.includes('bibliotheque')) return path.join(ROOT, d.name);
  }
  throw new Error('Dossier source introuvable : un répertoire à la racine doit contenir le sous-dossier « bibliotheque ».');
}

function vedettePourSlug(slug) {
  return ['escalier-colimacon', 'pergolas', 'toiture-zinc-roulotte', 'dressing'].includes(slug);
}

function main() {
  const srcRoot = findSourceDir();
  console.error('Source :', srcRoot);

  if (fs.existsSync(DEST_ROOT)) fs.rmSync(DEST_ROOT, { recursive: true });
  fs.mkdirSync(DEST_ROOT, { recursive: true });

  const dossiers = fs
    .readdirSync(srcRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => stripDiacritics(a).localeCompare(stripDiacritics(b), 'fr'));

  const projets = [];

  for (const folder of dossiers) {
    const slug = slugify(folder);
    if (!slug) continue;

    const dir = path.join(srcRoot, folder);
    const files = fs
      .readdirSync(dir)
      .filter((f) => IMG_EXT.test(f))
      .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

    if (files.length === 0) {
      console.error('Ignoré (aucune image) :', folder);
      continue;
    }

    const outDir = path.join(DEST_ROOT, slug);
    fs.mkdirSync(outDir, { recursive: true });

    const images = [];
    let i = 1;
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      const destName = `${String(i).padStart(2, '0')}${ext}`;
      fs.copyFileSync(path.join(dir, f), path.join(outDir, destName));
      images.push(destName);
      i++;
    }

    const cat = categorie(slug);
    const entry = {
      slug,
      titre: titrePourProjet(folder, slug),
      categorie: cat,
      annee: '2026',
      lieu: 'Saint-Ambroix',
      description: description(slug, cat),
      images,
      couverture: images[0],
      video: null,
      vedette: vedettePourSlug(slug),
    };

    if (slug === 'escalier-colimacon' && images.length >= 11) {
      entry.titre = 'Escalier sur mesure';
      entry.description =
        'Escalier quart tournant semi suspendu et escalier en colimaçon : étude, fabrication et pose sur mesure, avec le souci du détail et des finitions.';
      const im = images;
      entry.galerieSections = [
        {
          layout: 'hero',
          sousTitre: 'Escalier 1/4 tournant',
          note: 'Semi suspendu.',
          images: [im[0]],
        },
        {
          layout: 'grid',
          sousTitre: 'Escalier en colimaçon',
          images: [im[1], im[2], im[10], im[3], im[4], im[5], im[6], im[7], im[8], im[9]],
        },
      ];
    }

    projets.push(entry);

    console.error('OK', slug, `(${images.length} photos)`);
  }

  fs.writeFileSync(PROJETS_JSON, JSON.stringify(projets, null, 2) + '\n', 'utf8');
  console.error('Écrit :', PROJETS_JSON);
  console.log(JSON.stringify({ count: projets.length }, null, 2));
}

main();
