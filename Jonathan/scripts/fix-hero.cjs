const fs = require('fs');
const path = require('path');

const heroPath = path.join(__dirname, '../src/components/Hero.astro');
let c = fs.readFileSync(heroPath, 'utf8');

// 1. Remove the wrongly-injected block after </style>
// Pattern: </style>/** Banque ... ---\n\n<section class="hero
const wrongStart = '</style>/** Banque';
const wrongEndMarker = '---\n';
const wi = c.indexOf(wrongStart);
if (wi !== -1) {
  // Find the end: the --- that closes this fake frontmatter
  const we = c.indexOf(wrongEndMarker, wi + wrongStart.length);
  if (we !== -1) {
    // Remove from wrongStart+8 (keep </style>) to we+wrongEndMarker.length
    const keepStyle = c.slice(0, wi + 8); // keep '</style>'
    const afterJunk = c.slice(we + wrongEndMarker.length); // after '---\n'
    c = keepStyle + '\n' + afterJunk;
    console.log('Removed wrongly-injected block');
  }
} else {
  console.log('Wrongly-injected block not found (already fixed?)');
}

// 2. Replace old bank code in frontmatter
const OLD_MARKER = "Banque d'images : dossier";
const OLD_END = '.filter(Boolean);';
const si = c.indexOf(OLD_MARKER);
if (si !== -1) {
  const blockStart = c.lastIndexOf('/**', si);
  const endIdx = c.indexOf(OLD_END, si);
  const blockEnd = endIdx + OLD_END.length;

  const newBlock = `/** Banque d'images hero : .webp en priorite, JPEG en fallback sans doublon. */
const bankWebp = import.meta.glob('../photo background/**/*.{webp,WEBP}', { eager: true, import: 'default' });
const bankJpeg = import.meta.glob('../photo background/**/*.{jpg,jpeg,JPG,JPEG}', { eager: true, import: 'default' });
function _bgToUrl(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'src' in v) return (v as { src: string }).src;
  return '';
}
const backgroundUrls: string[] = [
  ...Object.values(bankWebp).map(_bgToUrl),
  ...Object.entries(bankJpeg)
    .filter(([p]) => !bankWebp[p.replace(/\\.(jpe?g)$/i, '.webp')])
    .map(([, v]) => _bgToUrl(v)),
].filter(Boolean);`;

  c = c.slice(0, blockStart) + newBlock + c.slice(blockEnd);
  console.log('Replaced old bank block in frontmatter');
} else {
  console.log('Old bank marker not found');
}

fs.writeFileSync(heroPath, c);
console.log('Done. Total lines:', c.split('\n').length);
