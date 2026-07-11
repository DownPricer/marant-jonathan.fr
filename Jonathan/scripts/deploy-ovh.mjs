#!/usr/bin/env node
/**
 * Déploiement FTP vers OVH — Marant Jonathan
 * Usage : npm run deploy
 *
 * Configuration : créez un fichier .env.deploy à la racine du projet
 * avec vos identifiants FTP OVH (voir .env.deploy à la racine ou .env.example).
 *
 * Méthode facultative — le déploiement VPS (DEPLOIEMENT-VPS.md) reste la voie principale.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.deploy');

/* ── Lecture de la config ─────────────────────────────── */
function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => l.split('=').map(s => s.trim()))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, v.join('=')])
  );
}

let FtpDeploy;
try {
  FtpDeploy = (await import('ftp-deploy')).default;
} catch {
  console.error(`
❌  Le package « ftp-deploy » n'est pas installé.

Installez les dépendances de développement :

  npm install

Puis relancez :

  npm run deploy

Note : « npm run build » ne dépend pas de ftp-deploy et fonctionne sans ce package.
`);
  process.exit(1);
}

const env = loadEnv(ENV_FILE);

const FTP_HOST = env.FTP_HOST || process.env.FTP_HOST;
const FTP_USER = env.FTP_USER || process.env.FTP_USER;
const FTP_PASS = env.FTP_PASS || process.env.FTP_PASS;
const FTP_REMOTE = env.FTP_REMOTE || process.env.FTP_REMOTE || '/www/';
const FTP_PORT = parseInt(env.FTP_PORT || process.env.FTP_PORT || '21', 10);
const USE_SFTP = (env.USE_SFTP || process.env.USE_SFTP || 'false').toLowerCase() === 'true';

/* ── Validation ───────────────────────────────────────── */
if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
  console.error(`
❌  Configuration FTP manquante.

Créez un fichier ".env.deploy" à la racine du projet avec :

  FTP_HOST=ftp.votre-domaine.fr
  FTP_USER=votre-login-ftp
  FTP_PASS=votre-mot-de-passe
  FTP_REMOTE=/www/
  FTP_PORT=21

Ces informations se trouvent dans votre espace client OVH :
  Hébergements → votre hébergement → FTP - SSH

`);
  process.exit(1);
}

/* ── Vérification du dossier dist/ ───────────────────── */
const distPath = path.join(ROOT, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌  Le dossier dist/ n\'existe pas. Lancez "npm run build" d\'abord.');
  process.exit(1);
}

/* ── Déploiement ─────────────────────────────────────── */
const ftpDeploy = new FtpDeploy();

const config = {
  user: FTP_USER,
  password: FTP_PASS,
  host: FTP_HOST,
  port: FTP_PORT,
  localRoot: distPath,
  remoteRoot: FTP_REMOTE,
  include: ['**/*'],
  deleteRemote: false,
  forcePasv: true,
  sftp: USE_SFTP,
};

console.log(`\n🚀  Déploiement vers OVH...`);
console.log(`   Serveur  : ${FTP_HOST}`);
console.log(`   Utilisateur : ${FTP_USER}`);
console.log(`   Dossier distant : ${FTP_REMOTE}`);
console.log(`   Protocole : ${USE_SFTP ? 'SFTP' : 'FTP'}\n`);

let lastPercent = -1;
ftpDeploy.on('uploading', ({ totalFilesCount, transferredFileCount, filename }) => {
  const pct = Math.round((transferredFileCount / totalFilesCount) * 100);
  if (pct !== lastPercent) {
    lastPercent = pct;
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r   [${bar}] ${pct}%  ${filename.slice(0, 30).padEnd(32)}`);
  }
});

ftpDeploy.on('uploaded', () => {});

ftpDeploy
  .deploy(config)
  .then(() => {
    console.log(`\n\n✅  Déploiement terminé ! Votre site est en ligne.\n`);
  })
  .catch(err => {
    console.error(`\n\n❌  Erreur lors du déploiement :\n   ${err.message}\n`);
    console.error('   Vérifiez vos identifiants FTP dans .env.deploy\n');
    process.exit(1);
  });
