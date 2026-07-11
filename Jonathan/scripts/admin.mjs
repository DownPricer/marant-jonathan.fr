#!/usr/bin/env node
/**
 * Panneau d'administration local — Marant Jonathan
 * Usage : npm run admin
 * Accès : http://localhost:3001
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE_JSON = path.join(ROOT, 'src', 'data', 'site.json');
const PROJETS_JSON = path.join(ROOT, 'src', 'data', 'projets.json');
const PASSWORD = process.env.ADMIN_PASSWORD?.trim();
const PORT = process.env.ADMIN_PORT || 3001;

if (!PASSWORD) {
  console.error(`
❌  ADMIN_PASSWORD n'est pas défini.

Définissez un mot de passe avant de lancer le panneau d'administration :

  Windows (PowerShell) : $env:ADMIN_PASSWORD="votre-mot-de-passe"; npm run admin
  Linux / macOS        : ADMIN_PASSWORD="votre-mot-de-passe" npm run admin

Vous pouvez aussi créer un fichier .env local (non versionné) — voir .env.example.
`);
  process.exit(1);
}

const sessions = new Set();

/* ── Utilitaires ─────────────────────────────────────── */
function mkToken() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function getCookie(req, name) {
  const c = (req.headers.cookie || '').split(';').find(s => s.trim().startsWith(name + '='));
  return c ? decodeURIComponent(c.trim().slice(name.length + 1)) : null;
}

function isAuth(req) {
  const t = getCookie(req, 'admin_token');
  return Boolean(t && sessions.has(t));
}

function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { resolve(JSON.parse(b)); } catch { resolve({}); }
      } else {
        const p = new URLSearchParams(b);
        const o = {};
        for (const [k, v] of p) o[k] = v;
        resolve(o);
      }
    });
  });
}

function readSite() { return JSON.parse(fs.readFileSync(SITE_JSON, 'utf8')); }
function readProjets() { return JSON.parse(fs.readFileSync(PROJETS_JSON, 'utf8')); }

function validateSiteData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Données site invalides : objet attendu.');
  }
  if (typeof data.nom !== 'string' || !data.nom.trim()) {
    throw new Error('Le champ « nom » est obligatoire.');
  }
  if (!Array.isArray(data.metiers)) {
    throw new Error('Le champ « metiers » doit être un tableau.');
  }
  JSON.stringify(data);
  return data;
}

function validateProjetsData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Données projets invalides : tableau attendu.');
  }
  for (const p of data) {
    if (!p || typeof p !== 'object') throw new Error('Projet invalide.');
    if (typeof p.slug !== 'string' || !p.slug.trim()) {
      throw new Error('Chaque projet doit avoir un « slug ».');
    }
    if (typeof p.titre !== 'string' || !p.titre.trim()) {
      throw new Error('Chaque projet doit avoir un « titre ».');
    }
  }
  JSON.stringify(data);
  return data;
}

function atomicWriteJson(filePath, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmp = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.tmp`,
  );
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    JSON.parse(fs.readFileSync(tmp, 'utf8'));
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }
}

function writeSite(d) {
  atomicWriteJson(SITE_JSON, validateSiteData(d));
}

function writeProjets(d) {
  atomicWriteJson(PROJETS_JSON, validateProjetsData(d));
}

function safeWrite(fn, onError) {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.';
  }
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Layout HTML ─────────────────────────────────────── */
const LINKS = [
  ['site',    '⚙️  Infos générales', '/site'],
  ['intro',   '🏠 Texte accueil',   '/intro'],
  ['metiers', '🔨 Services',         '/metiers'],
  ['apropos', '👤 À propos',         '/apropos'],
  ['faq',     '❓ FAQ',              '/faq'],
  ['avis',    '⭐ Avis clients',     '/avis'],
  ['projets', '📁 Projets',          '/projets'],
];

function layout(title, body, active, flash = '', errorFlash = '') {
  const nav = LINKS.map(([id, label, href]) =>
    `<a href="${href}"${active === id ? ' class="on"' : ''}>${label}</a>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d0d0d;--surf:#111;--surf2:#161616;--border:#222;--accent:#c9a96e;--accent-h:#e0c08e;--text:#e8e2d9;--dim:#888;--dim2:#555}
body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex}
a{color:var(--accent);text-decoration:none}a:hover{color:var(--accent-h)}
/* Sidebar */
.sb{width:210px;min-height:100vh;background:var(--surf);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:10}
.sb-top{padding:1.25rem 1rem .75rem;border-bottom:1px solid var(--border)}
.sb-top h1{font-size:.9rem;font-weight:700;color:var(--accent);letter-spacing:.06em;line-height:1.2}
.sb-top p{font-size:.68rem;color:var(--dim2);margin-top:.2rem}
.sb nav{flex:1;padding:.5rem 0}
.sb nav a{display:flex;align-items:center;gap:.5rem;padding:.6rem 1rem;font-size:.78rem;color:var(--dim);border-left:2px solid transparent;transition:all .12s}
.sb nav a:hover{background:var(--surf2);color:var(--text)}
.sb nav a.on{background:var(--surf2);color:var(--accent);border-left-color:var(--accent)}
.sb-foot{padding:.75rem 1rem;border-top:1px solid var(--border);font-size:.72rem}
.sb-foot a{color:var(--dim2)}
.sb-foot a:hover{color:var(--accent)}
/* Main */
.main{margin-left:210px;flex:1;min-width:0;padding:2rem 2.5rem}
.mh{margin-bottom:1.75rem;padding-bottom:1rem;border-bottom:1px solid var(--border)}
.mh h2{font-size:1.25rem;font-weight:400}
/* Cards */
.card{background:var(--surf);border:1px solid var(--border);border-radius:6px;padding:1.4rem;margin-bottom:1.25rem}
.card-title{font-size:.72rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.12em;margin-bottom:1rem}
/* Fields */
.field{margin-bottom:.9rem}
.field label{display:block;font-size:.72rem;color:var(--dim);margin-bottom:.28rem;letter-spacing:.04em}
input[type=text],input[type=email],input[type=tel],input[type=url],input[type=password],input[type=number],textarea,select{
  width:100%;padding:.5rem .7rem;background:#0a0a0a;border:1px solid #2a2a2a;color:var(--text);
  border-radius:4px;font-size:.82rem;font-family:inherit;transition:border-color .12s}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--accent)}
textarea{resize:vertical;line-height:1.55}
/* Buttons */
.btn{display:inline-flex;align-items:center;gap:.35rem;padding:.48rem 1.1rem;border:1px solid var(--accent);
  background:transparent;color:var(--accent);border-radius:4px;font-size:.76rem;font-weight:600;
  letter-spacing:.07em;cursor:pointer;transition:all .12s;font-family:inherit}
.btn:hover{background:var(--accent);color:#0a0a0a}
.btn-sm{padding:.3rem .7rem;font-size:.7rem}
.btn-danger{border-color:#c95555;color:#c95555}.btn-danger:hover{background:#c95555;color:#fff}
.btn-ok{border-color:#5ab55a;color:#5ab55a}.btn-ok:hover{background:#5ab55a;color:#0a0a0a}
/* Alert */
.alert{padding:.65rem 1rem;border-radius:4px;margin-bottom:1.25rem;font-size:.8rem}
.ok{background:#0c1d0c;border:1px solid #2a5a2a;color:#6ec96e}
.err{background:#1d0c0c;border:1px solid #5a2a2a;color:#c96e6e}
/* Grid */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
/* Metier block */
.mb{border:1px solid var(--border);border-radius:5px;padding:1rem;margin-bottom:.85rem}
.mb h4{font-size:.72rem;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem}
/* FAQ / Avis */
.faq-row,.avis-row{border:1px solid var(--border);border-radius:5px;padding:.9rem;margin-bottom:.6rem}
.faq-row-n{font-size:.68rem;color:var(--dim2);margin-bottom:.4rem}
/* Projets table */
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:.68rem;color:var(--dim2);text-transform:uppercase;letter-spacing:.08em;
  padding:.45rem .65rem;border-bottom:1px solid var(--border)}
td{padding:.55rem .65rem;border-bottom:1px solid #1a1a1a;font-size:.8rem;vertical-align:middle}
tr:hover td{background:var(--surf2)}
.badge{display:inline-block;padding:.15rem .4rem;border-radius:3px;font-size:.65rem;letter-spacing:.05em;text-transform:uppercase}
.bm{background:#1a2a1a;color:#6ec96e}.bc{background:#2a1a0d;color:#c9966e}
.be{background:#2a2a0d;color:#c9c96e}.bco{background:#0d1a2a;color:#6e9ec9}
.bz{background:#2a0d2a;color:#c96ec9}
/* Edit projet */
.edit-header{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem}
.back-link{font-size:.78rem;color:var(--dim)}
/* Login */
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;background:var(--bg)}
.login-box{background:var(--surf);border:1px solid var(--border);border-radius:8px;padding:2.5rem;width:320px}
.login-box h1{font-size:1rem;font-weight:600;color:var(--accent);text-align:center;margin-bottom:.35rem;letter-spacing:.08em}
.login-box p{font-size:.75rem;color:var(--dim2);text-align:center;margin-bottom:1.5rem}
</style>
</head>
<body>
${active === 'login' ? '' : `
<aside class="sb">
  <div class="sb-top"><h1>MARANT JONATHAN</h1><p>Administration du site</p></div>
  <nav>${nav}</nav>
  <div class="sb-foot"><a href="/logout">⏎ Déconnexion</a></div>
</aside>
<main class="main">
  <div class="mh"><h2>${esc(title)}</h2></div>
  ${errorFlash ? `<div class="alert err">${esc(errorFlash)}</div>` : ''}
  ${flash ? `<div class="alert ok">✓ ${esc(flash)}</div>` : ''}
  ${body}
</main>
`}
${active === 'login' ? body : ''}
</body></html>`;
}

/* ── Pages ───────────────────────────────────────────── */
function loginPage(err = '') {
  return layout('Connexion', `
<div class="login-wrap">
  <div class="login-box">
    <h1>ADMINISTRATION</h1>
    <p>Marant Jonathan — Site artisan</p>
    ${err ? `<div class="alert err">${esc(err)}</div>` : ''}
    <form method="post" action="/login">
      <div class="field"><label>Mot de passe</label><input type="password" name="password" autofocus required></div>
      <button type="submit" class="btn" style="width:100%;justify-content:center">Accéder →</button>
    </form>
  </div>
</div>`, 'login');
}

function sitePage(flash = '', errorFlash = '') {
  const s = readSite();
  return layout('Infos générales', `
<form method="post" action="/site/save">
  <div class="card">
    <div class="card-title">Identité</div>
    <div class="g2">
      <div class="field"><label>Nom complet</label><input type="text" name="nom" value="${esc(s.nom)}"></div>
      <div class="field"><label>Marque</label><input type="text" name="marque" value="${esc(s.marque)}"></div>
    </div>
    <div class="field"><label>Sous-titre (dans l'en-tête)</label><input type="text" name="sousTitre" value="${esc(s.sousTitre)}"></div>
    <div class="field"><label>Baseline (accueil)</label><input type="text" name="baseline" value="${esc(s.baseline)}"></div>
    <div class="field"><label>Zone d'intervention</label><input type="text" name="zone" value="${esc(s.zone)}"></div>
  </div>
  <div class="card">
    <div class="card-title">Contact</div>
    <div class="g2">
      <div class="field"><label>Téléphone</label><input type="tel" name="telephone" value="${esc(s.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" name="email" value="${esc(s.email)}"></div>
    </div>
    <div class="g2">
      <div class="field"><label>Adresse (rue)</label><input type="text" name="adresse_rue" value="${esc(s.adresse?.rue || '')}"></div>
      <div class="field"><label>Code postal</label><input type="text" name="adresse_cp" value="${esc(s.adresse?.codePostal || '')}"></div>
    </div>
    <div class="g2">
      <div class="field"><label>Ville</label><input type="text" name="adresse_ville" value="${esc(s.adresse?.ville || '')}"></div>
      <div class="field"><label>Horaires</label><input type="text" name="horaires" value="${esc(s.horaires)}"></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Liens externes</div>
    <div class="field"><label>Facebook (URL)</label><input type="url" name="facebookUrl" value="${esc(s.facebookUrl || '')}"></div>
    <div class="field"><label>Google Avis (URL)</label><input type="url" name="googleAvisUrl" value="${esc(s.googleAvisUrl || '')}"></div>
    <div class="field"><label>Pages Jaunes (URL)</label><input type="url" name="pagesJaunesUrl" value="${esc(s.pagesJaunesUrl || '')}"></div>
  </div>
  <button type="submit" class="btn btn-ok">💾 Enregistrer</button>
</form>`, 'site', flash, errorFlash);
}

function introPage(flash = '', errorFlash = '') {
  const s = readSite();
  const i = s.introAccueil || {};
  return layout('Texte d\'accueil', `
<form method="post" action="/intro/save">
  <div class="card">
    <div class="card-title">Bloc d'introduction (sous le hero)</div>
    <div class="field"><label>Paragraphe 1</label>
      <textarea name="p1" rows="3">${esc(i.paragraphe1 || '')}</textarea></div>
    <div class="field"><label>Paragraphe 2</label>
      <textarea name="p2" rows="3">${esc(i.paragraphe2 || '')}</textarea></div>
    <div class="field"><label>Zone d'intervention (phrase courte)</label>
      <input type="text" name="zone" value="${esc(i.zone || '')}"></div>
    <div class="field"><label>Appel à l'action (ex: Devis gratuit…)</label>
      <input type="text" name="cta" value="${esc(i.cta || '')}"></div>
  </div>
  <button type="submit" class="btn btn-ok">💾 Enregistrer</button>
</form>`, 'intro', flash, errorFlash);
}

function metiersPage(flash = '', errorFlash = '') {
  const s = readSite();
  const metierColor = { menuiserie:'#6ec96e', charpente:'#c9966e', ebenisterie:'#c9c96e', couverture:'#6e9ec9', zinguerie:'#c96ec9' };
  const blocks = s.metiers.map((m, i) => `
    <div class="mb" style="border-color:${metierColor[m.id] || '#333'}22">
      <h4 style="color:${metierColor[m.id] || 'var(--accent)'}">${esc(m.titre)} (${m.id})</h4>
      <div class="field"><label>Sous-titre affiché</label>
        <input type="text" name="metier_${i}_sousTitre" value="${esc(m.sousTitre || '')}"></div>
      <div class="field"><label>Description</label>
        <textarea name="metier_${i}_description" rows="4">${esc(m.description)}</textarea></div>
      <div class="field"><label>Alt image (SEO)</label>
        <input type="text" name="metier_${i}_alt" value="${esc(m.alt || '')}"></div>
    </div>`).join('');
  return layout('Services', `
<form method="post" action="/metiers/save">
  ${blocks}
  <button type="submit" class="btn btn-ok">💾 Enregistrer</button>
</form>`, 'metiers', flash, errorFlash);
}

function aproposPage(flash = '', errorFlash = '') {
  const s = readSite();
  const a = s.aPropos || {};
  return layout('À propos', `
<form method="post" action="/apropos/save">
  <div class="card">
    <div class="card-title">Textes de la page À propos</div>
    <div class="field"><label>Paragraphe 1</label>
      <textarea name="p1" rows="5">${esc(a.paragraphe1 || '')}</textarea></div>
    <div class="field"><label>Paragraphe 2</label>
      <textarea name="p2" rows="5">${esc(a.paragraphe2 || '')}</textarea></div>
  </div>
  <div class="card">
    <div class="card-title">Certifications / Badges</div>
    ${(a.certifications || []).map((c, i) => `
    <div class="field"><label>Badge ${i + 1}</label>
      <input type="text" name="cert_${i}" value="${esc(c)}"></div>`).join('')}
  </div>
  <button type="submit" class="btn btn-ok">💾 Enregistrer</button>
</form>`, 'apropos', flash, errorFlash);
}

function faqPage(flash = '', errorFlash = '') {
  const s = readSite();
  const faqs = s.faq || [];
  const rows = faqs.map((f, i) => `
    <div class="faq-row">
      <div class="faq-row-n">Question ${i + 1}</div>
      <div class="field"><label>Question</label>
        <input type="text" name="q_${i}" value="${esc(f.question)}"></div>
      <div class="field"><label>Réponse</label>
        <textarea name="a_${i}" rows="3">${esc(f.answer)}</textarea></div>
      <button type="submit" name="delete_faq" value="${i}" class="btn btn-sm btn-danger" 
        onclick="return confirm('Supprimer cette question ?')">🗑 Supprimer</button>
    </div>`).join('');
  return layout('FAQ', `
<form method="post" action="/faq/save">
  ${rows}
  <div class="faq-row" style="border-style:dashed">
    <div class="faq-row-n">Nouvelle question</div>
    <div class="field"><label>Question</label><input type="text" name="new_q" placeholder="Votre question…"></div>
    <div class="field"><label>Réponse</label><textarea name="new_a" rows="3" placeholder="La réponse…"></textarea></div>
  </div>
  <div style="display:flex;gap:.75rem;flex-wrap:wrap">
    <button type="submit" name="action" value="save" class="btn btn-ok">💾 Enregistrer</button>
    <button type="submit" name="action" value="add" class="btn">➕ Ajouter</button>
  </div>
</form>`, 'faq', flash, errorFlash);
}

function avisPage(flash = '', errorFlash = '') {
  const s = readSite();
  const avis = s.avis || [];
  const rows = avis.map((a, i) => `
    <div class="avis-row">
      <div class="faq-row-n">Avis ${i + 1}</div>
      <div class="field"><label>Texte</label>
        <textarea name="t_${i}" rows="3">${esc(a.texte)}</textarea></div>
      <div class="field"><label>Auteur</label>
        <input type="text" name="au_${i}" value="${esc(a.auteur)}"></div>
      <button type="submit" name="delete_avis" value="${i}" class="btn btn-sm btn-danger"
        onclick="return confirm('Supprimer cet avis ?')">🗑 Supprimer</button>
    </div>`).join('');
  return layout('Avis clients', `
<form method="post" action="/avis/save">
  ${rows}
  <div class="avis-row" style="border-style:dashed">
    <div class="faq-row-n">Nouvel avis</div>
    <div class="field"><label>Texte</label><textarea name="new_t" rows="3" placeholder="Texte de l'avis…"></textarea></div>
    <div class="field"><label>Auteur</label><input type="text" name="new_au" placeholder="Prénom N."></div>
  </div>
  <div style="display:flex;gap:.75rem;flex-wrap:wrap">
    <button type="submit" name="action" value="save" class="btn btn-ok">💾 Enregistrer</button>
    <button type="submit" name="action" value="add" class="btn">➕ Ajouter</button>
  </div>
</form>`, 'avis', flash, errorFlash);
}

const BADGE = { menuiserie:'bm', charpente:'bc', ebenisterie:'be', couverture:'bco', zinguerie:'bz' };

function projetsPage(flash = '', errorFlash = '') {
  const ps = readProjets();
  const rows = ps.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(p.titre)}</td>
      <td><span class="badge ${BADGE[p.categorie] || ''}">${esc(p.categorie)}</span></td>
      <td>${esc(p.lieu || '')} ${esc(p.annee || '')}</td>
      <td>${p.vedette ? '⭐' : ''}</td>
      <td><a href="/projets/${i}/edit" class="btn btn-sm">Modifier</a></td>
    </tr>`).join('');
  return layout('Projets', `
<div class="card" style="padding:0;overflow:hidden">
  <table>
    <thead><tr>
      <th>#</th><th>Titre</th><th>Catégorie</th><th>Lieu / Année</th><th>★</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="font-size:.75rem;color:var(--dim);margin-top:.75rem">
  Pour ajouter des photos, déposez les fichiers dans <code>public/images/projets/[slug]/</code> puis mettez à jour la liste d'images dans le projet.
</p>`, 'projets', flash, errorFlash);
}

function projetEditPage(idx, flash = '', errorFlash = '') {
  const ps = readProjets();
  const p = ps[idx];
  if (!p) return null;
  const cats = ['menuiserie','charpente','ebenisterie','couverture','zinguerie'];
  const catOpts = cats.map(c => `<option value="${c}"${p.categorie === c ? ' selected' : ''}>${c}</option>`).join('');
  return layout(`Projet : ${p.titre}`, `
<div class="edit-header">
  <a href="/projets" class="back-link back-link">← Retour aux projets</a>
</div>
${errorFlash ? `<div class="alert err">${esc(errorFlash)}</div>` : ''}
<form method="post" action="/projets/${idx}/save">
  <div class="card">
    <div class="card-title">Informations</div>
    <div class="field"><label>Titre</label><input type="text" name="titre" value="${esc(p.titre)}"></div>
    <div class="field"><label>Description</label><textarea name="description" rows="4">${esc(p.description)}</textarea></div>
    <div class="g2">
      <div class="field"><label>Catégorie</label><select name="categorie">${catOpts}</select></div>
      <div class="field"><label>Lieu</label><input type="text" name="lieu" value="${esc(p.lieu || '')}"></div>
    </div>
    <div class="g2">
      <div class="field"><label>Année</label><input type="text" name="annee" value="${esc(p.annee || '')}"></div>
      <div class="field"><label>Image de couverture (nom fichier)</label><input type="text" name="couverture" value="${esc(p.couverture || '')}"></div>
    </div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
        <input type="checkbox" name="vedette" value="1"${p.vedette ? ' checked' : ''}> Mettre en vedette (accueil)
      </label>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Images (une par ligne, ex: 01.jpeg)</div>
    <div class="field">
      <textarea name="images" rows="${Math.max(4, p.images.length + 2)}">${esc(p.images.join('\n'))}</textarea>
    </div>
    <p style="font-size:.72rem;color:var(--dim)">Dossier : <code>public/images/projets/${esc(p.slug)}/</code></p>
  </div>
  <div style="display:flex;gap:.75rem;align-items:center">
    <button type="submit" class="btn btn-ok">💾 Enregistrer</button>
    <a href="/projets" class="btn btn-sm">Annuler</a>
  </div>
</form>`, 'projets', flash, errorFlash);
}

/* ── Routeur ─────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();
  const p = url.pathname.replace(/\/+$/, '') || '/';

  function send(html, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
  function redirect(to) {
    res.writeHead(302, { Location: to });
    res.end();
  }

  /* — Auth — */
  if (p === '/login') {
    if (method === 'GET') return send(loginPage());
    if (method === 'POST') {
      const data = await readBody(req);
      if (data.password === PASSWORD) {
        const tok = mkToken();
        sessions.add(tok);
        res.writeHead(302, { 'Set-Cookie': `admin_token=${tok}; Path=/; HttpOnly; SameSite=Strict`, Location: '/site' });
        res.end();
      } else {
        return send(loginPage('Mot de passe incorrect.'));
      }
    }
    return;
  }

  if (p === '/logout') {
    const tok = getCookie(req, 'admin_token');
    if (tok) sessions.delete(tok);
    res.writeHead(302, { 'Set-Cookie': 'admin_token=; Path=/; Max-Age=0', Location: '/login' });
    res.end();
    return;
  }

  if (!isAuth(req)) return redirect('/login');
  if (p === '/') return redirect('/site');

  /* — Infos générales — */
  if (p === '/site') return send(sitePage());
  if (p === '/site/save' && method === 'POST') {
    const d = await readBody(req);
    const s = readSite();
    s.nom = d.nom ?? s.nom;
    s.marque = d.marque ?? s.marque;
    s.sousTitre = d.sousTitre ?? s.sousTitre;
    s.baseline = d.baseline ?? s.baseline;
    s.zone = d.zone ?? s.zone;
    s.telephone = d.telephone ?? s.telephone;
    s.email = d.email ?? s.email;
    s.horaires = d.horaires ?? s.horaires;
    s.facebookUrl = d.facebookUrl ?? s.facebookUrl;
    s.googleAvisUrl = d.googleAvisUrl ?? s.googleAvisUrl;
    s.pagesJaunesUrl = d.pagesJaunesUrl ?? s.pagesJaunesUrl;
    s.adresse = { ...s.adresse, rue: d.adresse_rue, codePostal: d.adresse_cp, ville: d.adresse_ville };
    const err = safeWrite(() => writeSite(s));
    if (err) return send(sitePage('', err));
    return send(sitePage('Informations enregistrées avec succès.'));
  }

  /* — Intro accueil — */
  if (p === '/intro') return send(introPage());
  if (p === '/intro/save' && method === 'POST') {
    const d = await readBody(req);
    const s = readSite();
    s.introAccueil = { paragraphe1: d.p1, paragraphe2: d.p2, zone: d.zone, cta: d.cta };
    const err = safeWrite(() => writeSite(s));
    if (err) return send(introPage('', err));
    return send(introPage('Texte d\'accueil enregistré.'));
  }

  /* — Métiers — */
  if (p === '/metiers') return send(metiersPage());
  if (p === '/metiers/save' && method === 'POST') {
    const d = await readBody(req);
    const s = readSite();
    s.metiers = s.metiers.map((m, i) => ({
      ...m,
      sousTitre: d[`metier_${i}_sousTitre`] ?? m.sousTitre,
      description: d[`metier_${i}_description`] ?? m.description,
      alt: d[`metier_${i}_alt`] ?? m.alt,
    }));
    const err = safeWrite(() => writeSite(s));
    if (err) return send(metiersPage('', err));
    return send(metiersPage('Services enregistrés.'));
  }

  /* — À propos — */
  if (p === '/apropos') return send(aproposPage());
  if (p === '/apropos/save' && method === 'POST') {
    const d = await readBody(req);
    const s = readSite();
    s.aPropos = s.aPropos || {};
    s.aPropos.paragraphe1 = d.p1;
    s.aPropos.paragraphe2 = d.p2;
    const certs = [];
    let ci = 0;
    while (d[`cert_${ci}`] !== undefined) { if (d[`cert_${ci}`].trim()) certs.push(d[`cert_${ci}`]); ci++; }
    s.aPropos.certifications = certs.length ? certs : s.aPropos.certifications;
    const err = safeWrite(() => writeSite(s));
    if (err) return send(aproposPage('', err));
    return send(aproposPage('Page À propos enregistrée.'));
  }

  /* — FAQ — */
  if (p === '/faq') return send(faqPage());
  if (p === '/faq/save' && method === 'POST') {
    const d = await readBody(req);
    const s = readSite();
    const action = d.action || 'save';

    if (d.delete_faq !== undefined) {
      const idx = parseInt(d.delete_faq, 10);
      s.faq.splice(idx, 1);
      const err = safeWrite(() => writeSite(s));
      if (err) return send(faqPage('', err));
      return send(faqPage('Question supprimée.'));
    }

    const updated = [];
    let i = 0;
    while (d[`q_${i}`] !== undefined) {
      if (d[`q_${i}`].trim()) updated.push({ question: d[`q_${i}`], answer: d[`a_${i}`] });
      i++;
    }
    if (action === 'add' && d.new_q?.trim()) {
      updated.push({ question: d.new_q, answer: d.new_a || '' });
    }
    s.faq = updated;
    const faqErr = safeWrite(() => writeSite(s));
    if (faqErr) return send(faqPage('', faqErr));
    return send(faqPage(action === 'add' ? 'Question ajoutée.' : 'FAQ enregistrée.'));
  }

  /* — Avis — */
  if (p === '/avis') return send(avisPage());
  if (p === '/avis/save' && method === 'POST') {
    const d = await readBody(req);
    const s = readSite();

    if (d.delete_avis !== undefined) {
      const idx = parseInt(d.delete_avis, 10);
      s.avis.splice(idx, 1);
      const err = safeWrite(() => writeSite(s));
      if (err) return send(avisPage('', err));
      return send(avisPage('Avis supprimé.'));
    }

    const action = d.action || 'save';
    const updated = [];
    let i = 0;
    while (d[`t_${i}`] !== undefined) {
      if (d[`t_${i}`].trim()) updated.push({ texte: d[`t_${i}`], auteur: d[`au_${i}`] });
      i++;
    }
    if (action === 'add' && d.new_t?.trim()) {
      updated.push({ texte: d.new_t, auteur: d.new_au || '' });
    }
    s.avis = updated;
    const avisErr = safeWrite(() => writeSite(s));
    if (avisErr) return send(avisPage('', avisErr));
    return send(avisPage(action === 'add' ? 'Avis ajouté.' : 'Avis enregistrés.'));
  }

  /* — Projets — */
  if (p === '/projets') return send(projetsPage());

  const editMatch = p.match(/^\/projets\/(\d+)\/edit$/);
  if (editMatch) {
    const html = projetEditPage(parseInt(editMatch[1], 10));
    return html ? send(html) : redirect('/projets');
  }

  const saveMatch = p.match(/^\/projets\/(\d+)\/save$/);
  if (saveMatch && method === 'POST') {
    const idx = parseInt(saveMatch[1], 10);
    const d = await readBody(req);
    const ps = readProjets();
    if (!ps[idx]) return redirect('/projets');
    ps[idx] = {
      ...ps[idx],
      titre: d.titre ?? ps[idx].titre,
      description: d.description ?? ps[idx].description,
      categorie: d.categorie ?? ps[idx].categorie,
      lieu: d.lieu ?? ps[idx].lieu,
      annee: d.annee ?? ps[idx].annee,
      couverture: d.couverture ?? ps[idx].couverture,
      vedette: d.vedette === '1',
      images: (d.images || '').split('\n').map(l => l.trim()).filter(Boolean),
    };
    const saveErr = safeWrite(() => writeProjets(ps));
    if (saveErr) {
      const html = projetEditPage(idx, '', saveErr);
      return html ? send(html) : redirect('/projets');
    }
    return redirect('/projets?saved=1');
  }

  if (url.searchParams.get('saved')) return send(projetsPage('Projet enregistré.'));

  send('<p>Page introuvable</p>', 404);
});

server.listen(PORT, () => {
  console.log(`\n✅  Admin Marant Jonathan démarré`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Authentification via ADMIN_PASSWORD (variable d'environnement)\n`);
});
