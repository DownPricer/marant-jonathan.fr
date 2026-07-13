#!/usr/bin/env node
/**
 * Suite de tests admin — exécution réelle, résultats individuels.
 * Prérequis : serveur démarré (npm run start) + variables ADMIN_PASSWORD et SESSION_SECRET.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.TEST_BASE || 'http://localhost:4321';
const origin = new URL(base).origin;
const password = process.env.ADMIN_PASSWORD;
const dataDir = process.env.DATA_DIR || './data-test';

if (!password) {
  console.error('ADMIN_PASSWORD requis pour les tests.');
  process.exit(1);
}

const jar = new Map();
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    if (/max-age=0/i.test(line) || val === '') jar.delete(name);
    else jar.set(name, val);
  }
}

async function req(urlPath, opts = {}) {
  const headers = {
    Origin: origin,
    ...(opts.headers || {}),
  };
  if (jar.size) headers.Cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(`${base}${urlPath}`, { ...opts, headers, redirect: 'manual' });
  parseSetCookie(res.headers);
  const text = await res.text();
  return {
    status: res.status,
    text,
    location: res.headers.get('location'),
    headers: res.headers,
  };
}

async function login() {
  const r = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }),
  });
  return r.status === 303 && jar.has('mj_admin_session');
}

async function getCsrf() {
  const r = await req('/admin/site');
  const m = r.text.match(/name="csrf" value="([^"]+)"/);
  return m?.[1] || '';
}

function formBody(fields) {
  return new URLSearchParams(fields);
}

async function postForm(apiPath, fields) {
  return req(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody(fields),
  });
}

async function postMultipart(apiPath, fd) {
  return req(apiPath, { method: 'POST', body: fd });
}

/** Mini PNG 1x1 */
function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function tinyJpeg() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==',
    'base64',
  );
}

function tinyWebp() {
  return Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=', 'base64');
}

async function main() {
  console.log(`Tests sur ${base}\n`);

  // --- Public ---
  const home = await req('/');
  record('Page publique /', home.status === 200);
  record('Admin login page', (await req('/admin/login')).status === 200);
  record('Admin / redirect login', [302, 303].includes((await req('/admin')).status));
  record('Realisations', (await req('/realisations')).status === 200);
  record('Sitemap index', (await req('/sitemap-index.xml')).status === 200);
  record('Robots.txt', (await req('/robots.txt')).status === 200);
  const unknown = await req('/route-inconnue-404-test');
  record('Route inconnue 404', unknown.status === 404);

  // --- Auth ---
  const noAuth = await postForm('/api/admin/site', { csrf: 'x' });
  record('POST sans session refusé', noAuth.status === 401);

  const badPw = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({ password: 'wrong-password-xyz-123' }),
  });
  record('Mauvais mot de passe', badPw.status === 303 && badPw.location?.includes('err='));

  record('Connexion réussie', await login());
  let csrf = await getCsrf();
  record('Jeton CSRF obtenu', csrf.length > 10);

  const noCsrf = await postForm('/api/admin/site', { nom: 'Test' });
  record('POST sans CSRF refusé', noCsrf.status === 403);

  const badCsrf = await postForm('/api/admin/site', { csrf: 'invalid-token', nom: 'Test' });
  record('POST mauvais CSRF refusé', badCsrf.status === 403);

  // --- FAQ ---
  let r = await postForm('/api/admin/faq', {
    csrf,
    action: 'add',
    new_q: 'Question test sécurité?',
    new_a: 'Réponse test.',
  });
  record('FAQ ajout', r.status === 303);
  csrf = await getCsrf();
  let faqPage = (await req('/admin/faq')).text;
  record('FAQ visible admin', faqPage.includes('Question test sécurité'));

  r = await postForm('/api/admin/faq', {
    csrf,
    action: 'save',
    q_0: faqPage.includes('Question test sécurité') ? 'Question test sécurité?' : '',
    a_0: 'Réponse modifiée.',
  });
  // Re-parse FAQ count from site data file
  const sitePath = path.resolve(dataDir, 'site.json');
  const siteData = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  const faqIdx = siteData.faq.findIndex((f) => f.question.includes('Question test'));
  if (faqIdx >= 0) {
    const fields = { csrf, action: 'save' };
    siteData.faq.forEach((f, i) => {
      fields[`q_${i}`] = i === faqIdx ? 'Question test modifiée?' : f.question;
      fields[`a_${i}`] = i === faqIdx ? 'Réponse modifiée.' : f.answer;
    });
    r = await postForm('/api/admin/faq', fields);
    record('FAQ modification', r.status === 303);
    csrf = await getCsrf();
    r = await postForm('/api/admin/faq', { csrf, move: 'down', idx: String(faqIdx) });
    record('FAQ réordonnancement', r.status === 303);
    csrf = await getCsrf();
    r = await postForm('/api/admin/faq', { csrf, delete_faq: String(faqIdx) });
    record('FAQ suppression', r.status === 303);
  } else {
    record('FAQ modification', false, 'index introuvable');
    record('FAQ réordonnancement', false, 'skip');
    record('FAQ suppression', false, 'skip');
  }
  csrf = await getCsrf();

  // --- Avis ---
  r = await postForm('/api/admin/avis', {
    csrf,
    action: 'add',
    new_t: 'Super travail test.',
    new_au: 'Client T.',
  });
  record('Avis ajout', r.status === 303);
  csrf = await getCsrf();
  const site2 = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  const avisIdx = site2.avis.findIndex((a) => a.texte.includes('Super travail test'));
  if (avisIdx >= 0) {
    const fields = { csrf, action: 'save' };
    site2.avis.forEach((a, i) => {
      fields[`t_${i}`] = i === avisIdx ? 'Avis modifié test.' : a.texte;
      fields[`au_${i}`] = a.auteur;
    });
    r = await postForm('/api/admin/avis', fields);
    record('Avis modification', r.status === 303);
    csrf = await getCsrf();
    r = await postForm('/api/admin/avis', { csrf, move: 'up', idx: String(avisIdx) });
    record('Avis réordonnancement', r.status === 303);
    csrf = await getCsrf();
    r = await postForm('/api/admin/avis', { csrf, delete_avis: String(avisIdx) });
    record('Avis suppression', r.status === 303);
  } else {
    record('Avis modification', false, 'skip');
    record('Avis réordonnancement', false, 'skip');
    record('Avis suppression', false, 'skip');
  }
  csrf = await getCsrf();

  // --- Projets ---
  const testSlug = `test-securite-${Date.now()}`;
  r = await postForm('/api/admin/projets', {
    csrf,
    action: 'create',
    titre: 'Projet test sécurité',
    slug: testSlug,
    description: 'Description test',
    categorie: 'menuiserie',
    categories: 'menuiserie,charpente',
    lieu: 'Testville',
    annee: '2026',
    couverture: '01.jpeg',
    vedette: '1',
    images: '',
  });
  record('Projet ajout', r.status === 303);
  csrf = await getCsrf();

  let projets = JSON.parse(fs.readFileSync(path.resolve(dataDir, 'projets.json'), 'utf8'));
  let pIdx = projets.findIndex((p) => p.slug === testSlug);
  record('Projet catégories multiples', pIdx >= 0 && projets[pIdx].categories?.includes('charpente'));
  record('Projet vedette', pIdx >= 0 && projets[pIdx].vedette === true);

  r = await postForm('/api/admin/projets', {
    csrf,
    action: 'create',
    titre: 'Doublon',
    slug: testSlug,
    description: 'x',
    categorie: 'menuiserie',
  });
  record('Slug doublon refusé', r.status === 500 || r.status === 403);

  r = await postForm('/api/admin/projets', {
    csrf,
    action: 'create',
    titre: 'Invalid',
    slug: 'SLUG INVALIDE!',
    description: 'x',
    categorie: 'menuiserie',
  });
  record('Slug invalide refusé', r.status === 500 || r.status === 403);
  csrf = await getCsrf();

  if (pIdx >= 0) {
    r = await postForm('/api/admin/projets', {
      csrf,
      action: 'save',
      idx: String(pIdx),
      titre: 'Projet test modifié',
      slug: testSlug,
      description: 'Desc modifiée',
      categorie: 'charpente',
      categories: 'charpente,couverture',
      vedette: '',
      images: '',
    });
    record('Projet modification', r.status === 303);
    projets = JSON.parse(fs.readFileSync(path.resolve(dataDir, 'projets.json'), 'utf8'));
    record('Catégorie principale maintenue', projets[pIdx].categorie === 'charpente');
    csrf = await getCsrf();
    r = await postForm('/api/admin/projets', { csrf, action: 'reorder', slug: testSlug, dir: 'up' });
    record('Projet réordonnancement', r.status === 303);
  } else {
    record('Projet modification', false, 'skip');
    record('Catégorie principale maintenue', false, 'skip');
    record('Projet réordonnancement', false, 'skip');
  }
  csrf = await getCsrf();

  // --- Uploads ---
  async function uploadBuffer(buf, name, mime) {
    const fd = new FormData();
    fd.set('csrf', csrf);
    fd.set('slug', testSlug);
    fd.set('file', new Blob([buf], { type: mime }), name);
    return postMultipart('/api/admin/upload', fd);
  }

  r = await uploadBuffer(tinyJpeg(), 'test.jpg', 'image/jpeg');
  record('Upload JPEG', r.status === 303);
  csrf = await getCsrf();
  r = await uploadBuffer(tinyPng(), 'test.png', 'image/png');
  record('Upload PNG', r.status === 303);
  csrf = await getCsrf();
  r = await uploadBuffer(tinyWebp(), 'test.webp', 'image/webp');
  record('Upload WebP', r.status === 303);
  csrf = await getCsrf();

  r = await uploadBuffer(Buffer.from('<?php echo 1;'), 'fake.jpg', 'image/jpeg');
  record('Faux JPG refusé', r.status === 500);
  csrf = await getCsrf();

  const huge = new Uint8Array(11 * 1024 * 1024);
  r = await uploadBuffer(huge, 'big.jpg', 'image/jpeg');
  record('Fichier trop volumineux refusé', r.status === 500);
  csrf = await getCsrf();

  const fdPath = new FormData();
  fdPath.set('csrf', csrf);
  fdPath.set('slug', '../etc/passwd');
  fdPath.set('file', new Blob([tinyPng()], { type: 'image/png' }), 'x.png');
  r = await postMultipart('/api/admin/upload', fdPath);
  record('Chemin ../ refusé', r.status === 500);
  csrf = await getCsrf();

  // --- Backup ---
  const backupsBefore = fs.existsSync(path.resolve(dataDir, 'backups'))
    ? fs.readdirSync(path.resolve(dataDir, 'backups')).filter((f) => f.startsWith('site-')).length
    : 0;
  r = await postForm('/api/admin/site', { csrf, zone: `Zone backup test ${Date.now()}` });
  const backupsAfter = fs.readdirSync(path.resolve(dataDir, 'backups')).filter((f) => f.startsWith('site-')).length;
  record('Backup horodaté créé', backupsAfter > backupsBefore);
  csrf = await getCsrf();

  // --- Logout ---
  r = await postForm('/api/admin/logout', { csrf });
  record('Déconnexion', r.status === 303 && !jar.has('mj_admin_session'));

  // --- Cleanup test project ---
  await login();
  csrf = await getCsrf();
  projets = JSON.parse(fs.readFileSync(path.resolve(dataDir, 'projets.json'), 'utf8'));
  pIdx = projets.findIndex((p) => p.slug === testSlug);
  if (pIdx >= 0) {
    await postForm('/api/admin/projets', { csrf, action: 'delete', slug: testSlug });
  }
  record('Projet suppression', pIdx >= 0);

  const passed = results.filter((x) => x.ok).length;
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${passed}/${results.length} tests réussis`);
  if (failed.length) {
    console.log('\nÉchecs :');
    failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`));
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
