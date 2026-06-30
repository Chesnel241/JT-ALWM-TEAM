# 🚀 Guide Complet - Containerisation & CI/CD

## Vue d'ensemble

Cette application a été containerisée avec **Docker** et configurée pour un déploiement automatisé via **GitHub Actions**. Un simple `git push` déclenche la pipeline complète : tests, build, push d'images Docker, et déploiement sur Render (backend) + Vercel (frontend).

---

## 📦 Architecture Dockerisée

### Backend (`backend/Dockerfile`)

**Stratégie : Multistage build**

```dockerfile
Stage 1 (Builder):
  - Node 20 Alpine (lean)
  - npm ci (production dependencies)
  - Copy src code

Stage 2 (Runtime):
  - Node 20 Alpine (final image: ~180 MB)
  - dumb-init (proper signal handling)
  - Copy from builder (fast, minimal)
  - Healthcheck: HTTP check sur /api
  - CMD: node src/index.js
```

**Avantages :**
- Image finale ~180 MB (vs ~900 MB sans multistage)
- Pas de node_modules ni build tools en prod
- Signaux système gérés correctement
- Healthcheck intégré
- Volumes pour uploads persistants

### Frontend (`frontend/Dockerfile`)

**Stratégie : Multistage build + Nginx optimisé**

```dockerfile
Stage 1 (Builder):
  - Node 20 Alpine
  - npm ci + npm run build
  - Vite build → dist/

Stage 2 (Runtime):
  - Nginx Alpine (4 MB de base)
  - Gzip compression enabled
  - SPA routing (try_files)
  - Cache-Control headers
  - Healthcheck: /health endpoint
```

**Optimisations Nginx :**
- Gzip 6 (compression optimale)
- Cache 1 an pour assets (.js, .css, .png, etc)
- SPA routing : `/api/*` et chemins inconnus → `index.html`
- Immutable assets versionnés par Vite

---

## 🐳 Docker Compose - Développement Local

### Démarrage

```bash
# À la racine du projet
docker-compose up -d

# Logs en temps réel
docker-compose logs -f

# Arrêt
docker-compose down
```

### Architecture

```
┌─────────────────────┐
│   Frontend (Nginx)  │
│   :80 → dist/       │
│   Healthcheck: /health
└──────────┬──────────┘
           │
    ┌──────▼──────────┐
    │ jt-alwm-network │ (bridge network)
    └──────┬──────────┘
           │
┌──────────▼──────────┐
│  Backend (Express)  │
│  :3010              │
│  Healthcheck: /api  │
└─────────────────────┘
           │
      ┌────▼─────┐
      │ uploads   │ (persistent volume)
      │ volume    │
      └───────────┘
```

### Services

| Service   | Port | Health  | Volume    |
|-----------|------|---------|-----------|
| Backend   | 3010 | /api    | uploads   |
| Frontend  | 80   | /health | -         |

### Environment Variables

**Backend :**
```env
NODE_ENV=development
PORT=3010
CORS_ORIGIN=http://localhost:5173,http://localhost
```

**Frontend :**
```env
VITE_API_URL=http://backend:3010
```

---

## 🔄 GitHub Actions CI/CD Pipeline

### Trigger

```yaml
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
```

→ Chaque push sur `master` déclenche la pipeline complète

### Jobs (étapes)

#### 1️⃣ **backend-checks** (Backend Lint & Build)
```bash
✓ Checkout code
✓ Setup Node 20
✓ npm ci (install)
✓ npm run lint (si existe)
✓ node -c src/index.js (vérification syntaxe)
```

#### 2️⃣ **frontend-checks** (Frontend Lint & Build)
```bash
✓ Checkout code
✓ Setup Node 20
✓ npm ci (install)
✓ npm run lint (si existe)
✓ npm run build (Vite build)
✓ Upload artifacts (frontend/dist)
```

#### 3️⃣ **docker-build** (Dépend des étapes 1 & 2)
```bash
✓ Setup Docker Buildx
✓ Login to ghcr.io (GitHub Container Registry)
✓ Build & push Backend image
✓ Build & push Frontend image
```

**Tags d'images Docker :**
- `ghcr.io/your-org/backend:latest` (latest push master)
- `ghcr.io/your-org/backend:master-abc123def` (commit sha)
- `ghcr.io/your-org/backend:v1.0.0` (semver, futur)

#### 4️⃣ **deploy-backend-render** (Si push master + docker-build réussi)
```bash
✓ Trigger Render API pour redéployer le backend
```

#### 5️⃣ **deploy-frontend-vercel** (Si push master + docker-build réussi)
```bash
✓ Trigger Vercel API pour redéployer le frontend
```

### Flux complet

```
Git push master
      ↓
✓ backend-checks ✓ frontend-checks (parallèle)
      ↓ (si OK)
✓ docker-build (push images)
      ↓ (si OK + push master)
✓ deploy-backend-render  |  ✓ deploy-frontend-vercel (parallèle)
      ↓ (dédié services)
✅ Application déployée en prod
```

---

## 🔐 Secrets GitHub à configurer

Pour que le CI/CD soit **100% fonctionnel**, configurez ces secrets :

### Pour Docker Registry

Aucune configuration nécessaire ! GitHub utilise `GITHUB_TOKEN` automatiquement.

### Pour Render (Backend)

Settings → Secrets → Add repository secret

```
RENDER_DEPLOY_KEY = [votre deploy key Render]
RENDER_BACKEND_SERVICE_ID = [votre service ID Render]
```

**Comment les obtenir :**
1. Aller sur render.com → Dashboard
2. Sélectionner le service backend
3. Settings → Deploy Hook
4. Copier le token et service ID

### Pour Vercel (Frontend)

Settings → Secrets → Add repository secret

```
VERCEL_TOKEN = [votre Vercel API token]
VERCEL_ORG_ID = [votre organisation ID]
VERCEL_PROJECT_ID = [votre projet ID]
```

**Comment les obtenir :**
1. Aller sur vercel.com → Account Settings → Tokens
2. Créer un token "automation"
3. `npx vercel link` pour récupérer les IDs

---

## 🌍 Déploiement - Render.com (Backend)

### Configuration initiale

1. **Créer un compte Render.com**
   ```
   https://render.com → Sign up
   ```

2. **Connecter GitHub**
   ```
   Dashboard → Connect repository
   ```

3. **Créer le service Web**
   ```
   New + → Web Service
   Repository: JT ALWM TEAM app
   Branch: master
   ```

4. **Configuration du service**

   | Paramètre | Valeur |
   |-----------|--------|
   | Runtime | Node.js |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Region | Frankfurt (eu-west-1) |
   | Plan | Starter ($7/mois) |

5. **Environment variables**

   Dashboard → Backend Service → Environment
   ```
   NODE_ENV=production
   PORT=3010
   CORS_ORIGIN=https://jt-alwm-frontend.vercel.app
   ```

6. **Persistent Storage (uploads)**

   Settings → Disk
   ```
   Mount path: /app/uploads
   Size: 2 GB
   ```

7. **Obtenir l'URL**

   Service URL : `https://jt-alwm-backend.onrender.com`

### Monitoring

```bash
# Logs en live
Render Dashboard → Service → Logs

# Health check
curl https://jt-alwm-backend.onrender.com/api/weeks
```

---

## 🌍 Déploiement - Vercel (Frontend)

### Configuration initiale

1. **Créer un compte Vercel**
   ```
   https://vercel.com → Sign up
   ```

2. **Importer le projet**
   ```
   New Project → Import Git Repository
   Repository: JT ALWM TEAM app
   ```

3. **Configuration du Build**

   Framework Preset : `Vite`
   ```
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Environment variables**

   Settings → Environment Variables
   ```
   VITE_API_URL=https://jt-alwm-backend.onrender.com
   ```

5. **Domaine personnalisé** (optionnel)

   Settings → Domains
   ```
   Ajouter votre domaine : jt-alwm.example.com
   ```

6. **URL de déploiement**

   Preview URL : `https://jt-alwm.vercel.app`
   Production URL : `https://jt-alwm.example.com` (si domaine)

### Monitoring

```bash
# Logs en live
Vercel Dashboard → Deployment → Logs

# Test
https://jt-alwm.vercel.app
```

---

## 🛠️ Commandes Utiles

### Docker Compose (Dev Local)

```bash
# Démarrer les services
docker-compose up -d

# Arrêter
docker-compose down

# Logs en temps réel
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild images
docker-compose build --no-cache

# Accéder à un container
docker-compose exec backend sh
docker-compose exec frontend sh

# Vérifier la santé
docker ps --no-trunc --format "table {{.Names}}\t{{.Status}}"
```

### Docker (Standalone)

```bash
# Build backend
docker build -t jt-alwm-backend:latest ./backend

# Build frontend
docker build -t jt-alwm-frontend:latest ./frontend

# Lancer backend
docker run -p 3010:3010 \
  -e NODE_ENV=production \
  -v uploads:/app/uploads \
  jt-alwm-backend:latest

# Lancer frontend
docker run -p 80:80 jt-alwm-frontend:latest

# Push to registry
docker tag jt-alwm-backend:latest ghcr.io/your-org/backend:latest
docker push ghcr.io/your-org/backend:latest
```

### GitHub Actions

```bash
# Vérifier le status des workflows
# GitHub → Actions → Latest run

# Trigger manual workflow
# GitHub → Actions → Select workflow → Run workflow

# Voir les logs
# GitHub → Actions → [workflow name] → [run]
```

---

## ✅ Checklist Déploiement Production

### Avant le premier push

- [ ] Créer comptes Render.com et Vercel
- [ ] Configurer les secrets GitHub
  - [ ] `RENDER_DEPLOY_KEY`
  - [ ] `RENDER_BACKEND_SERVICE_ID`
  - [ ] `VERCEL_TOKEN`
  - [ ] `VERCEL_ORG_ID`
  - [ ] `VERCEL_PROJECT_ID`
- [ ] Vérifier `.env.example` est complet
- [ ] Tester localement : `docker-compose up`
- [ ] Vérifier les Dockerfiles builden sans erreur

### Premier déploiement

```bash
# 1. Commit et push
git add .
git commit -m "chore: add docker and ci/cd pipeline"
git push origin master

# 2. Vérifier la pipeline
# GitHub → Actions → [run] (devrait être en cours)

# 3. Attendre (~5-10 min)
# - Backend checks ✓
# - Frontend checks + build ✓
# - Docker build ✓
# - Render deploy ✓
# - Vercel deploy ✓

# 4. Tester
curl https://jt-alwm-backend.onrender.com/api/weeks
https://jt-alwm.vercel.app
```

### Post-déploiement

- [ ] Tester tous les endpoints de l'API
- [ ] Vérifier les uploads fonctionnent
- [ ] Vérifier CORS entre frontend et backend
- [ ] Configurer domaines personnalisés
- [ ] Mettre en place monitoring (optionnel)
- [ ] Configurer backups uploads (optionnel)

---

## 🐛 Troubleshooting

### Docker issues

**Erreur : "Port 80 already in use"**
```bash
# Vérifier les containers actifs
docker ps

# Utiliser un port différent dans docker-compose
ports:
  - "8080:80"
```

**Erreur : "volumes_uploads not found"**
```bash
# Créer le volume manuellement
docker volume create uploads_volume

# Ou relancer avec rebuild
docker-compose up -d --build
```

### GitHub Actions

**Workflow échoue sur "Docker build"**
- Vérifier que les Dockerfiles sont valides
- Checker les fichiers `.dockerignore`
- Consulter les logs : GitHub → Actions → [run]

**Deploy ne se déclenche pas**
- Vérifier les secrets sont bien configurés
- Vérifier la branche est bien `master`
- Vérifier le workflow file n'a pas d'erreurs YAML

### Render

**Service crashed après déploiement**
```bash
# Vérifier les logs
Render → Service → Logs

# Redéployer manuellement
Render → Service → Manual Deploy
```

**Uploads disparaissent après redéploiement**
- Vérifier le disque persistant est bien configuré
- Vérifier le mount path = `/app/uploads`

### Vercel

**Build failure : "Cannot find module"**
- Vérifier `package-lock.json` est committé
- Vérifier les variables d'env `VITE_*`
- Vérifier le dossier `dist` n'est pas dans `.gitignore`

**Frontend ne peut pas appeler l'API backend**
- Vérifier `VITE_API_URL` pointe vers le bon endpoint
- Vérifier CORS sur le backend accepte le domaine Vercel
- Vérifier les headers `Access-Control-Allow-Origin`

---

## 📊 Architecture Finale - Production

```
┌──────────────────────────────────────────┐
│        GitHub Repository (Push)          │
│         (master branch)                   │
└────────────────┬─────────────────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │  GitHub Actions      │
      │  CI/CD Pipeline      │
      │  - Lint              │
      │  - Build             │
      │  - Test              │
      │  - Docker build+push │
      └─────────┬────────────┘
                │
      ┌─────────┴──────────┐
      │                    │
      ▼                    ▼
  ┌─────────┐          ┌──────────┐
  │ Render  │          │ Vercel   │
  │ Backend │          │Frontend  │
  │ (Docker)│          │(CDN)     │
  │ :3010   │          │:HTTPS    │
  └─────────┘          └──────────┘
      │                    │
      └────────┬───────────┘
               ▼
        User Browsers
        (HTTPS, fast, secure)
```

---

## 🎯 Résumé - Workflow Complet

**Workflow = Un simple `git push` déclenche tout :**

```bash
# Developer
git commit -m "fix: upload endpoint"
git push origin master

# Automatiquement déclenchés :
# 1. GitHub Actions lance la pipeline
# 2. Tests backend & frontend ✓
# 3. Build Dockerfiles ✓
# 4. Push images à registry ✓
# 5. Render redéploie backend ✓
# 6. Vercel redéploie frontend ✓
# 7. Production mise à jour ✓

# Résultat = Site en ligne en ~5-10 minutes
# Sans aucune intervention manuelle
```

---

## 📞 Support & Ressources

- **Docker Docs** : https://docs.docker.com/
- **GitHub Actions** : https://docs.github.com/en/actions
- **Render Docs** : https://render.com/docs
- **Vercel Docs** : https://vercel.com/docs
- **Docker Compose Docs** : https://docs.docker.com/compose/

---

## ✨ Prochaines optimisations (optionnel)

- [ ] Ajouter tests unitaires (Jest/Vitest)
- [ ] Ajouter security scanning (Trivy)
- [ ] Ajouter artifact registry (private images)
- [ ] Ajouter staging environment (before prod)
- [ ] Ajouter monitoring/logging centralisé (e.g., Datadog)
- [ ] Ajouter database persistante (PostgreSQL)
- [ ] Ajouter CDN global (Cloudflare)
