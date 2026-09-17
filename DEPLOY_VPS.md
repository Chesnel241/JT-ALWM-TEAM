# 🚀 Déploiement JT ALWM — VPS Hetzner (Guide Complet)

> Date: 2026-06-30
> Commit: `d95d3ec` sur `master`
> URL: https://github.com/Chesnel241/JT-ALWM-TEAM.git

---

## 1. Prérequis sur le VPS Hetzner

### Configuration recommandée

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disque SSD | 40 GB | 80 GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### Connexion au VPS

```bash
ssh root@<IP_DU_VPS>
```

---

## 2. Installation de Docker et Docker Compose

```bash
# Mettre à jour le système
apt update && apt upgrade -y

# Installer les dépendances
apt install -y ca-certificates curl gnupg lsb-release

# Ajouter la clé GPG Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Ajouter le repo Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Vérifier
docker --version
docker compose version
```

---

## 3. Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw allow 443/udp    # HTTP/3 (QUIC)
ufw enable

# Vérifier
ufw status verbose
```

---

## 4. Clone du projet

```bash
# Se placer dans /opt (ou /home/<user> si non-root)
cd /opt

# Cloner
git clone https://github.com/Chesnel241/JT-ALWM-TEAM.git jt-alwm
cd jt-alwm

# Vérifier qu'on est sur master
git branch
git log --oneline -3
```

---

## 5. Configuration du fichier `.env`

```bash
cp .env.example .env
nano .env
```

### Valeurs OBLIGATOIRES à modifier :

```env
# Environnement
NODE_ENV=production
PORT=3010

# Votre domaine (ex: duckdns, votre domaine perso, ou IP si pas de domaine)
CORS_ORIGIN=https://jt-alwm-team.duckdns.org

# Laisser VIDE en production VPS (Caddy gère le proxy)
VITE_API_URL=

# Mots de passe (GÉNÉRER DES MOTS DE PASSES FORTS)
# openssl rand -base64 24
GLOBAL_PASSWORD=change-me-immediately
ADMIN_PASSWORD=change-me-admin-immediately

# Clé partagée backend ↔ worker (OBLIGATOIRE)
# openssl rand -hex 32
WORKER_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Le backend refuse de démarrer** si `GLOBAL_PASSWORD`, `ADMIN_PASSWORD`, ou `WORKER_KEY` sont absents ou égaux aux valeurs par défaut.

---

## 6. Adapter le Caddyfile (si domaine différent)

```bash
nano Caddyfile
```

Remplacer le domaine par le vôtre :

```
jt-alwm-team.duckdns.org {
    ...
}
```

Si vous n'avez **pas de domaine** et utilisez juste l'IP du VPS, modifiez le Caddyfile :

```
:80 {
    # ... (copier le contenu du bloc existant sans le domaine)
}
```

> Sans domaine, pas de HTTPS automatique. Vous utiliserez HTTP.

---

## 7. Build et démarrage (Docker Compose)

```bash
# Build complet et démarrage en arrière-plan
docker compose up --build -d

# Attendre ~30-60 secondes le premier démarrage
sleep 30

# Vérifier que tous les services sont UP
docker compose ps
```

Attendu :
```
NAME                    STATUS          PORTS
jt-alwm-caddy-1       Up 2 minutes    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
jt-alwm-backend-1     Up 2 minutes    0.0.0.0:3010->3010/tcp
jt-alwm-frontend-1    Up 2 minutes    0.0.0.0:80->80/tcp
jt-alwm-worker-1      Up 2 minutes    0.0.0.0:8080->8080/tcp
```

---

## 8. Vérifications post-déploiement

### 8.1 Health checks (depuis le VPS)

```bash
# Backend
curl -s http://localhost:3010/health
# Attendu : JSON avec uptime, statut 200

# Frontend (Nginx)
curl -s http://localhost/health
# Attendu : "OK"

# Worker
curl -s http://localhost:8080/health
# Attendu : "OK"
```

### 8.2 Test depuis l'extérieur (votre navigateur ou terminal local)

```bash
# Remplacer par votre domaine ou IP
curl -s https://jt-alwm-team.duckdns.org/api/health
# Attendu : JSON avec uptime

curl -s https://jt-alwm-team.duckdns.org/api/weeks
# Attendu : JSON avec les semaines (vide ou peuplé)
```

### 8.3 Test CORS

```bash
curl -sI -H "Origin: https://jt-alwm-team.duckdns.org" \
  https://jt-alwm-team.duckdns.org/api/health
# Attendu : Access-Control-Allow-Origin dans les headers
```

### 8.4 Ouvrir dans le navigateur

```
https://jt-alwm-team.duckdns.org
```

Saisir le mot de passe `GLOBAL_PASSWORD` pour accéder à l'application.

---

## 9. Test complet des fonctionnalités (votre équipe doit faire ça)

### Étape 1 — Upload
1. Aller sur "Espace Reportages"
2. Sélectionner un pays + semaine
3. Uploader un fichier vidéo (MP4, MOV, AVI)
4. Vérifier qu'il apparaît dans la liste

### Étape 2 — Édition vidéo (Studio de Montage)
1. Aller sur "Espace Montage"
2. Choisir pays + semaine + reporter
3. Cliquer sur "Studio de Montage"
4. Glisser le clip uploadé dans la timeline
5. Cliquer sur le clip → ajuster IN/OUT (trim)
6. Ajouter une transition (ex: "crossfade")
7. Ajouter un overlay texte (ex: "Lower Third")
8. Ajouter une musique de fond (si uploadée)
9. Cliquer "Générer le Master"
10. Attendre la barre de progression → télécharger le MP4

### Étape 3 — Voix Off
1. Aller sur "Voix Off"
2. Choisir pays + semaine + titre
3. Cliquer "Commencer l'enregistrement"
4. Parler dans le micro
5. Cliquer "Arrêter"
6. Écouter le preview
7. Cliquer "Traiter et Envoyer"
8. Vérifier que le fichier audio apparaît dans les uploads

### Étape 4 — Téléchargement ZIP
1. Aller sur "Espace Reportages" → "Télécharger le ZIP"
2. Vérifier que le ZIP contient tous les fichiers

---

## 10. Commandes utiles (quotidiennes)

```bash
# Voir les logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f caddy

# Redémarrer un service
docker compose restart backend

# Rebuild complet (après git pull)
docker compose down
docker compose up --build -d

# Mettre à jour le code
cd /opt/jt-alwm
git pull origin master
docker compose down
docker compose up --build -d

# Voir les ressources utilisées
docker stats

# Nettoyer (images orphelines, caches)
docker system prune -f

# Entrer dans un conteneur (debug)
docker compose exec backend sh
docker compose exec worker sh
```

---

## 11. Sauvegarde locale (automatique)

> **Ce que cette sauvegarde-ci protège, et ce qu'elle ne protège pas.** Elle
> archive le volume vers `/var/backups`, **sur le même disque**. Elle vous sauve
> d'une fausse manœuvre ou d'un conteneur perdu, et elle restaure vite parce
> qu'il n'y a rien à retélécharger. Elle ne vous sauve **pas** de la perte du
> VPS : panne disque, incident hébergeur, suspension de compte. Pour cela, voir
> la **§11 bis**, qui est celle qui compte pour les rushes.


```bash
# Créer le script de sauvegarde
nano /usr/local/bin/backup-jt-alwm.sh
```

Coller :

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/jt-alwm"
RETENTION_DAYS=30
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)

# Sauvegarde uploads (vidéos, fichiers, métadonnées JSON)
docker run --rm -v jt-alwm_uploads_volume:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/uploads_${DATE}.tar.gz" -C /data .

# Sauvegarde Caddy (certificats TLS)
docker run --rm -v jt-alwm_caddy_data:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/caddy_${DATE}.tar.gz" -C /data .

# Nettoyage vieux backups (> 30 jours)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup done: $DATE"
```

```bash
chmod +x /usr/local/bin/backup-jt-alwm.sh

# Exécuter tous les jours à 3h du matin
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-jt-alwm.sh >> /var/log/jt-alwm-backup.log 2>&1") | crontab -

# Vérifier le cron
 crontab -l
```

---

## 11 bis. Sauvegarde hors machine (celle qui compte)

Les métadonnées se répliquent déjà vers Upstash. Les **rushes**, non : ils
arrivent une fois par semaine, depuis sept pays, souvent sur de mauvaises
connexions. Un correspondant ne réenvoie pas facilement ce qu'il a envoyé
samedi. C'est la seule donnée du système qui soit vraiment irremplaçable.

### Choisir un stockage objet

Trois options tiennent la route pour une association. La différence qui compte
n'est pas le prix du stockage — quelques euros par mois dans tous les cas —
mais **le prix de la sortie**, c'est-à-dire ce que coûtera la restauration le
jour où elle servira :

| | Stockage | Sortie (restauration) |
|---|---|---|
| **Cloudflare R2** *(recommandé)* | ~0,015 $/Go/mois | **gratuite** |
| Backblaze B2 | ~0,006 $/Go/mois | gratuite jusqu'à 3× le volume stocké |
| Scaleway Object Storage | ~0,012 €/Go/mois, hébergé en Europe | facturée |

R2 est recommandé pour une raison simple : le jour où vous restaurez, vous
téléchargez tout, et c'est exactement le jour où une facture de sortie est le
plus mal venue.

### Configurer rclone (une fois)

```bash
# rclone tourne dans son image Docker : rien à installer sur l'hôte.
docker run --rm -it -v rclone_config:/config/rclone rclone/rclone config
```

Répondre : `n` (nouveau remote) → nom **`r2`** → type `s3` → fournisseur
`Cloudflare` → vos clés → endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Puis rendre cette configuration lisible par les scripts :

```bash
mkdir -p ~/.config/rclone
docker run --rm -v rclone_config:/config/rclone alpine \
  cat /config/rclone/rclone.conf > ~/.config/rclone/rclone.conf
chmod 600 ~/.config/rclone/rclone.conf
```

> Ce fichier contient vos clés d'accès. `chmod 600` n'est pas une politesse.

### Essayer, puis installer

```bash
cd /opt/jt-alwm

# 1. À blanc : rien n'est écrit, on vérifie que la destination répond.
REMOTE=r2:jt-alwm-sauvegarde ./scripts/sauvegarde-hors-site.sh --essai

# 2. Pour de vrai. La première fois envoie tout : comptez du temps.
REMOTE=r2:jt-alwm-sauvegarde ./scripts/sauvegarde-hors-site.sh

# 3. Tous les jours à 4h (une heure après la sauvegarde locale).
(crontab -l 2>/dev/null; echo "0 4 * * * cd /opt/jt-alwm && REMOTE=r2:jt-alwm-sauvegarde ./scripts/sauvegarde-hors-site.sh >> /var/log/jt-alwm-hors-site.log 2>&1") | crontab -
```

**Le script refuse de partir si la source paraît vide** — si le volume ne se
monte pas, il s'arrête au lieu de vider le coffre. Et les fichiers supprimés ou
modifiés sont écartés dans `versions/<date>/` plutôt que détruits : une
suppression accidentelle reste récupérable.

### L'essai de restauration — à faire une fois, vraiment

Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde, c'est une
intention. L'essai ne touche pas la production :

```bash
# Ce que contient le coffre
REMOTE=r2:jt-alwm-sauvegarde ./scripts/restaurer-sauvegarde.sh --lister

# Restaurer dans un volume jetable (la production n'est pas touchée)
REMOTE=r2:jt-alwm-sauvegarde ./scripts/restaurer-sauvegarde.sh

# Regarder ce qui est arrivé
docker run --rm -v jt-alwm_restauration_essai:/data alpine \
  sh -c 'ls /data | head -20; echo; du -sh /data'

# Puis jeter le volume d'essai
docker volume rm jt-alwm_restauration_essai
```

**Ce qu'il faut vérifier**, et pas seulement que des fichiers sont arrivés :
ouvrir un rush restauré et le lire, et vérifier que `store.json` est là. Une
archive qui se décompresse mais dont les vidéos sont tronquées est un piège.

### Le jour où ça arrive pour de bon

```bash
docker compose down            # sans quoi le backend écrit pendant la copie
REMOTE=r2:jt-alwm-sauvegarde ./scripts/restaurer-sauvegarde.sh --sur-la-production
docker compose up -d
```

Le script demande de taper `restaurer la production` en toutes lettres. C'est
volontaire : cette commande-là s'exécute un jour de stress.

---

## 12. Restauration locale (si besoin)

```bash
# Arrêter les services
cd /opt/jt-alwm
docker compose down

# Restaurer les uploads
docker run --rm -v jt-alwm_uploads_volume:/data -v /var/backups/jt-alwm:/backup alpine \
  tar xzf /backup/uploads_YYYYMMDD_HHMMSS.tar.gz -C /data

# Restaurer Caddy (si certificats perdus)
docker run --rm -v jt-alwm_caddy_data:/data -v /var/backups/jt-alwm:/backup alpine \
  tar xzf /backup/caddy_YYYYMMDD_HHMMSS.tar.gz -C /data

# Redémarrer
docker compose up -d
```

---

## 13. Sécurité (à faire après le premier déploiement)

### SSH par clé uniquement

```bash
nano /etc/ssh/sshd_config
```

Modifier :
```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

```bash
systemctl restart sshd
```

> ⚠️ **Ne faites PAS ça** avant d'avoir copié votre clé SSH sur le serveur !

### Permissions sur .env

```bash
chmod 600 /opt/jt-alwm/.env
```

### Vérifier que les ports internes sont fermés

```bash
ufw status verbose
# NE PAS ouvrir 3010 (backend) ni 8080 (worker) publiquement
# Seuls 22, 80, 443 doivent être ouverts
```

---

## 14. Checklist finale de production

- [ ] Docker et Docker Compose installés
- [ ] UFW configuré (22, 80, 443/udp+tcp uniquement)
- [ ] Domaine DNS pointe vers le VPS (ou IP publique connue)
- [ ] `.env` créé avec mots de passe forts
- [ ] `WORKER_KEY` généré (32 hex chars)
- [ ] Caddyfile adapté au domaine
- [ ] `docker compose up --build -d` réussi
- [ ] `docker compose ps` montre tous les services UP
- [ ] Health checks répondent (`/health`, `/api/weeks`)
- [ ] Upload d'un fichier test fonctionne
- [ ] Studio de Montage charge les clips
- [ ] Voix Off enregistre et traite l'audio
- [ ] Certificat TLS valide (pas d'avertissement navigateur)
- [ ] Sauvegarde locale cron configurée (§11)
- [ ] **Sauvegarde hors machine cron configurée (§11 bis)** — la seule qui
      protège les rushes de la perte du VPS
- [ ] **Une restauration réellement essayée**, dans le volume jetable, avec un
      rush ouvert et lu — pas seulement une commande lancée
- [ ] SSH par clé uniquement (optionnel mais recommandé)

---

## 15. Support et dépannage

### Problème: le backend ne démarre pas
```bash
docker compose logs --tail=50 backend
# Erreurs fréquentes:
# - WORKER_KEY requis → générer et définir WORKER_KEY
# - GLOBAL_PASSWORD must be set → définir GLOBAL_PASSWORD et ADMIN_PASSWORD
```

### Problème: Caddy ne génère pas le certificat
```bash
# Vérifier DNS
dig +short jt-alwm-team.duckdns.org
# Vérifier ports
ufw status
# Logs Caddy
docker compose logs caddy
```

### Problème: erreur CORS
```bash
# Vérifier que CORS_ORIGIN correspond EXACTEMENT au domaine (pas de slash final)
docker compose restart backend
```

### Problème: les fichiers disparaissent
```bash
# Ne JAMAIS faire : docker compose down -v (supprime les volumes)
# Toujours faire : docker compose down (garde les volumes)
# Les données sont dans le volume Docker jt-alwm_uploads_volume
```

---

**Dernière mise à jour** : 2026-06-30  
**Commit déployé** : `d95d3ec`
