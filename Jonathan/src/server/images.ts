import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, getPublicProjetsDir, getUploadsDir } from './paths';
import { normalizeSlug, parseSlugInput } from './validation';

const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_MB || '10', 10) * 1024 * 1024;

const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

function detectType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function safeSegment(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function resolveProjetImagePath(slug: string, fileName: string): string | null {
  const safeSlug = normalizeSlug(slug);
  const safeFile = safeSegment(fileName);
  if (!safeSlug || !safeFile || safeFile.includes('..')) return null;

  const uploadPath = path.join(getUploadsDir(), safeSlug, safeFile);
  if (fs.existsSync(uploadPath)) return uploadPath;

  const publicPath = path.join(getPublicProjetsDir(), safeSlug, safeFile);
  if (fs.existsSync(publicPath)) return publicPath;

  return null;
}

export function listProjetImages(slug: string): string[] {
  const safeSlug = normalizeSlug(slug);
  const dirs = [
    path.join(getUploadsDir(), safeSlug),
    path.join(getPublicProjetsDir(), safeSlug),
  ];
  const files = new Set<string>();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/\.(jpe?g|png|webp)$/i.test(f)) files.add(f);
    }
  }
  return [...files].sort();
}

export function saveProjetUpload(
  slug: string,
  originalName: string,
  buffer: Buffer,
): { fileName: string; url: string } {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_UPLOAD_BYTES / 1024 / 1024} Mo).`);
  }
  const mime = detectType(buffer);
  if (!mime || !ALLOWED.has(mime)) {
    throw new Error('Type de fichier non autorisé (JPEG, PNG, WebP uniquement).');
  }
  const ext = ALLOWED.get(mime)!;
  const safeSlug = parseSlugInput(slug);

  const dir = path.join(getUploadsDir(), safeSlug);
  ensureDir(dir);

  const base = safeSegment(originalName).replace(/\.[^.]+$/, '') || 'image';
  let fileName = `${base}${ext}`;
  let n = 1;
  while (fs.existsSync(path.join(dir, fileName))) {
    fileName = `${base}-${n}${ext}`;
    n += 1;
  }

  fs.writeFileSync(path.join(dir, fileName), buffer);
  return { fileName, url: `/images/projets/${safeSlug}/${fileName}` };
}

export function deleteProjetImage(slug: string, fileName: string, usedInProjets: string[][]): boolean {
  const safeSlug = normalizeSlug(slug);
  const safeFile = safeSegment(fileName);
  const uploadPath = path.join(getUploadsDir(), safeSlug, safeFile);
  if (!fs.existsSync(uploadPath)) return false;

  const stillUsed = usedInProjets.some((images) => images.includes(safeFile));
  if (stillUsed) throw new Error('Image encore utilisée par un projet.');

  fs.unlinkSync(uploadPath);
  return true;
}

export function readProjetImage(slug: string, fileName: string): { buffer: Buffer; mime: string } | null {
  const filePath = resolveProjetImagePath(slug, fileName);
  if (!filePath) return null;
  const buffer = fs.readFileSync(filePath);
  const mime = detectType(buffer);
  if (!mime) return null;
  return { buffer, mime };
}
