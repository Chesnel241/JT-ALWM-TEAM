# Rendu Remotion sur Google Cloud Run

Le rendu du master JT peut être délégué à un **worker Remotion** sur Cloud
Run (Chromium headless), au lieu du pipeline ffmpeg/libass local sur Render.
Architecture hybride : Render garde l'API Express, Cloud Run rend la vidéo.

Le basculement est piloté par la variable `RENDERER` côté backend :
- `RENDERER=libass` (défaut) → rendu local ffmpeg/libass, aucun Cloud Run.
- `RENDERER=remotion` → délégation au worker Cloud Run.

## 1. Pré-requis

- Projet Google Cloud + facturation activée (le Free Tier couvre ~1-15
  rendus/sem ; surveiller l'egress = 1 GiB/mois gratuit).
- `gcloud` CLI authentifié, ou le workflow GitHub Actions fourni.
- Les mêmes identifiants Cloudflare R2 que le backend.

## 2. Déployer le worker

Le `worker/Dockerfile` bundle Remotion (`remotion/`) + le service de rendu.
Contexte de build = racine du repo.

```bash
gcloud run deploy jt-render-worker \
  --source . \
  --dockerfile worker/Dockerfile \
  --region europe-west1 \
  --memory 2Gi --cpu 1 --timeout 1800 \
  --min-instances 0 --max-instances 2 \
  --allow-unauthenticated \
  --set-env-vars "WORKER_KEY=<clé-partagée>,R2_ACCOUNT_ID=...,R2_ACCESS_KEY_ID=...,R2_SECRET_ACCESS_KEY=...,R2_BUCKET_NAME=jt-alwm-uploads"
```

> `--source .` requiert que Cloud Build lise `worker/Dockerfile`. Si l'option
> `--dockerfile` n'est pas dispo dans ta version de gcloud, construire puis
> pousser l'image manuellement :
> `gcloud builds submit --tag gcr.io/<projet>/jt-render-worker -f worker/Dockerfile .`
> puis `gcloud run deploy jt-render-worker --image gcr.io/<projet>/jt-render-worker ...`.

Récupère l'URL du service (ex : `https://jt-render-worker-xxxx.run.app`).

## 3. Configurer le backend (Render)

Variables d'environnement à ajouter sur le service backend :

| Variable | Valeur |
|---|---|
| `RENDERER` | `remotion` |
| `RENDER_WORKER_URL` | URL Cloud Run du worker |
| `WORKER_KEY` | même clé partagée que le worker |
| `PUBLIC_API_URL` | URL publique du backend (ex : `https://jt-alwm-backend.onrender.com`) |

Le worker rappelle `PUBLIC_API_URL/api/editor/internal/progress`
(authentifié par `WORKER_KEY`) pour alimenter la progression SSE existante.

## 4. Flux

1. Frontend `POST /api/editor/concat` (inchangé ; envoie `durationSec` par clip).
2. Backend (RENDERER=remotion) → `POST RENDER_WORKER_URL/render`
   `{ payload, jobId, returnTo }`.
3. Worker : `selectComposition` + `renderMedia` (Remotion), résout les
   `filename` en URLs présignées R2, upload le master dans `exports/`,
   rappelle `/internal/progress` (progress puis `done` + url présignée 24 h).
4. Backend réémet via SSE → le frontend affiche/du télécharge le master.

## 5. Rollback

Repasser `RENDERER=libass` sur le backend : retour immédiat au pipeline
ffmpeg/libass local, sans redéploiement du worker.

## 6. Coût / quotas (Always Free, 2026)

- vCPU : 180 000 vCPU-s/mois — un rendu 720p/2 min ≈ quelques centaines de
  vCPU-s → très loin du plafond.
- Mémoire : 360 000 GiB-s/mois.
- **Egress : 1 GiB/mois gratuit** (le seul vrai levier). Master ≈ 50-100 Mo →
  rester sous ~10 masters téléchargés/mois en direct, ou servir via R2.
- Requêtes : 2 M/mois.

## Limites connues du chemin Remotion

- Ducking musique/voix : approximation (baisse de volume fixe), pas de vrai
  sidechain (le mix audio Remotion ne fait pas de keying).
- `durationSec` par clip vient du frontend (probe metadata navigateur).
