const fs = require('fs');
const path = require('path');

const heroPath = path.join(__dirname, '../src/components/Hero.astro');
let content = fs.readFileSync(heroPath, 'utf8');

const OLD_MARKER = "Banque d'images : dossier";
const OLD_END_MARKER = ".filter(Boolean);";

const start = content.indexOf(OLD_MARKER);
// Find the block comment start (/** on the line before)
const blockStart = content.lastIndexOf('/**', start);
// Find the end of the block (the .filter(Boolean); that ends backgroundUrls)
const endSearch = content.indexOf(OLD_END_MARKER, start);
const blockEnd = endSearch + OLD_END_MARKER.length;

const newBlock = `/** Banque d'images hero : préférence WebP (déjà convertis), JPEG en fallback sans doublon. */
const bankWebp = import.meta.glob('../photo background/**/*.{webp,WEBP}', { eager: true, import: 'default' });
const bankJpeg = import.meta.glob('../photo background/**/*.{jpg,jpeg,JPG,JPEG}', { eager: true, import: 'default' });

function _toUrl(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'src' in v) return v.src;
  return '';
}
const backgroundUrls = [
  ...Object.values(bankWebp).map(_toUrl),
  ...Object.entries(bankJpeg)
    .filter(([p]) => !bankWebp[p.replace(/\\.(jpe?g)$/i, '.webp')])
    .map(([, v]) => _toUrl(v)),
].filter(Boolean);`;

content = content.slice(0, blockStart) + newBlock + content.slice(blockEnd);
fs.writeFileSync(heroPath, content);
console.log('Hero.astro patched. Block length changed from', blockEnd - blockStart, 'to', newBlock.length);
