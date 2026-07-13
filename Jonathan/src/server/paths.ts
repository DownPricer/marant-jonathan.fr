import fs from 'node:fs';
import path from 'node:path';

/** Racine du projet en runtime (WORKDIR Docker ou répertoire de lancement). */
export function getProjectRoot(): string {
  return process.env.PROJECT_ROOT?.trim() || process.cwd();
}

export function getDataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(getProjectRoot(), 'data');
}

export function getSitePath(): string {
  return path.join(getDataDir(), 'site.json');
}

export function getProjetsPath(): string {
  return path.join(getDataDir(), 'projets.json');
}

export function getInitMarkerPath(): string {
  return path.join(getDataDir(), '.initialized');
}

export function getBackupsDir(): string {
  return path.join(getDataDir(), 'backups');
}

export function getUploadsDir(): string {
  return path.join(getDataDir(), 'uploads', 'projets');
}

export function getSeedSitePath(): string {
  return path.join(getProjectRoot(), 'src', 'data', 'site.json');
}

export function getSeedProjetsPath(): string {
  return path.join(getProjectRoot(), 'src', 'data', 'projets.json');
}

export function getPublicProjetsDir(): string {
  return path.join(getProjectRoot(), 'public', 'images', 'projets');
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
