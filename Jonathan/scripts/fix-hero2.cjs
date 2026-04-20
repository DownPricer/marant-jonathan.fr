const fs = require('fs');
const path = require('path');

const heroPath = path.join(__dirname, '../src/components/Hero.astro');
let c = fs.readFileSync(heroPath, 'utf8');

const si = c.indexOf('Banque');
if (si === -1) { console.error('Banque not found'); process.exit(1); }

const blockStart = c.lastIndexOf('/**', si);
// The old block ends with .filter(Boolean);
const OLD_END = '.filter(Boolean);';
const endIdx = c.indexOf(OLD_END, si);
const blockEnd = endIdx + OLD_END.length;

console.log('Block from', blockStart, 'to', blockEnd);
console.log('Old block snippet:', JSON.stringify(c.slice(blockStart, blockStart + 80)));

const newBlock = `/** Banque d'images hero : .webp en priorit\u00e9, JPEG en fallback sans doublon. */
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
fs.writeFileSync(heroPath, c);
console.log('Done. Lines:', c.split('\n').length);
