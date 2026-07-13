#!/usr/bin/env node
/**
 * Vérifie les secrets obligatoires avant le démarrage du serveur de production.
 * Ne journalise jamais les valeurs des secrets.
 */
const MIN_SESSION = 32;
const MIN_PASSWORD = 12;

const password = process.env.ADMIN_PASSWORD?.trim();
const sessionSecret = process.env.SESSION_SECRET?.trim();

function fail(msg) {
  console.error(`\n❌  ${msg}\n`);
  process.exit(1);
}

if (!password) fail('ADMIN_PASSWORD est obligatoire (fichier .env non versionné).');
if (password.length < MIN_PASSWORD) {
  fail(`ADMIN_PASSWORD trop court (minimum ${MIN_PASSWORD} caractères).`);
}
if (!sessionSecret) fail('SESSION_SECRET est obligatoire (fichier .env non versionné).');
if (sessionSecret.length < MIN_SESSION) {
  fail(`SESSION_SECRET trop court (minimum ${MIN_SESSION} caractères).`);
}
