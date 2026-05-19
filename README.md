# JT ALWM — Web Hub

Plateforme de centralisation des reportages pour l'équipe JT ALWM.

## Structure

```
├── backend/    Node.js + Express + Multer
└── frontend/   React + Vite + Tailwind CSS
```

## Démarrage

### Backend
```bash
cd backend
npm install
npm run dev
# Démarre sur http://localhost:3010
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Démarre sur http://localhost:5173
```

## API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/countries` | Liste des pays |
| GET | `/api/weeks` | Liste des semaines |
| GET | `/api/uploads/:weekId` | Tous les uploads d'une semaine |
| GET | `/api/uploads/:weekId/:countryId` | Uploads d'un pays |
| GET | `/api/uploads/:weekId/:countryId/archive` | Telecharger un zip des fichiers |
| POST | `/api/uploads/:weekId/:countryId` | Upload fichier (multipart) |
| POST | `/api/uploads/:weekId/:countryId/script` | Saisie manuelle de script |
| DELETE | `/api/uploads/:weekId/:countryId/:fileId` | Supprimer un fichier |
