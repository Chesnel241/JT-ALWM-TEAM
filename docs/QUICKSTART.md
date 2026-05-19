# ⚡ Quick Start - Docker & Déploiement

## 5 minutes pour démarrer localement

### 1️⃣ Installation Docker (si pas installé)

**Windows/Mac :**
```bash
https://www.docker.com/products/docker-desktop
```

**Linux :**
```bash
curl https://get.docker.com | sh
```

Vérifier l'installation :
```bash
docker --version
docker-compose --version
```

### 2️⃣ Démarrer l'app complète

```bash
cd ~/JT ALWM TEAM app

# Démarrer tous les services
docker-compose up -d

# Vérifier que tout est OK
docker-compose ps
```

**Résultat :**
```
NAME                  STATUS
jt-alwm-backend       Up (healthy)
jt-alwm-frontend      Up (healthy)
```

### 3️⃣ Accéder à l'application

- **Frontend** : http://localhost
- **Backend API** : http://localhost:3010/api/weeks
- **Logs** : `docker-compose logs -f`

### 4️⃣ Développement avec volumes

Les changements au code se reflètent en temps réel (hot reload) :

**Backend :**
```bash
# Modifier src/index.js
# Changements actifs immédiatement grâce au volume
```

**Frontend :**
```bash
# Modifier src/App.jsx
# Vite hot reload automatique
```

### 5️⃣ Arrêter & Nettoyer

```bash
# Arrêter les services
docker-compose down

# Supprimer tout (containers, images, volumes)
docker-compose down -v
```

---

## Premier déploiement en production

### 1️⃣ Créer les comptes

- **Render.com** : Backend (Node.js)
- **Vercel** : Frontend (React)

### 2️⃣ Configurer GitHub Secrets

Aller sur **GitHub → Settings → Secrets and variables → Actions**

Ajouter :
```
RENDER_DEPLOY_KEY = [clé Render]
RENDER_BACKEND_SERVICE_ID = [service ID Render]
VERCEL_TOKEN = [token Vercel]
VERCEL_ORG_ID = [org ID Vercel]
VERCEL_PROJECT_ID = [project ID Vercel]
```

### 3️⃣ Commit et Push

```bash
git add .
git commit -m "chore: add docker and ci/cd"
git push origin master
```

**La pipeline se déclenche automatiquement !**

### 4️⃣ Vérifier le déploiement

**GitHub :**
```
Actions → Latest run → (attendre ~10 min)
```

**Résultat :**
- Backend : `https://jt-alwm-backend.onrender.com`
- Frontend : `https://jt-alwm.vercel.app`

---

## Commandes utiles

```bash
# Logs en temps réel
docker-compose logs -f backend
docker-compose logs -f frontend

# Accéder au container
docker-compose exec backend sh
docker-compose exec frontend sh

# Rebuild images
docker-compose build --no-cache

# Vérifier la santé
docker-compose ps

# Nettoyer complètement
docker system prune -a
```

---

## Fichiers créés

✅ `backend/Dockerfile` - Multistage Node.js  
✅ `frontend/Dockerfile` - Nginx + SPA routing  
✅ `docker-compose.yml` - Orchestration locale  
✅ `.github/workflows/deploy.yml` - CI/CD pipeline  
✅ `render.yaml` - Config Render backend  
✅ `vercel.json` - Config Vercel frontend  
✅ `.env.example` - Variables d'env template  

Voir [DOCKER_AND_CICD.md](./DOCKER_AND_CICD.md) pour le guide complet.
