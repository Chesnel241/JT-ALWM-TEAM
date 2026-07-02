# 🚀 Guide de Déploiement VPS — JT ALWM TEAM

Déploiement sur un serveur dédié (VPS) avec Docker Compose, Caddy (reverse proxy + TLS auto), et persistance des données locale.

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Clone et Configuration](#clone-et-configuration)
3. [Déploiement Docker Compose](#déploiement-docker-compose)
4. [Variables d'Environnement](#variables-denvironnement)
5. [Troubleshooting VPS](#troubleshooting-vps)
6. [Stratégie de Sauvegarde](#stratégie-de-sauvegarde)
7. [Durcissement de Sécurité](#durcissement-de-sécurité)

---

## Prérequis

### Serveur (ex. Hetzner CX21 ou supérieur)

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disque | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### Logiciels à installer

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Vérifier
sudo docker --version
sudo docker compose version

# (Optionnel) Node.js 20 pour le développement local
# En production, Node.js est inclus dans les images Docker.
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

### Domaine et DNS

Pointer un nom de domaine (ou sous-domaine) vers l'IP publique du VPS :

```
jt-alwm-team.duckdns.org  →  A  →  <IP_DU_VPS>
```

> Caddy génère automatiquement un certificat TLS via Let's Encrypt. Aucune configuration manuelle SSL n'est nécessaire.

### Ports à ouvrir (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 443/udp    # HTTP/3 (QUIC)
sudo ufw enable
```

---

## Clone et Configuration

### 1. Cloner le dépôt

```bash
git clone https://github.com/Chesnel241/JT-ALWM-TEAM.git jt-alwm-team
cd jt-alwm-team
```

### 2. Créer le fichier `.env`

```bash
cp .env.example .env
nano .env
```

Configurer au minimum les valeurs suivantes :

```env
# Environnement
NODE_ENV=production
PORT=3010

# URL publique du domaine (utilisée par CORS)
CORS_ORIGIN=https://jt-alwm-team.duckdns.org

# En production avec Caddy, l'API est same-origin (proxy /api → backend)
VITE_API_URL=

# Mots de passe (OBLIGATOIRES — le backend refuse de démarrer sans)
# Générer : openssl rand -base64 24
GLOBAL_PASSWORD=change-me-immediately
ADMIN_PASSWORD=change-me-admin-immediately

# Secret partagé backend ↔ worker (OBLIGATOIRE)
# Générer : openssl rand -hex 32
WORKER_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ Les variables `GLOBAL_PASSWORD` et `ADMIN_PASSWORD` sont **obligatoires** en production. Le backend échoue au démarrage si elles sont absentes ou égales aux valeurs par défaut.

> ⚠️ `WORKER_KEY` est **obligatoire** — le docker-compose échoue si vide. Le backend et le worker utilisent cette clé pour s'authentifier mutuellement.

### 3. Adapter le Caddyfile (si domaine différent)

```bash
nano Caddyfile
```

Remplacer le domaine par le vôtre :

```
jt-alwm-team.duckdns.org {
    ...
}
```

---

## Déploiement Docker Compose

### Architecture du Stack

```
┌─────────────────────────────────────────────────┐
│  Caddy (reverse proxy + TLS auto + HTTP/3)       │  ← 80, 443
│  ├── /api/*      → backend:3010                 │
│  ├── /uploads/*  → backend:3010                   │
│  ├── /socket.io/* → backend:3010                │
│  └── /*          → frontend:80 (Nginx)           │
├─────────────────────────────────────────────────┤
│  Backend   Node.js 20 + Express + Multer          │
│  Frontend  React 18 + Vite → Nginx (static)       │
│  Worker    Remotion + Puppeteer (optionnel)       │
│  Volumes   uploads_volume, caddy_data             │
└─────────────────────────────────────────────────┘
```

### Lancer l'application

```bash
# Build et démarrage
sudo docker compose up --build -d

# Vérifier que les conteneurs sont actifs
sudo docker compose ps

# Voir les logs en temps réel
sudo docker compose logs -f

# Logs d'un service spécifique
sudo docker compose logs -f backend
```

### Premier démarrage — Vérifications

```bash
# 1. Health check backend
curl -s http://localhost:3010/health
# Attendu : JSON avec uptime, statut 200

# 2. Health check frontend (depuis le VPS)
curl -s http://localhost:80/health
# Attendu : "OK"

# 3. Test API depuis l'extérieur
curl -s https://jt-alwm-team.duckdns.org/api/weeks
# Attendu : JSON des semaines

# 4. Test CORS
curl -sI -H "Origin: https://jt-alwm-team.duckdns.org" \
  https://jt-alwm-team.duckdns.org/api/health
# Attendu : Access-Control-Allow-Origin présent
```

### Commandes utiles

```bash
# Redémarrer un service
sudo docker compose restart backend

# Rebuild complet (après changement de code)
sudo docker compose down
sudo docker compose up --build -d

# Mise à jour des images (Caddy, Nginx)
sudo docker compose pull
sudo docker compose up -d

# Accéder à un conteneur
sudo docker compose exec backend sh

# Nettoyer (images, volumes orphelins)
sudo docker system prune -f
```

---

## Variables d'Environnement

### Obligatoires (`.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NODE_ENV` | Environnement d'exécution | `production` |
| `PORT` | Port interne du backend | `3010` |
| `CORS_ORIGIN` | Origine(s) autorisée(s), séparées par virgule | `https://jt-alwm-team.duckdns.org` |
| `GLOBAL_PASSWORD` | Mot de passe utilisateur global | `changeme` |
| `ADMIN_PASSWORD` | Mot de passe administrateur | `changeme-admin` |
| `WORKER_KEY` | Clé secrète partagée backend↔worker | `hex string` |
| `VITE_API_URL` | URL API pour le build frontend (vide = same-origin) | `` |

### Optionnelles (`.env`)

| Variable | Description | Par défaut |
|----------|-------------|------------|
| `MAX_FILE_SIZE` | Taille max upload (bytes) | `209715200` (200 MB) |
| `UPLOAD_RETENTION_HOURS` | Durée de conservation des fichiers | `48` |
| `RATE_LIMIT_MAX_REQUESTS` | Requêtes max par fenêtre | `10` |
| `GLOBAL_RATE_LIMIT_MAX_REQUESTS` | Requêtes globales max par minute | `100` |
| `LOG_DIR` | Dossier des logs Winston | `logs/` |
| `JT_STORE_PATH` | Chemin du store JSON | interne |
| `UPSTASH_REDIS_REST_URL` | Redis externe (métadonnées) | — |
| `UPSTASH_REDIS_REST_TOKEN` | Token Redis | — |
| `SENTRY_DSN` | Error tracking backend | — |
| `VITE_SENTRY_DSN` | Error tracking frontend | — |
| `ALERT_WEBHOOK_URL` | Webhook Discord/Slack | — |

> **Note sur `VITE_API_URL`** : Sur un VPS avec Caddy, laisser cette variable **vide**. Le frontend appelle l'API en same-origin (`/api/...`), et Caddy route vers le backend. Cela évite les problèmes de CORS.

---

## Troubleshooting VPS

### Le backend ne démarre pas

```bash
# Vérifier les logs
sudo docker compose logs --tail=50 backend

# Erreurs fréquentes :
# - "WORKER_KEY requis dans .env" → Générer et définir WORKER_KEY
# - "GLOBAL_PASSWORD must be set" → Définir GLOBAL_PASSWORD et ADMIN_PASSWORD
# - "Port 3010 already in use" → Rien ne doit écouter sur 3010 en dehors de Docker

# Tester localement (hors Docker)
cd backend
npm install
npm run dev
```

### Caddy ne génère pas le certificat TLS

**Symptômes** : `https://` inaccessible, erreur `ERR_SSL_PROTOCOL_ERROR`.

**Solutions** :
1. Vérifier que le domaine pointe bien vers l'IP du VPS : `dig +short jt-alwm-team.duckdns.org`
2. Vérifier que les ports 80 et 443 sont ouverts : `sudo ufw status`
3. Vérifier les logs Caddy : `sudo docker compose logs caddy`
4. Forcer le renouvellement : `sudo docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`

### Erreurs CORS

**Symptômes** : `Access-Control-Allow-Origin` error dans le navigateur.

**Solutions** :
1. Vérifier que `CORS_ORIGIN` dans `.env` correspond exactement au domaine HTTPS (sans slash final)
2. Redémarrer le backend : `sudo docker compose restart backend`
3. Vider le cache navigateur (Ctrl+Shift+Suppr)

```javascript
// Vérifier dans backend/src/cors/index.js
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
```

### Les fichiers uploadés disparaissent après un `docker compose down`

**Cause** : Les données dans le conteneur sont éphémères. Le volume Docker `uploads_volume` persiste, mais une suppression explicite du volume efface les fichiers.

**Vérification** :
```bash
# Les fichiers doivent être dans le volume
sudo docker volume inspect jt-alwm-team_uploads_volume

# Liste des volumes
sudo docker volume ls
```

**Solution** : Ne jamais utiliser `docker compose down -v` (supprime les volumes). Toujours utiliser `docker compose down` seul.

### Le worker de rendu ne répond pas

```bash
# Vérifier le statut
sudo docker compose ps worker

# Logs
sudo docker compose logs --tail=30 worker

# Le worker est optionnel. Si non utilisé, le backend utilise le rendu local (plus lent).
```

### Le frontend affiche une page blanche

1. Vérifier `VITE_API_URL` : doit être **vide** en production VPS
2. Vérifier les logs Nginx : `sudo docker compose logs frontend`
3. Ouvrir la console navigateur (F12) pour voir les erreurs JS

### Problèmes de performance / mémoire

```bash
# Surveiller les ressources
sudo docker stats

# Si le worker OOM (out of memory), augmenter shm_size dans docker-compose.yml :
# shm_size: "2gb" → "4gb"
# Ou augmenter la RAM du VPS.
```

---

## Stratégie de Sauvegarde

### 1. Sauvegarder les fichiers uploadés (volume Docker)

```bash
# Créer une archive du volume uploads
sudo docker run --rm -v jt-alwm-team_uploads_volume:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads_backup_$(date +%Y%m%d).tar.gz -C /data .

# Copier sur une machine distante (rsync + SSH)
rsync -avz --progress uploads_backup_*.tar.gz user@backup-server:/backups/jt-alwm/
```

### 2. Sauvegarder les données Caddy (certificats TLS)

```bash
# Le volume caddy_data contient les certificats Let's Encrypt
sudo docker run --rm -v jt-alwm-team_caddy_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/caddy_data_$(date +%Y%m%d).tar.gz -C /data .
```

### 3. Sauvegarder le store JSON (si pas de Redis externe)

```bash
# Le backend stocke les métadonnées dans un fichier JSON dans le volume uploads
# Inclus dans la sauvegarde uploads_backup ci-dessus.
# Si Redis Upstash est configuré, les données survivent hors du VPS.
```

### 4. Script de sauvegarde automatisée (cron)

```bash
sudo nano /usr/local/bin/backup-jt-alwm.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/jt-alwm"
RETENTION_DAYS=30
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)

# Sauvegarde uploads
docker run --rm -v jt-alwm-team_uploads_volume:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/uploads_${DATE}.tar.gz" -C /data .

# Sauvegarde Caddy
docker run --rm -v jt-alwm-team_caddy_data:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/caddy_${DATE}.tar.gz" -C /data .

# Nettoyage des vieux backups (> 30 jours)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

```bash
chmod +x /usr/local/bin/backup-jt-alwm.sh

# Exécuter tous les jours à 3h du matin
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-jt-alwm.sh >> /var/log/jt-alwm-backup.log 2>&1") | crontab -
```

### 5. Plan de restauration

```bash
# Restaurer les uploads depuis une archive
sudo docker run --rm -v jt-alwm-team_uploads_volume:/data -v $(pwd):/backup alpine \
  tar xzf /backup/uploads_backup_YYYYMMDD.tar.gz -C /data

# Redémarrer les services
sudo docker compose restart backend worker
```

---

## Durcissement de Sécurité

### 1. SSH — Accès serveur

```bash
# Désactiver l'authentification par mot de passe
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
# PubkeyAuthentication yes
# PermitRootLogin no

sudo systemctl restart sshd

# Utiliser une clé SSH (pas de mot de passe)
# ssh-copy-id -i ~/.ssh/id_rsa.pub user@<vps-ip>
```

### 2. Firewall (UFW)

```bash
# Seuls les ports essentiels sont ouverts
sudo ufw status numbered
# [1] 22/tcp  ALLOW IN  Anywhere      # SSH
# [2] 80/tcp  ALLOW IN  Anywhere      # HTTP (redirigé vers HTTPS par Caddy)
# [3] 443/tcp ALLOW IN  Anywhere      # HTTPS
# [4] 443/udp ALLOW IN  Anywhere      # HTTP/3 (QUIC)
```

> Ne **jamais** exposer le port 3010 (backend) ou 8080 (worker) publiquement. Seul Caddy doit y accéder via le réseau Docker interne.

### 3. Sécurité Docker

```bash
# Vérifier que les conteneurs ne tournent pas en root quand c'est possible
sudo docker compose exec backend ps aux
# L'utilisateur doit être 'node', pas 'root'

# Mettre à jour les images régulièrement
sudo docker compose pull
sudo docker compose up -d

# Limiter les ressources (optionnel, dans docker-compose.yml)
# deploy:
#   resources:
#     limits:
#       cpus: '1.5'
#       memory: 1G
```

### 4. Headers de sécurité (déjà configurés dans Caddyfile)

Le Caddyfile inclut déjà :
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options: DENY` (anti-clickjacking)
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy` (CSP restrictif)
- `Referrer-Policy: strict-origin-when-cross-origin`
- Masquage du header `Server`

### 5. Mots de passe et secrets

```bash
# Générer des mots de passe forts
openssl rand -base64 24   # GLOBAL_PASSWORD, ADMIN_PASSWORD
openssl rand -hex 32      # WORKER_KEY

# Vérifier que .env n'est jamais commité
grep .env .gitignore
# Attendu : .env et .env.local sont ignorés

# Permissions restrictives sur .env
chmod 600 .env
```

### 6. Protection par mot de passe (optionnel)

Le projet n'a pas d'authentification intégrée. Pour restreindre l'accès :
- Diffuser l'URL uniquement aux personnes concernées
- Envisager un VPN pour l'accès éditorial
- Ou ajouter une basic auth côté Caddy (non inclus par défaut)

### 7. Monitoring de disponibilité

```bash
# Installer un simple uptime monitor (optionnel)
# UptimeRobot, StatusCake, ou Pingdom — configurer un check sur :
# https://jt-alwm-team.duckdns.org/health
```

---

## Checklist Production

- [ ] Docker et Docker Compose installés
- [ ] UFW configuré (ports 22, 80, 443/udp+tcp)
- [ ] Domaine DNS pointe vers le VPS
- [ ] `.env` créé avec mots de passe et WORKER_KEY forts
- [ ] Caddyfile adapté au domaine
- [ ] `docker compose up --build -d` réussi
- [ ] Health checks répondent (`/health`, `/api/weeks`)
- [ ] Upload d'un fichier test + téléchargement ZIP + suppression
- [ ] Certificat TLS valide (pas d'avertissement navigateur)
- [ ] HTTP/3 actif (dans les outils de développement du navigateur)
- [ ] Backups automatisés configurés
- [ ] SSH par clé uniquement, root désactivé

---

## Support

- **Problèmes** : GitHub Issues
- **Documentation** : Voir `README.md`, `DESIGN.md`, `MONITORING.md`
- **API** : `https://<votre-domaine>/api-docs`

---

**Dernière mise à jour** : 2026-05-19
