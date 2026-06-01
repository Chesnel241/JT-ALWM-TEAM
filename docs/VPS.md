# Déploiement VPS (Hetzner) — JT ALWM

Déploiement mono-serveur : un conteneur **backend** (Express + ffmpeg) et un
conteneur **frontend** (nginx) qui sert le SPA et proxifie `/api` + `/uploads`
vers le backend. Un seul port public (80), pas de CORS cross-origin.

```
Navigateur ──80──> nginx (frontend)
                     ├── /            → SPA (React build)
                     ├── /api/…       → proxy ─> backend:3010
                     └── /uploads/…   → proxy ─> backend:3010 (302 vers R2)
```

## 1. Prérequis serveur

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
# (compose v2 inclus dans Docker récent : `docker compose version`)
```

## 2. Configuration

```bash
git clone <repo> jt-alwm && cd jt-alwm
cp .env.example .env
nano .env          # renseigner AU MINIMUM :
                   #   GLOBAL_PASSWORD, ADMIN_PASSWORD
                   #   CORS_ORIGIN (ton IP/domaine)
                   #   PUBLIC_API_URL
                   #   R2_* + UPSTASH_* si stockage/DB externes
```

> **Important** : `NODE_ENV=production` est imposé par `docker-compose.prod.yml`.
> Le backend **refuse de démarrer** sans `GLOBAL_PASSWORD` (fail-closed).

## 3. Lancement

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Vérification :

```bash
curl -sI http://localhost/                       # SPA (200)
curl -s  http://localhost/api/auth/check          # 401 (pas de header) = OK
curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"password":"<GLOBAL_PASSWORD>"}' \
     http://localhost/api/auth/login              # {"success":true,...}
```

## 4. ⚠️ HTTPS — fortement recommandé (quasi obligatoire)

En **HTTP simple** (`http://178.105.250.97`) :

- **Le mot de passe de login transite en clair** sur le réseau (interceptable).
- **Le Service Worker ne s'enregistre pas** (contexte non sécurisé) → pas de
  cache offline ni d'auto-update PWA. Les mises à jour passent quand même au
  rechargement (index.html est `no-cache`), mais l'app perd son mode PWA.

### Solution : un domaine + Let's Encrypt (gratuit)

Let's Encrypt **ne délivre pas de certificat pour une IP nue** → il faut un
nom de domaine pointant sur `178.105.250.97` (un sous-domaine gratuit suffit).

Le plus simple : **Caddy** en frontal (TLS automatique).

```
# Caddyfile (à la racine)
jt.mondomaine.com {
    reverse_proxy localhost:80
}
```

```bash
# Caddy s'occupe du certificat + renouvellement automatiquement.
docker run -d --name caddy --network host \
  -v $PWD/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data caddy:2
```

Puis mettre à jour `.env` :
```
CORS_ORIGIN=https://jt.mondomaine.com
PUBLIC_API_URL=https://jt.mondomaine.com
```
et rebuild : `docker compose -f docker-compose.prod.yml up -d --build`.

## 5. Pare-feu Hetzner

Ouvrir **80** (et **443** si HTTPS). Ne PAS exposer **3010** (le backend n'est
joignable que via le réseau Docker interne — il n'a pas de port public dans
`docker-compose.prod.yml`).

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 6. Persistance des données

- **uploads / exports** : volume Docker `uploads_volume` (survit aux
  redémarrages). Pour ne rien perdre en cas de réinstall serveur, configurer
  **R2** (`R2_*`) → fichiers stockés hors VPS.
- **store (métadonnées semaines/pays/uploads)** : fichier local dans le volume,
  ou **Upstash Redis** (`UPSTASH_*`) pour persistance externe.

## 7. Mise à jour de l'app

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Les assets frontend sont hashés et `index.html` est `no-cache` → les pays
reçoivent la nouvelle version au rechargement (vider le cache inutile).

## 8. Rendu vidéo master

- `RENDERER=libass` (défaut) : rendu **dans le conteneur backend** via le
  `ffmpeg` système (installé dans l'image, compatible musl/alpine). Aucune
  dépendance externe.
- `RENDERER=remotion` : délègue à un worker Cloud Run distant (voir
  `docs/CLOUD_RUN.md`). Nécessite `RENDER_WORKER_URL`, `WORKER_KEY`,
  `PUBLIC_API_URL`.
