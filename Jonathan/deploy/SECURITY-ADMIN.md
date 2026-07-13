# Sécurité administration — notes de déploiement

## checkOrigin (Astro)

`checkOrigin: true` est activé dans `astro.config.mjs`, avec `allowedDomains` pour
`marant-jonathan.fr`, `www.marant-jonathan.fr`, et `localhost` (dev).

Derrière Nginx, le proxy doit transmettre :

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Et `TRUST_PROXY=true` dans le conteneur.

## CSRF admin (couche applicative)

En complément de checkOrigin Astro :

- Session signée HMAC (`mj_admin_session`) — cookie HttpOnly, Secure en prod, SameSite=Lax, 8 h
- Jeton CSRF aléatoire embarqué dans la session signée (pas de secret en clair dans le cookie)
- Chaque POST `/api/admin/*` (sauf login) exige le champ `csrf` identique au jeton session
- Comparaison `timingSafeEqual`
- Login : nouvelle session à chaque connexion (anti-fixation)

## Rate limiting login

- Compteur en mémoire (réinitialisé au redémarrage du processus)
- IP lue depuis `X-Forwarded-For` uniquement si `TRUST_PROXY=true`

## Volume Docker

- `docker compose down` conserve le volume `marant-jonathan-data`
- `docker compose down -v` supprimerait les données — à éviter en production
