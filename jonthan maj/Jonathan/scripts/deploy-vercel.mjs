/**
 * Déploie le dossier `dist/` sur le projet Vercel lié dans `.vercel/` (ex. marant-jonathan).
 * Copie la liaison après le build : sinon `vercel deploy dist` crée un projet nommé « dist ».
 * Après déploiement, rattache `${projectName}.vercel.app` au dernier déploiement (sinon l’URL
 * courte peut rester sur une ancienne version alors que les URLs uniques sont à jour).
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(root);

if (!existsSync(join(root, '.vercel', 'project.json'))) {
  console.error('Lancez d’abord : npx vercel link --yes --project marant-jonathan');
  process.exit(1);
}

execSync('npm run build', { stdio: 'inherit' });

/** Sans ceci, le déploiement `vercel deploy dist` lance `npm install` sur la racine uploadée (dist/) et échoue. */
writeFileSync(
  join(root, 'dist', 'package.json'),
  JSON.stringify(
    {
      name: 'jonathan-artisan-static',
      private: true,
      version: '1.0.0',
      description: 'Fichier minimal : le site est déjà construit dans ce dossier.',
    },
    null,
    2
  )
);
writeFileSync(
  join(root, 'dist', 'vercel.json'),
  JSON.stringify(
    {
      $schema: 'https://openapi.vercel.sh/vercel.json',
      installCommand: 'npm install',
      buildCommand: 'exit 0',
      /** Racine du déploiement = fichiers statiques déjà générés (pas de sous-dossier dist). */
      outputDirectory: '.',
    },
    null,
    2
  )
);

const dest = join(root, 'dist', '.vercel');
cpSync(join(root, '.vercel'), dest, { recursive: true });

const deploy = spawnSync(
  'npx',
  ['vercel@latest', 'deploy', 'dist', '--prod', '--yes', '--format', 'json'],
  { cwd: root, encoding: 'utf-8', shell: true, stdio: ['inherit', 'pipe', 'pipe'] }
);

const out = deploy.stdout ?? '';
const err = deploy.stderr ?? '';
process.stdout.write(out);
process.stderr.write(err);

const combined = `${out}${err}`;
if (deploy.status !== 0) {
  process.exit(deploy.status ?? 1);
}

/** Le CLI pretty-print le JSON (`{\n  "status": …`) — pas de `{"status"` collé. */
function parseLastOkDeployment(text) {
  const reStatus = /"status"\s*:\s*"ok"/g;
  let match;
  let lastAt = -1;
  while ((match = reStatus.exec(text)) !== null) {
    lastAt = match.index;
  }
  if (lastAt === -1) return null;
  const start = text.lastIndexOf('{', lastAt);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const j = parseLastOkDeployment(combined);
const deploymentUrl = j?.deployment?.url;
if (!j || !deploymentUrl) {
  console.error('Réponse Vercel inattendue (pas de JSON valide). Sortie :\n', combined);
  process.exit(1);
}

const deploymentHost = new URL(deploymentUrl).host;
const project = JSON.parse(readFileSync(join(root, '.vercel', 'project.json'), 'utf8'));
const aliasHost = `${project.projectName}.vercel.app`;

console.log(`\n→ Alias : https://${aliasHost} → https://${deploymentHost}\n`);

execSync(`npx vercel@latest alias set ${deploymentHost} ${aliasHost}`, {
  stdio: 'inherit',
  cwd: root,
  shell: true,
});
