# JT ALWM — Web Hub

Plateforme de centralisation des reportages pour l'équipe JT ALWM.
Les correspondants déposent vidéos / audios / scripts par semaine et
par pays ; les éditeurs téléchargent les packs ZIP.

## Deux espaces, deux URLs

L'application est une seule SPA, mais l'URL d'entrée décide de ce que
l'équipe voit. Le découpage est défini dans `frontend/src/lib/routing.js`.

| Équipe | URL à partager | Onglets disponibles |
|--------|----------------|---------------------|
| Montage | `https://<domaine>/monteurs` | Espace Reportages, Espace Montage, Voix Off, JT Prêt, Stats & Délais |
| | | Ouvre directement sur le studio de montage. La liste des pays est sur `/monteurs/reportages`. |
| Reportage (journalistes) | `https://<domaine>/journalistes` | Espace reportage, Télécharger le JT |

- `/` reste l'entrée historique de l'équipe montage : les favoris existants
  continuent de fonctionner et l'URL est simplement réécrite en `/monteurs`.
  L'ancien lien `/monteurs/montage` ouvre lui aussi le studio.
- `/journalistes` ouvre un accueil à deux grands boutons — envoyer un
  reportage, ou télécharger le JT de la semaine — pensé pour des
  correspondants peu à l'aise avec l'outil, sur mobile comme sur ordinateur.
- Les alias `/journaliste`, `/reporter`, `/reporters`, `/reportages` et
  `/monteur`, `/montage`, `/editeurs` sont acceptés puis normalisés, pour
  qu'un lien mal recopié dans WhatsApp ouvre quand même le bon espace.
- Une URL hors périmètre (`/journalistes/montage`, par exemple) retombe sur
  l'accueil de l'espace : les vues montage ne sont jamais montées côté
  journalistes.

### Le lien personnel d'un correspondant

`https://<domaine>/journalistes/<pays>` — par exemple `/journalistes/ga` —
ouvre directement l'écran d'envoi de ce pays, sans passer par la liste. C'est
le lien à envoyer une fois par WhatsApp à chaque correspondant ; il vaut
aussi favori et raccourci d'écran d'accueil. `?pays=ga` est accepté en entrée
et disparaît de la barre d'adresse une fois lu.

Il n'y a pas de compte : c'est le seul support d'identité durable. La mémoire
du navigateur sert de raccourci de confort, mais elle disparaît en navigation
privée, au changement de téléphone, et Safari efface le stockage des sites non
installés après environ sept jours sans visite — soit exactement le rythme
d'un JT hebdomadaire. Installer la plateforme sur l'écran d'accueil lève cette
purge.

Sur l'accueil journalistes, un pays déjà confirmé sur l'appareil est proposé
en raccourci, avec une sortie « ce n'est pas mon pays » toujours visible : un
poste partagé en rédaction ne doit pas enfermer le suivant dans le choix du
précédent.

### Le lien personnel signé

`https://<domaine>/journalistes/<pays>?k=<jeton>` ajoute l'identité au lien de
pays. Le jeton est émis depuis l'espace montage, bouton « Lien du
correspondant » sur le chutier d'un pays, et transmis une fois par WhatsApp. À
l'arrivée il est rangé sur l'appareil puis retiré de la barre d'adresse : c'est
un secret porteur, il n'a rien à faire dans une adresse qu'on recopie.

Ce qu'il fait : attribuer un envoi à quelqu'un — qui a envoyé quoi, à qui
écrire, qui relancer. Ce qu'il ne fait pas : contrôler l'accès. L'API reste
ouverte par décision produit ; un lien absent ou falsifié n'empêche personne
d'envoyer, il laisse simplement l'auteur vide.

Le secret vit dans `REPORTER_TOKEN_SECRET`. Sans lui, l'émission est refusée et
rien n'est attribué : la plateforme fonctionne comme avant. Le changer invalide
tous les liens distribués, ce qui est la façon de tout révoquer d'un coup.

### Le sujet, unité de travail

Un correspondant n'envoie plus des fichiers dans « Reportage 2 » mais ouvre un
sujet avec un titre. Les fichiers s'y rattachent par identifiant, et la
rédaction lit ce titre plus l'état du sujet — attendu, reçu, à corriger,
validé, au conducteur — au lieu de rouvrir les fichiers pour deviner. Les
étiquettes existantes ont été migrées en sujets au premier démarrage, sans
perte.

⚠️ C'est un filtre d'usage, pas une frontière de sécurité : l'API reste
publique (voir *Avertissements* plus bas). Le but est de simplifier
l'écran des journalistes, pas de protéger des données.

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
- `CORS_ORIGIN` — séparé par virgules. Ex: `https://jt-alwm-team.duckdns.org,https://staging.example.com`
- `MAX_FILE_SIZE` — bytes. Défaut **200 MB**
- `JT_STORE_PATH` — chemin du store JSON (overridable, utile en tests)
- `LOG_DIR` — dossier des logs Winston.
- `SENTRY_DSN` — error tracking (no-op si absent)
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` — persistance Redis optionnelle (métadonnées).

### Frontend
- `VITE_API_URL` — URL absolue du backend en prod. Laisser vide en VPS (Caddy gère le proxy /api → backend).
- `VITE_SENTRY_DSN` — error tracking côté navigateur

## Production (VPS)

### Déploiement avec Docker Compose

```bash
# Sur le VPS
git clone <repo>
cd JT-ALWM-TEAM-master
cp .env.example .env
# Éditer .env avec les valeurs de production
docker compose up --build -d
```

Le frontend est servi par Caddy (HTTPS via Let's Encrypt) avec proxy
vers le backend sur le port 3010.

### ⚠️ Avertissements

- **Aucune authentification.** Toutes les routes API sont publiques.
  Choix produit assumé pour un hub interne ; ne diffuser l'URL
  qu'aux personnes concernées.

### Smoke tests post-déploiement

1. `curl https://<domaine-vps>/health` → 200
2. `curl https://<domaine-vps>/api/weeks` → JSON semaines
3. Ouvrir `/monteurs` : le studio de montage s'affiche directement
3bis. Ouvrir `/journalistes` : deux boutons seulement, chacun menant à
   sa section (liste des pays / JT prêt)
4. Upload d'un fichier 50 MB, vérifier liste + download ZIP + suppression
5. Vérifier que Sentry reçoit un event de test (si configuré)
6. Redémarrer les conteneurs, vérifier que les données persistent
