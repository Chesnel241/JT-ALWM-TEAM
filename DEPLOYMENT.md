# 🚀 DEPLOYMENT GUIDE - JT ALWM TEAM

## 📋 Table des Matières

1. [Préparation](#préparation)
2. [Déploiement Backend](#déploiement-backend)
3. [Déploiement Frontend](#déploiement-frontend)
4. [Variables d'Environnement](#variables-denvironnement)
5. [Troubleshooting](#troubleshooting)
6. [Backup Strategy](#backup-strategy)

---

## Préparation

### Prérequis

- Node.js 18+
- npm/yarn
- Git
- Compte Render.com (backend) ou Vercel (frontend)
- Compte Sentry (error tracking)

### Repository

```bash
git clone https://github.com/Chesnel241/JT-ALWM-TEAM.git
cd "JT ALWM TEAM app"
```

---

## Déploiement Backend

### Option 1: Render.com (Recommandé)

#### Étape 1: Créer un Render Service

1. Aller sur [render.com](https://render.com)
2. Cliquer **New → Web Service**
3. Connecter votre repo GitHub
4. Configuration:
   - **Name**: `jt-alwm-backend`
   - **Environment**: `Node`
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Plan**: Starter (le plan Free ne supporte pas le disque persistant)
   - **Persistent Disk**: 2 GB, mount path `/app/uploads`

#### Étape 2: Ajouter les Variables d'Environnement

Dans Render dashboard, aller à **Environment**:

```
NODE_ENV=production
PORT=3010
CORS_ORIGIN=https://your-frontend-url.vercel.app
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id   # optionnel
MAX_FILE_SIZE=209715200                                   # 200 MB
LOG_DIR=/app/uploads/logs                                 # logs persistants
```

⚠️ `CORS_ORIGIN` doit être l'URL **exacte** du frontend Vercel (incluant `https://`).
Plusieurs origines : séparer par virgules sans espace, ex.
`https://prod.example.com,https://staging.example.com`.

#### Étape 3: Déployer

```bash
git push origin master
```

Render déploiera automatiquement.

### Option 2: Heroku (Alternatif)

```bash
cd backend
heroku login
heroku create jt-alwm-backend
heroku config:set NODE_ENV=production
heroku config:set SENTRY_DSN=<your-sentry-dsn>
git push heroku master
```

---

## Déploiement Frontend

### Option 1: Vercel (Recommandé)

#### Étape 1: Lier le projet

1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer **Import Project**
3. Sélectionner votre repo GitHub
4. Configuration:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

#### Étape 2: Ajouter les Variables

Dans **Settings → Environment Variables**:

```
VITE_API_URL=https://jt-alwm-backend.onrender.com
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id   # optionnel
```

⚠️ **NE PAS** mettre de slash final dans `VITE_API_URL`. Le code l'ajoute lui-même.
⚠️ La variable s'appelle **`VITE_API_URL`** (et non `VITE_API_BASE_URL`).

#### Étape 3: Déployer

```bash
git push origin master
```

Vercel déploiera automatiquement.

### Option 2: Netlify (Alternatif)

```bash
npm install -g netlify-cli
cd frontend
netlify deploy
```

---

## Variables d'Environnement

### Backend (.env)

```env
# Serveur
NODE_ENV=production
PORT=3010

# CORS
CORS_ORIGIN=https://your-frontend-url.com

# Sentry (Error Tracking)
SENTRY_DSN=https://xxxx@sentry.io/xxxx

# Database (si futur)
DATABASE_URL=

# Storage (si futur)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### Frontend (.env.production)

```env
VITE_API_URL=https://your-backend-url.onrender.com
VITE_SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

### Générer une Clé Sentry

1. Créer compte [Sentry.io](https://sentry.io)
2. Créer un nouveau projet (Node.js pour backend, React pour frontend)
3. Copier le DSN
4. Ajouter aux variables d'environnement

---

## Troubleshooting

### Problème: Backend ne démarre pas

**Symptômes**: Application crashes au déploiement

**Solutions**:
```bash
# Vérifier les logs
render logs

# Vérifier les variables d'env
echo $NODE_ENV

# Tester localement
npm run dev
```

### Problème: CORS errors au frontend

**Symptômes**: `Access-Control-Allow-Origin` error

**Solutions**:
1. Vérifier que `CORS_ORIGIN` est correct
2. Redéployer le backend
3. Vider cache navigateur (Ctrl+Shift+Delete)

```javascript
// Backend - vérifier cors/index.js
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173' 
}));
```

### Problème: Fichiers uploadés disparaissent

**Symptômes**: Fichiers ne persistent pas après restart

**Solutions**:
- Render supprime les fichiers entre redéploiements
- Utiliser un service externe: AWS S3, Cloudinary, etc.
- Voir section Backup Strategy

### Problème: Frontend vide

**Symptômes**: Page blanche

**Solutions**:
1. Vérifier `VITE_API_URL`
2. Vérifier console (F12) pour errors
3. Vérifier logs Vercel

```bash
vercel logs --follow
```

### Problème: Erreurs n'apparaissent pas dans Sentry

**Symptômes**: Sentry vide

**Solutions**:
```bash
# Vérifier que Sentry est initialisé
curl https://backend.com/health

# Vérifier les events Sentry
# Dashboard Sentry → Issues
```

---

## Backup Strategy

### 1. Sauvegarder la Base de Données

```bash
# PostgreSQL
pg_dump dbname > backup.sql

# MongoDB
mongodump --archive=backup.archive
```

### 2. Sauvegarder les Fichiers Uploadés

```bash
# S'il y a stockage local:
tar -czf uploads_backup.tar.gz uploads/

# Utiliser S3 pour prod:
aws s3 sync uploads/ s3://my-bucket/uploads/
```

### 3. Stratégie de Récupération

**Quotidien**:
- Backups automatiques (via provider)
- Sentry logs conservés

**Hebdomadaire**:
- Export DB manuelle
- Archive uploads sur S3

**Mensuel**:
- Audit complet
- Test restore

### 4. Provider-Specific Backups

#### Render.com
- Données persistent: stockage externe (S3)
- Code: GitHub (toujours en backup)
- DB: backups gérés si PostgreSQL Render

#### Vercel
- Code: GitHub
- Builds: stockés 30 jours
- Logs: retenus 14 jours

#### Sentry
- Events: conservés 90 jours (gratuit)
- Alertes: configurées pour notifications

---

## Production Checklist

- [ ] Variables d'environnement définies
- [ ] SSL/HTTPS activé (auto avec Vercel/Render)
- [ ] Sentry configuré et testé
- [ ] CORS validé
- [ ] Uploads marchent et persistent
- [ ] Health check répond `/health`
- [ ] Logs centralisés (Sentry)
- [ ] Monitoring activé (UptimeRobot)
- [ ] Backups planifiés
- [ ] DNS configuré (custom domain)
- [ ] Tests de load (basic)

---

## Support & Contact

- **Bug Reports**: GitHub Issues
- **Documentation**: Voir MONITORING.md, DESIGN.md
- **API Docs**: `https://backend.com/api-docs`

---

**Dernière mise à jour**: 2026-05-19
