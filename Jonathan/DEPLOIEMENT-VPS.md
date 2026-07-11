# Deploiement VPS - Jonathan

Ce projet est un site **Astro statique**.

- Pas de PHP
- Pas de base de donnees
- Pas de backend applicatif a lancer
- Nginx suffit pour la production

## Dossier cible

Exemple de dossier de deploiement :

```bash
/var/www/jonathan
```

## Build

Depuis le projet :

```bash
npm install
SITE_URL=https://marant-jonathan.fr npm run build
```

Le site genere les fichiers statiques dans :

```bash
dist/
```

## Copie sur le VPS

```bash
sudo mkdir -p /var/www/jonathan
sudo rsync -av --delete dist/ /var/www/jonathan/
sudo chown -R www-data:www-data /var/www/jonathan
sudo find /var/www/jonathan -type d -exec chmod 755 {} \;
sudo find /var/www/jonathan -type f -exec chmod 644 {} \;
```

## Nginx

Creer un fichier dedie, par exemple :

```bash
/etc/nginx/sites-available/votre-domaine.fr
```

Contenu :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name votre-domaine.fr www.votre-domaine.fr;

    root /var/www/jonathan;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log /var/log/nginx/jonathan.access.log;
    error_log /var/log/nginx/jonathan.error.log;
}
```

Activation :

```bash
sudo ln -s /etc/nginx/sites-available/votre-domaine.fr /etc/nginx/sites-enabled/votre-domaine.fr
sudo nginx -t
sudo systemctl reload nginx
```

## DNS

Creer au minimum :

- type `A`
- nom `@`
- valeur `IP_PUBLIQUE_DU_VPS`

Et si vous utilisez `www` :

- type `A` ou `CNAME`
- nom `www`
- valeur `IP_PUBLIQUE_DU_VPS` ou `votre-domaine.fr`

## HTTPS

Quand le DNS pointe bien vers le VPS :

```bash
sudo certbot --nginx -d votre-domaine.fr -d www.votre-domaine.fr
```

## Verification

```bash
curl -I http://votre-domaine.fr
curl -I https://votre-domaine.fr
sudo nginx -t
```

## Important

Ce deploiement est autonome : il utilise son propre dossier web, son propre bloc Nginx et son propre nom de domaine, sans toucher aux autres sites deja en place.
