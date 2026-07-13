#!/usr/bin/env node
/** Test restauration depuis backup (DATA_DIR requis). */
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.DATA_DIR || './data-test');
const sitePath = path.join(dataDir, 'site.json');
const backupsDir = path.join(dataDir, 'backups');

function fail(msg) {
  console.error('✗', msg);
  process.exit(1);
}

if (!fs.existsSync(sitePath)) fail('site.json introuvable — lancez d’abord les tests admin.');

const before = fs.readFileSync(sitePath, 'utf8');
const parsed = JSON.parse(before);
const marker = `RESTORE_TEST_${Date.now()}`;
parsed.zone = marker;
fs.writeFileSync(sitePath, JSON.stringify(parsed, null, 2) + '\n');

// Simule une écriture invalide : le fichier ne doit pas être corrompu par une validation échouée côté API.
// Ici on vérifie qu'un backup existe avant toute modification via l'admin (déjà testé).
const backups = fs.readdirSync(backupsDir).filter((f) => f.startsWith('site-')).sort().reverse();
if (!backups.length) fail('Aucun backup site trouvé');

const restoreFrom = path.join(backupsDir, backups[0]);
const restored = fs.readFileSync(restoreFrom, 'utf8');
fs.copyFileSync(restoreFrom, sitePath);

const after = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
if (after.zone === marker) fail('Restauration n’a pas changé le contenu');
if (!after.nom) fail('Données restaurées invalides');

console.log('✓ Backup horodaté présent');
console.log('✓ Restauration depuis', backups[0]);
console.log('✓ Contenu courant cohérent après restauration');
