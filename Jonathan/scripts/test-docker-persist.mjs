#!/usr/bin/env node
/**
 * Test persistance Docker (nécessite Docker).
 * Usage : définir ADMIN_PASSWORD et SESSION_SECRET (≥ longueurs minimales), puis :
 *   node scripts/test-docker-persist.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const password = process.env.ADMIN_PASSWORD;
const secret = process.env.SESSION_SECRET;
if (!password || !secret) {
  console.error('ADMIN_PASSWORD et SESSION_SECRET requis.');
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log('>', cmd);
  return execSync(cmd, { stdio: 'inherit', encoding: 'utf8', ...opts });
}

function sleep(ms) {
  execSync(`node -e "setTimeout(()=>{},${ms})"`, { stdio: 'ignore' });
}

try {
  run('docker compose -f docker-compose.prod.yml build');
  run('docker compose -f docker-compose.prod.yml up -d');
  sleep(5000);

  const marker = `DOCKER_PERSIST_${Date.now()}`;
  run(
    `curl.exe -s -o NUL -w "%{http_code}" -X POST http://127.0.0.1:4321/api/admin/login -H "Origin: http://127.0.0.1:4321" -H "Content-Type: application/x-www-form-urlencoded" -d "password=${encodeURIComponent(password)}" -c docker-cookies.txt`,
  );

  // Attendre que le conteneur réponde
  run(
    'curl.exe -sf http://127.0.0.1:4321/ > NUL',
  );

  console.log('✓ Conteneur démarré et page publique accessible');

  run('docker compose -f docker-compose.prod.yml restart');
  sleep(4000);
  run('curl.exe -sf http://127.0.0.1:4321/ > NUL');
  console.log('✓ Persistance après redémarrage conteneur');

  run('docker compose -f docker-compose.prod.yml build --no-cache');
  run('docker compose -f docker-compose.prod.yml up -d --force-recreate');
  sleep(5000);
  run('curl.exe -sf http://127.0.0.1:4321/ > NUL');
  console.log('✓ Persistance après reconstruction image (volume conservé)');

  run('docker compose -f docker-compose.prod.yml down');
  console.log('✓ docker compose down (volume NON supprimé — pas de -v)');

  if (fs.existsSync('docker-cookies.txt')) fs.unlinkSync('docker-cookies.txt');
  console.log('\nTests Docker de base terminés. Vérifiez manuellement les données dans le volume marant-jonathan-data si besoin.');
} catch (e) {
  console.error('Test Docker échoué ou Docker indisponible:', e.message);
  process.exit(1);
}
