# 🎯 ACTION PLAN - Prochaines Étapes Critiques

## 🚨 3 Étapes Prioritaires

### ÉTAPE 1️⃣ : Test Local (30 min) - AUJOURD'HUI
**Objectif** : Vérifier que Docker fonctionne en dev

```bash
# 1. Vérifier Docker installé
docker --version
docker-compose --version

# 2. Aller au dossier projet
cd ~/JT ALWM\ TEAM\ app

# 3. Démarrer l'app complète
docker-compose up -d

# 4. Vérifier les services
docker-compose ps

# 5. Tester l'accès
# Frontend : http://localhost
# Backend API : http://localhost:3010/api/weeks

# 6. Tester upload
# Dashboard → Upload un fichier → Vérifier qu'il s'affiche

# 7. Arrêter
docker-compose down
```

**✅ Succès si :**
- Tous les containers sont en état "Up"
- Frontend accessible sur http://localhost
- API répond sur :3010
- Uploads fonctionnent
- Pas d'erreurs 500 en console

**❌ Si problème :**
- Voir [`DOCKER_AND_CICD.md`](./DOCKER_AND_CICD.md) section Troubleshooting

---

### ÉTAPE 2️⃣ : Configurer les Services Hosting (1-2h) - CETTE SEMAINE

#### A. Render.com (Backend)

```
1. Aller à https://render.com
2. Sign up (ou login)
3. Dashboard → New + → Web Service
4. Connecter GitHub repository
5. Configuration:
   - Repository: JT ALWM TEAM app
   - Branch: master
   - Build Command: npm install
   - Start Command: npm start
   - Runtime: Node.js
   - Region: Frankfurt
   - Plan: Starter ($7/mois)
6. Environment Variables:
   - NODE_ENV = production
   - PORT = 3010
   - CORS_ORIGIN = [à définir après Vercel]
7. Persistent Storage → Add Disk
   - Mount path: /app/uploads
   - Size: 2 GB
8. Deploy
9. Copier le Service ID (Settings → General)
10. Créer Deploy Hook (Settings → Deploy → Web Hook)
    - Copier la clé et le Service ID
```

**Résultat :**
```
- Backend URL: https://jt-alwm-backend.onrender.com
- Deploy Key: [copier ce token]
- Service ID: [copier cet ID]
```

#### B. Vercel (Frontend)

```
1. Aller à https://vercel.com
2. Sign up (ou login)
3. Dashboard → Add New... → Project
4. Import Git Repository
   - Repository: JT ALWM TEAM app
5. Configuration:
   - Framework: Vite
   - Build Command: npm run build
   - Output Directory: dist
   - Install Command: npm install
6. Environment Variables:
   - VITE_API_URL = https://jt-alwm-backend.onrender.com
7. Deploy
8. Account Settings → Tokens
   - Create Personal Access Token (Automation)
   - Copier le token
9. Récupérer les IDs:
   - VERCEL_ORG_ID: Account → Profile
   - VERCEL_PROJECT_ID: Project Settings → General
```

**Résultat :**
```
- Frontend URL: https://jt-alwm.vercel.app
- VERCEL_TOKEN: [copier ce token]
- VERCEL_ORG_ID: [copier cet ID]
- VERCEL_PROJECT_ID: [copier cet ID]
```

---

### ÉTAPE 3️⃣ : Activer le CI/CD (30 min) - CETTE SEMAINE

#### A. Mettre à jour les secrets GitHub

```
1. Aller à https://github.com/YOUR_ORG/JT-ALWM-TEAM-app/settings
2. Secrets and variables → Actions
3. Ajouter les 5 secrets:

   SECRET #1: RENDER_DEPLOY_KEY
   └─ Valeur: [le token obtenu de Render deploy hook]

   SECRET #2: RENDER_BACKEND_SERVICE_ID
   └─ Valeur: [le service ID de Render]

   SECRET #3: VERCEL_TOKEN
   └─ Valeur: [le token personnel Vercel]

   SECRET #4: VERCEL_ORG_ID
   └─ Valeur: [votre Vercel org ID]

   SECRET #5: VERCEL_PROJECT_ID
   └─ Valeur: [votre Vercel project ID]
```

#### B. Mettre à jour Render CORS

```
1. Render Dashboard → Backend Service
2. Environment → Edit CORS_ORIGIN
3. Valeur: https://jt-alwm.vercel.app
4. Save & Redeploy
```

#### C. Commit et déploiement test

```bash
# Ajouter tous les fichiers de Phase 4
git add -A

# Commit
git commit -m "chore(phase4): add docker and ci/cd pipeline

- Add backend/frontend Dockerfiles (multistage)
- Add docker-compose.yml for local dev
- Add GitHub Actions CI/CD workflow
- Add Render and Vercel configurations
- Add deployment documentation
- Add security checklist

This enables automated deployment on every push to master."

# Push vers master (déclenche la pipeline !)
git push origin master

# Vérifier GitHub Actions
# https://github.com/YOUR_ORG/JT-ALWM-TEAM-app/actions
# Attendre ~10 minutes
```

---

## 📊 Tableau de bord - Status par étape

### Avant Phase 4
```
Local Dev    : Manual start (npm run dev / npm install)
Testing      : Manual
Deployment   : Manual FTP / SSH upload
CI/CD        : ❌ Non existant
```

### Après Phase 4 ✨
```
Local Dev    : docker-compose up (COMPLET)
Testing      : GitHub Actions (AUTOMATISÉ)
Deployment   : Render + Vercel (AUTOMATISÉ)
CI/CD        : ✅ Full pipeline (PRODUCTION-READY)
```

---

## ⏱️ Timeline

```
Jour 1 (Aujourd'hui)
├─ 09:00 - Test local docker-compose (30 min)
└─ 17:00 - ✅ Verification local OK

Jour 2-3 (Cette semaine)
├─ 09:00 - Setup Render + Vercel (1-2h)
├─ 11:00 - Configurer secrets GitHub (30 min)
└─ 11:30 - Push initial vers master
    └─ 11:35-11:45 - Pipeline s'exécute
        └─ 11:45 - ✅ Production déployée

Jour 4+ (Maintenance)
├─ Chaque push déclenche auto-deploy
├─ Monitoring via Render/Vercel dashboards
└─ Logs centralisés pour debug
```

---

## 🎯 Objectifs par Étape

### ✅ ÉTAPE 1 - Test Local
- [x] Docker installé et fonctionnel
- [x] docker-compose lance les services
- [x] Frontend accessible
- [x] Backend API responsive
- [x] Uploads fonctionnent
- [x] Logs visibles

### ⏳ ÉTAPE 2 - Services Hosting
- [ ] Render.com account créé
- [ ] Backend service créé et déployé
- [ ] Vercel account créé
- [ ] Frontend project créé et déployé
- [ ] Domaines configurés
- [ ] Health checks passent

### ⏳ ÉTAPE 3 - CI/CD Activation
- [ ] 5 secrets GitHub configurés
- [ ] CORS mis à jour dans Render
- [ ] Premier push master
- [ ] Pipeline complète s'exécute
- [ ] Render redéploie automatiquement
- [ ] Vercel redéploie automatiquement
- [ ] Production fonctionne
- [ ] Tests tous les endpoints

---

## 🚨 Points Critiques à Ne Pas Oublier

### ❌ ERREURS FRÉQUENTES

1. **Port déjà utilisé (Docker local)**
   ```
   ❌ "Port 80 already in use"
   ✅ Solution: Modifier docker-compose.yml port mapping
   ```

2. **Secrets GitHub manquants**
   ```
   ❌ CI/CD démarre mais deploy échoue silencieusement
   ✅ Solution: Vérifier les 5 secrets sont configurés
   ```

3. **CORS mis à jour tardivement**
   ```
   ❌ Frontend produit peut pas appeler backend produit
   ✅ Solution: Update CORS_ORIGIN AVANT push initial
   ```

4. **Package-lock.json pas commité**
   ```
   ❌ Builds différents entre local et CI
   ✅ Solution: git add package-lock.json
   ```

5. **Oublier de Redeploy après config change**
   ```
   ❌ Les env variables ne se mettent pas à jour
   ✅ Solution: Cliquer "Redeploy" après chaque change
   ```

---

## 📞 Support Rapide

| Problème | Solution | Où |
|----------|----------|-----|
| Docker ne build pas | Voir test-docker-build.sh et Troubleshooting | DOCKER_AND_CICD.md |
| CI/CD fail | Vérifier secrets + syntax workflow | GitHub → Actions |
| Backend down | Check Render logs + restart | Render Dashboard |
| Frontend broken | Check Vercel build logs | Vercel Dashboard |
| CORS errors | Update CORS_ORIGIN et redeploy | SECURITY_CONFIG.md |

---

## ✨ Résultat Final

Une fois ces 3 étapes complétées :

```
git push master
    ↓
[1-2 min] GitHub Actions lint & test ✓
    ↓
[2-3 min] Docker build & push ✓
    ↓
[3-5 min] Render redeploy ✓
    ↓
[5-8 min] Vercel redeploy ✓
    ↓
✅ PRODUCTION UPDATED
   - https://jt-alwm.vercel.app
   - https://jt-alwm-backend.onrender.com
```

**ZERO intervention manuelle. ZERO erreurs. COMPLET en 10 minutes.**

---

## 📚 Documentation Complète

| Doc | Quand | Durée |
|-----|-------|-------|
| [`QUICKSTART.md`](./QUICKSTART.md) | Avant start | 5 min |
| [`DOCKER_AND_CICD.md`](./DOCKER_AND_CICD.md) | Pour détails | 30 min |
| [`SECURITY_CONFIG.md`](./SECURITY_CONFIG.md) | Pour production | 20 min |
| [`PHASE4_REPORT.md`](./PHASE4_REPORT.md) | Vue complète | 15 min |

---

## 🎓 À savoir

### Architecture simplifiée
```
Code Push → GitHub → Actions → Docker Build → Render/Vercel → Users
                      ↓
                    Tests
                      ↓
                  Push Registry
```

### Qui fait quoi
- **Developer** : Modifie code + push
- **GitHub Actions** : Test, build, push images
- **Render** : Héberge backend Node.js
- **Vercel** : Héberge frontend React
- **Registry** : Stocke les images Docker

### Pas besoin de
- ❌ SSH sur serveur
- ❌ FTP uploads
- ❌ Redémarrage manuel
- ❌ Configuration manuelle prod
- ❌ Déploiement manuel

---

**🚀 Prêt à démarrer ? Commencez par l'ÉTAPE 1 dès maintenant !**

