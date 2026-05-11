# Guide — Ajouter un projet / chantier

## Import en masse depuis le dossier `réalisations`

À la racine du projet, un dossier nommé **réalisations** (avec accent) peut contenir **un sous-dossier par chantier** (ex. `escalier colimaçon`, `pergolas`). Chaque sous-dossier = un projet sur le site.

Après avoir ajouté ou modifié des photos :

```bash
npm run import:realisations
```

Ce script copie les images dans `public/images/projets/<slug>/` (fichiers `01.jpeg`, `02.jpeg`, …) et **régénère** `src/data/projets.json`. Les catégories (menuiserie / charpente / zinguerie) sont déduites du nom du dossier ; les **vignettes d’accueil** (`vedette`) sont définies dans `scripts/import-realisations.mjs` (fonction `vedettePourSlug`).

---

## 1. Préparer les photos

- Renommer les images dans l'ordre souhaité : `01.jpg`, `02.jpg`, `03.jpg`, etc.
- Format recommandé : JPEG, largeur ≥ 1600 px, qualité 80-85 %.
- La première image (`01.jpg`) sera utilisée comme couverture dans la liste des projets.

## 2. Créer le dossier

Placer les images dans :

```
public/images/projets/<slug-du-projet>/
```

Le `slug` est un identifiant sans espaces ni accents (ex : `escalier-chene-massif`).

## 3. Déclarer le projet

Ouvrir `src/data/projets.json` et ajouter une entrée :

```json
{
  "slug": "escalier-chene-massif",
  "titre": "Escalier en chêne massif",
  "categorie": "menuiserie",
  "annee": "2025",
  "lieu": "Bretagne",
  "description": "Description courte du chantier (2-3 phrases).",
  "images": ["01.jpg", "02.jpg", "03.jpg"],
  "couverture": "01.jpg",
  "video": null,
  "vedette": false
}
```

- `categorie` : `menuiserie`, `charpente` ou `zinguerie`
- `vedette` : `true` pour afficher le projet sur la page d'accueil
- `video` : chemin vers un fichier MP4 (ex : `/images/projets/escalier-chene-massif/video.mp4`), ou `null`

## 4. Reconstruire le site

```bash
npm run build
```

Le site statique est généré dans le dossier `dist/`.

## 5. Modifier les informations de l'artisan

Toutes les coordonnées, textes et métiers se trouvent dans `src/data/site.json`.

---

## Déploiement Netlify — pourquoi les photos ne s’affichent pas

Netlify reconstruit le site à partir de **votre dépôt Git** (ou d’un ZIP). Si les images **ne sont pas dans le commit** poussé sur GitHub / GitLab, le build Netlify **ne les aura pas** : les pages pointeront vers `/images/projets/...` mais les fichiers seront absents → vignettes et galeries vides ou cassées.

**À versionner et pousser obligatoirement :**

- tout le dossier **`public/images/projets/`** (généré par `npm run import:realisations`) ;
- **`public/images/logo-mj.png`** si vous l’utilisez ;
- les fichiers dans **`src/photo background/`** (fonds du hero, embarqués au build).

Ensuite : `git add`, `git commit`, `git push`, puis attendre le déploiement Netlify.

Le fichier **`netlify.toml`** à la racine fixe la commande `npm run build` et le répertoire de publication **`dist`**. Dans l’interface Netlify, vérifiez qu’aucun autre « répertoire de publication » ou « base directory » ne contredit ce réglage (sauf si le site est dans un sous-dossier du mono-repo).

---

## Glisser-déposer **tout le dossier** du projet sur Netlify (sans Git)

Netlify ne lance **pas** `npm run build` sur un dossier déposé tel quel : il sert les fichiers tels quels. Le site généré par Astro se trouve dans **`dist/`**, pas à la racine. Pour que **tout le dossier Jonathan** fonctionne une fois déposé :

1. **Photos des réalisations** (si besoin) : `npm run import:realisations`
2. **Générer le site avec le bon préfixe** :
   ```bash
   npm run build:netlify-drop
   ```
   Cela remplit **`dist/`** avec des liens du type `/dist/realisations`, `/dist/images/…`, etc.
3. **Déposer sur Netlify** : compressez **tout le dossier du projet** (racine avec `package.json`, `dist/`, `_redirects`, etc.) et glissez le ZIP ou le dossier.
4. Le fichier **`_redirects`** à la racine redirige **`/`** vers **`/dist/`** : l’accès à la page d’accueil fonctionne.

Pour travailler en local après ça, refaites un build classique :

```bash
npm run build
```

(les URLs redeviennent `/`, `/realisations`, … sans préfixe `/dist/`).
