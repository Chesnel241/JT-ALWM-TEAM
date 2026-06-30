# JT ALWM — Web Hub

Plateforme de centralisation des reportages pour l'équipe JT ALWM.
Les correspondants déposent vidéos / audios / scripts par semaine et
par pays ; les éditeurs téléchargent les packs ZIP.

## Structure

```
├── backend/    Node.js 20 + Express + Multer + Archiver
├── frontend/   React 18 + Vite + Tailwind
├── docs/       Rapports de phases, checklists, guides historiques
└── docker-compose.yml   Stack dev locale
```

## Démarrage local

### Sans Docker

```bash
# Backend
cd backend
npm install
npm run dev      # http://localhost:3010

# Frontend (autre terminal)
cd frontend
npm install
npm run dev      # http://localhost:5173 — proxy /api → :3010
```

### Avec Docker

```bash
docker compose up --build
# Frontend → http://localhost
# Backend  → http://localhost:3010
```

## Tests

```bash
cd backend  && npm test    # vitest + supertest (38 tests)
cd frontend && npm test    # vitest + RTL (8 tests)
```

## API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Health check (uptime, métriques) |
| GET | `/metrics` | Métriques détaillées (mémoire, disque, alertes) |
| GET | `/api/countries` | Liste des pays |
| GET | `/api/weeks` | Liste des semaines |
| GET | `/api/uploads/:weekId` | Uploads d'une semaine, regroupés par pays |
| GET | `/api/uploads/:weekId/:countryId` | Uploads d'un pays |
| GET | `/api/uploads/:weekId/:countryId/archive` | ZIP de tous les fichiers du pays |
| POST | `/api/uploads/:weekId/:countryId` | Upload multipart |
| POST | `/api/uploads/:weekId/:countryId/script` | Saisie manuelle d'un script |
| DELETE | `/api/uploads/:weekId/:countryId/:fileId` | Suppression |

## Variables d'environnement

### Backend
- `PORT` (3010)
- `CORS_ORIGIN` — séparé par virgules. Ex: `https://jt-alwm.vercel.app,https://staging.example.com`
- `MAX_FILE_SIZE` — bytes. Défaut **200 MB** (compatible plan Render Starter)
- `JT_STORE_PATH` — chemin du store JSON (overridable, utile en tests)
- `LOG_DIR` — dossier des logs Winston.
- `SENTRY_DSN` — error tracking (no-op si absent)
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` — requis sur plan Free pour persister les métadonnées.

### Frontend
- `VITE_API_URL` — URL absolue du backend en prod (ex: `https://jt-alwm-backend.onrender.com`). Vide en dev (proxy Vite).
- `VITE_SENTRY_DSN` — error tracking côté navigateur

## Production

- **Backend** : Render.com (Frankfurt, plan Free + Upstash Redis)
- **Frontend** : Vercel (région `fra1`)
- **Branche déployée** : `master`
- **CI/CD** : GitHub Actions (`.github/workflows/deploy.yml`)

### ⚠️ Avertissements

- **Aucune authentification.** Toutes les routes API sont publiques.
  Choix produit assumé pour un hub interne, mais ne diffuser l'URL
  qu'aux personnes concernées et envisager un mot de passe partagé
  côté Vercel (Vercel Password Protection) si l'URL devient connue.
- **Aucune persistance des fichiers locaux sur le plan Free.** Render supprime les fichiers du disque à chaque mise en veille. Cependant, les métadonnées sont stockées sur **Upstash Redis**.

### Smoke tests post-déploiement

1. `curl https://<render>/health` → 200
2. `curl https://<render>/api/weeks` → JSON semaines
3. Ouvrir Vercel, naviguer Home → Uploader → Dashboard
4. Upload d'un fichier 50 MB, vérifier liste + download ZIP + suppression
5. Vérifier que Sentry reçoit un event de test
6. Redéployer Render, vérifier que les fichiers + JSON sont toujours là
