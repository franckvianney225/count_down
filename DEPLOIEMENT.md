# Déploiement — Countdown sous jdn.telecom.gouv.ci/countdown/

## Architecture

```
jdn.telecom.gouv.ci/                    → App JDN existante (React, port 3002)
jdn.telecom.gouv.ci/countdown/          → Frontend Next.js (port 8005)
jdn.telecom.gouv.ci/countdown/api/      → Backend NestJS (port 8006)
jdn.telecom.gouv.ci/countdown/socket.io/ → WebSocket Socket.IO
jdn.telecom.gouv.ci/countdown/uploads/  → Images uploadées
```

## Modifications apportées au code

### 1. `frontend/next.config.ts`
```ts
basePath: '/countdown',
```
Next.js préfixe automatiquement toutes les routes.

### 2. `backend/src/main.ts`
```ts
app.setGlobalPrefix('countdown/api');
```
Toutes les routes NestJS sont préfixées.

### 3. `backend/src/auth/auth.controller.ts`
```ts
path: '/countdown',  // sur le cookie JWT
res.clearCookie('auth_token', { path: '/countdown' });
```
Le cookie est restreint au chemin `/countdown` pour ne pas interférer avec JDN.

### 4. `frontend/src/components/AdminDashboard.tsx`
5 URLs de partage mises à jour :
```ts
`${window.location.origin}/countdown/vote/${q.code}`
`${window.location.origin}/countdown/vote/${q.code}/results`
```

### 5. `frontend/src/app/vote/[code]/page.tsx`
```ts
`${window.location.origin}/countdown/vote/${code}`
```

### 6. `frontend/src/lib/socket.ts`
```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';
const WS_URL = API_URL.replace(/\/countdown\/api$/, '');
// ...
io(WS_URL, { path: '/countdown/socket.io', ... });
```
Correction : extraction de l'origine pour éviter que le chemin `/countdown/api` soit interprété comme un namespace Socket.IO.

### 7. `docker-compose.yml`
```yaml
FRONTEND_URL: https://jdn.telecom.gouv.ci
NEXT_PUBLIC_API_URL: https://jdn.telecom.gouv.ci/countdown/api
```

## Problèmes rencontrés et solutions

### 1. Base de données absente
**Symptôme :** `countdown_backend` redémarre en boucle — `P1001: Can't reach database server at postgres:5432`
**Cause :** Le conteneur `countdown_postgres` était éteint.
**Solution :** `docker compose up -d postgres`

### 2. Locations Nginx hors du server block
**Symptôme :** `nginx -t` → `"location" directive is not allowed here`
**Cause :** Les blocs `location /countdown/...` étaient placés après la fermeture `}`
**Solution :** Déplacer les locations à l'intérieur du server block, avant l'accolade fermante.

### 3. Redirect 308 sur `/countdown/`
**Symptôme :** Next.js redirige `/countdown/` → `/countdown` (enlève le slash), mais Nginx avait `location /countdown/` (avec slash) qui ne matchait pas.
**Solution :** Remplacer `location /countdown/` par `location /countdown` (sans slash final).

### 4. Namespace Socket.IO incorrect
**Symptôme :** API HTTP fonctionne (201 Created) mais l'UI ne se met pas à jour.
**Cause :** `io('https://jdn.telecom.gouv.ci/countdown/api')` → Socket.IO utilise le chemin comme namespace (`/countdown/api`), mais la gateway NestJS utilise le namespace par défaut `/`.
**Solution :** Extraire l'origine de l'URL (`https://jdn.telecom.gouv.ci`) pour se connecter au namespace `/`.

### 5. `.env` écrasé par la config Nginx
**Symptôme :** Le fichier `.env` local contenait la config Nginx au lieu des variables d'environnement.
**Solution :** Restaurer le `.env` avec les bonnes variables.

## Config Nginx complète

```nginx
server {
    server_name jdn.telecom.gouv.ci;
    client_max_body_size 10M;

    # App JDN existante
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/auth/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/proxy/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /var/lib/docker/volumes/jdn_uploads_data/_data/;
        autoindex off;
        expires 30d;
        add_header Cache-Control "public, immutable, max-age=2592000";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/jdn/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /jdn/api/ {
        proxy_pass http://127.0.0.1:3001/jdn/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # === Countdown ===
    location /countdown/_next/static/ {
        proxy_pass http://127.0.0.1:8005;
        expires 365d;
    }

    location /countdown/api/ {
        proxy_pass http://127.0.0.1:8006/countdown/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /countdown/socket.io/ {
        proxy_pass http://127.0.0.1:8006/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /countdown {
        proxy_pass http://127.0.0.1:8005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /countdown/uploads/ {
        proxy_pass http://127.0.0.1:8006/countdown/uploads/;
        expires 7d;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/jdn.telecom.gouv.ci/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jdn.telecom.gouv.ci/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = jdn.telecom.gouv.ci) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name jdn.telecom.gouv.ci;
    return 404;
}
```

## Branche git

Toutes les modifications sont sur la branche `prod`.

```bash
git checkout prod
git push origin prod
```

## URLs de vérification

| URL | Résultat attendu |
|-----|-----------------|
| `https://jdn.telecom.gouv.ci/countdown/` | Timer public |
| `https://jdn.telecom.gouv.ci/countdown/admin/login` | Login admin |
| `https://jdn.telecom.gouv.ci/countdown/admin/dashboard` | Dashboard admin |
| `https://jdn.telecom.gouv.ci/countdown/minimal` | Mode minimal |
| `https://jdn.telecom.gouv.ci/countdown/overlay` | Mode overlay |
| `https://jdn.telecom.gouv.ci/` | App JDN intacte |
