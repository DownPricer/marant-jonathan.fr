/**
 * Build pour déploiement Netlify « dossier complet » (glisser-déposer la racine du projet).
 * Les assets utilisent le préfixe /dist/ ; un _redirects à la racine envoie / vers /dist/.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NETLIFY_DROP: '1' },
});

process.exit(r.status ?? 1);
