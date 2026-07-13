import fs from 'node:fs';
import path from 'node:path';
import type { ProjetData, SiteData } from '../types/content';
import {
  ensureDir,
  getBackupsDir,
  getDataDir,
  getInitMarkerPath,
  getProjetsPath,
  getPublicProjetsDir,
  getSeedProjetsPath,
  getSeedSitePath,
  getSitePath,
  getUploadsDir,
} from './paths';
import { validateProjetsData, validateSiteData } from './validation';

let siteCache: SiteData | null = null;
let projetsCache: ProjetData[] | null = null;
let cacheTs = 0;
const CACHE_MS = 1000;

function invalidateCache(): void {
  siteCache = null;
  projetsCache = null;
  cacheTs = 0;
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const content = JSON.stringify(data, null, 2) + '\n';
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    JSON.parse(fs.readFileSync(tmp, 'utf8'));
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function backupFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const backups = getBackupsDir();
  ensureDir(backups);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.basename(filePath, '.json');
  fs.copyFileSync(filePath, path.join(backups, `${base}-${stamp}.json`));
  pruneBackups(backups, base);
}

const MAX_BACKUPS_PER_FILE = parseInt(process.env.MAX_BACKUPS || '50', 10);

function pruneBackups(backupsDir: string, baseName: string): void {
  const prefix = `${baseName}-`;
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  for (const old of files.slice(MAX_BACKUPS_PER_FILE)) {
    try {
      fs.unlinkSync(path.join(backupsDir, old));
    } catch {
      /* ignore */
    }
  }
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

export function migrateIfNeeded(): void {
  const dataDir = getDataDir();
  ensureDir(dataDir);
  ensureDir(getUploadsDir());
  ensureDir(getBackupsDir());

  const marker = getInitMarkerPath();
  const sitePath = getSitePath();
  const projetsPath = getProjetsPath();

  if (fs.existsSync(marker) && fs.existsSync(sitePath) && fs.existsSync(projetsPath)) {
    return;
  }

  if (!fs.existsSync(sitePath)) {
    fs.copyFileSync(getSeedSitePath(), sitePath);
  }
  if (!fs.existsSync(projetsPath)) {
    fs.copyFileSync(getSeedProjetsPath(), projetsPath);
  }

  copyDirRecursive(getPublicProjetsDir(), getUploadsDir());

  fs.writeFileSync(
    marker,
    JSON.stringify({ migratedAt: new Date().toISOString(), version: 1 }, null, 2) + '\n',
    'utf8',
  );
  invalidateCache();
}

export function readSite(): SiteData {
  migrateIfNeeded();
  const now = Date.now();
  if (siteCache && now - cacheTs < CACHE_MS) return siteCache;
  const raw = fs.readFileSync(getSitePath(), 'utf8');
  siteCache = JSON.parse(raw) as SiteData;
  cacheTs = now;
  return siteCache;
}

export function readProjets(): ProjetData[] {
  migrateIfNeeded();
  const now = Date.now();
  if (projetsCache && now - cacheTs < CACHE_MS) return projetsCache;
  const raw = fs.readFileSync(getProjetsPath(), 'utf8');
  projetsCache = JSON.parse(raw) as ProjetData[];
  cacheTs = now;
  return projetsCache;
}

export function writeSite(data: SiteData): void {
  migrateIfNeeded();
  const validated = validateSiteData(structuredClone(data));
  backupFile(getSitePath());
  atomicWriteJson(getSitePath(), validated);
  invalidateCache();
}

export function writeProjets(data: ProjetData[]): void {
  migrateIfNeeded();
  const validated = validateProjetsData(structuredClone(data));
  backupFile(getProjetsPath());
  atomicWriteJson(getProjetsPath(), validated);
  invalidateCache();
}

export function restoreSiteFromBackup(fileName: string): void {
  const src = path.join(getBackupsDir(), fileName);
  if (!src.startsWith(getBackupsDir()) || !fs.existsSync(src)) {
    throw new Error('Sauvegarde introuvable.');
  }
  backupFile(getSitePath());
  fs.copyFileSync(src, getSitePath());
  invalidateCache();
}

export function listBackups(): string[] {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
}
