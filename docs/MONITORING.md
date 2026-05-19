# 📊 MONITORING GUIDE - JT ALWM TEAM

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [UptimeRobot - Uptime Monitoring](#uptimerobot---uptime-monitoring)
3. [Sentry - Error Tracking](#sentry---error-tracking)
4. [Health Endpoints](#health-endpoints)
5. [Logs Centralisés](#logs-centralisés)
6. [Alertes & Notifications](#alertes--notifications)
7. [Dashboard Metrics](#dashboard-metrics)

---

## Vue d'Ensemble

L'observabilité est basée sur 3 piliers:

```
┌─────────────────────────────────────────┐
│      UptimeRobot (Availability)         │
│  Vérifie service toutes les 5 min      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Sentry (Error Tracking & Alerting)    │
│  Capture & centralise tous les errors  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Metrics Dashboard (Health Status)    │
│  Uptime, upload count, disk usage     │
└─────────────────────────────────────────┘
```

---

## UptimeRobot - Uptime Monitoring

### Setup en 5 min

#### Étape 1: Créer un compte

1. Aller à [uptimerobot.com](https://uptimerobot.com)
2. S'inscrire (gratuit)
3. Vérifier l'email

#### Étape 2: Ajouter un Monitor

1. Dashboard → **Add Monitor**
2. Remplir:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `JT ALWM Backend`
   - **URL**: `https://your-backend.onrender.com/health`
   - **Monitoring Interval**: 5 minutes (défaut)
   - **Timeout**: 30 seconds

3. Cliquer **Create Monitor**

#### Étape 3: Configurer les Alertes

1. Dans le monitor, aller à **Alert Contacts**
2. Ajouter:
   - **Email**: votre email
   - **Discord/Slack** (optionnel): Webhook URL
   - **Phone SMS** (optionnel)

3. Sauvegarder

#### Étape 4: Valider

```bash
# Tester le health endpoint
curl https://your-backend.onrender.com/health

# Devrait retourner:
{
  "status": "ok",
  "timestamp": "2026-05-19T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Configuration Multi-Services

Ajouter un monitor pour chaque service:

| Service | URL | Interval |
|---------|-----|----------|
| Backend | `/health` | 5 min |
| Frontend | `https://your-frontend.com` | 10 min |
| Metrics API | `/metrics` | 15 min |

### Interprétation du Dashboard

- 🟢 **Up**: Service répond avec 200 OK
- 🟡 **Degraded**: Temps réponse lent (>3s)
- 🔴 **Down**: Service inaccessible ou erreur

### SLA Targets

```
Uptime Target: 99.5% (34 min/mois)
Alert Threshold: > 2 failures
Recovery Time: Auto-retry 5 fois
```

---

## Sentry - Error Tracking

### Setup en 10 min

#### Étape 1: Créer un projet Sentry

1. Aller à [sentry.io](https://sentry.io)
2. Sign up (gratuit)
3. Dashboard → **Create Project**
4. Sélectionner:
   - **Platform**: Node.js (pour backend)
   - **Project Name**: `jt-alwm-backend`
   - **Team**: `default`

5. Cliquer **Create Project**

#### Étape 2: Récupérer le DSN

```
https://your-key@sentry.io/your-project-id
```

Copier et ajouter à `.env`:
```env
SENTRY_DSN=https://your-key@sentry.io/your-project-id
```

#### Étape 3: Configurer Alertes

1. Dashboard → **Alerts**
2. **Create Alert Rule**:
   - **Trigger**: `A new issue is created`
   - **Notify**: Email / Slack / Discord
   - **Frequency**: Real-time

#### Étape 4: Tester l'intégration

```bash
# Faire une erreur intentionnelle
curl -X GET https://backend.com/api/uploads/invalid-week

# Dans Sentry dashboard, vérifier:
# Issues → Nouvelle erreur créée
```

### Interprétation des Erreurs Sentry

| Type | Priorité | Action |
|------|----------|--------|
| Unhandled Exception | 🔴 Critical | Investiguer immédiatement |
| Error in Route | 🟡 High | Fixer dans 24h |
| Warning | 🟢 Low | Reporter au prochain sprint |

### Breadcrumbs (Trace d'Exécution)

Sentry capture automatiquement:
- Requêtes HTTP
- Logs console
- DOM changes
- Erreurs

Visualisable dans chaque Issue → Timeline

### Release Tracking

Lier les déploiements aux erreurs:

```bash
# Backend
SENTRY_RELEASE=1.0.0 npm run deploy

# Frontend
sentry-cli releases create 1.0.0
```

---

## Health Endpoints

### GET /health

**Usage**: Health check simple (UptimeRobot)

```bash
curl https://backend.com/health

# Response:
{
  "status": "ok",
  "timestamp": "2026-05-19T10:30:00.000Z",
  "version": "1.0.0"
}
```

**Cas d'usage**:
- Monitoring services (UptimeRobot, DataDog)
- Load balancers
- Kubernetes liveness probes

### GET /metrics

**Usage**: Métriques système détaillées

```bash
curl https://backend.com/metrics

# Response:
{
  "timestamp": "2026-05-19T10:30:00.000Z",
  "uptime_seconds": 3600,
  "requests": 1250,
  "uploads": {
    "total": 42,
    "successful": 40,
    "failed": 2,
    "avg_time_ms": 2345
  },
  "errors": {
    "total": 3,
    "last_error": {
      "timestamp": "2026-05-19T10:25:30.000Z",
      "message": "File size exceeded",
      "type": "ValidationError"
    }
  },
  "disk": {
    "usage_bytes": 1073741824,
    "usage_mb": 1024,
    "usage_gb": "1.00"
  },
  "weeks": 8
}
```

**Cas d'usage**:
- Grafana dashboard
- DataDog monitoring
- Custom alerting scripts

### Intégrer avec Grafana (Avancé)

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'jt-alwm'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['backend.com']
    scrape_interval: 30s
```

---

## Logs Centralisés

### Backend Logs

#### Console Logs (Dev)

```bash
npm run dev
# Affiche logs directement en console
```

#### Fichier Logs (Prod)

```bash
# Sur Render, les logs sont accessibles:
render logs

# Ou via Sentry:
# Dashboard → Sentry → Issues → Logs tab
```

#### Structure d'un Log

```
[TIMESTAMP] [LEVEL] [MODULE] [MESSAGE] [CONTEXT]
2026-05-19T10:30:00Z ERROR uploads Failed to save file {fileId: '123', error: 'ENOSP...'}
```

### Frontend Logs

Voir dans **Sentry → Session Replay**:
- Console logs
- Network requests
- User interactions

### Centraliser avec ELK Stack (Optionnel)

```yaml
# docker-compose.yml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
logstash:
  image: docker.elastic.co/logstash/logstash:8.0.0
kibana:
  image: docker.elastic.co/kibana/kibana:8.0.0
```

---

## Alertes & Notifications

### Configurer Email Alerts

1. Sentry → **Settings → Integrations**
2. **Email** (défaut activé)
3. **Notification Settings**:
   - Alert every: `1 hour`
   - Digest frequency: `Daily`

### Configurer Slack

1. Sentry → **Integrations → Slack**
2. Autoriser Sentry workspace
3. Choisir canal: `#alerts`
4. Créer Alert Rule → Notify Slack

```
Alert: [PROD] Error spike detected
Channel: #alerts
Frequency: Immediate
```

### Configurer Discord

```
Webhook URL: https://discord.com/api/webhooks/xxx/yyy
Format: 
@alerts
🔴 ERROR: [Issue Title]
Occurrences: 5
Status: Unresolved
Link: [Sentry Link]
```

### Alertes Personnalisées

```bash
#!/bin/bash
# check_health.sh - Run every 5 min via cron

HEALTH=$(curl -s https://backend.com/health)
if [[ $? -ne 0 ]]; then
  curl -X POST https://hooks.slack.com/services/xxx \
    -d '{"text":"❌ Backend down!"}'
fi
```

---

## 🚨 Alertes Critiques (Auto-Monitoring)

Le backend enregistre et notifie automatiquement sur 3 seuils critiques, vérifiés toutes les 30 secondes:

### 1. Taux d'Erreurs Élevé

**Condition**: Error rate > 5% sur 5 minutes

**Seuils**:
```
Déclenchement: (total_errors / total_requests) > 5%
Exemple: 5 erreurs sur 100 requêtes = 5% → ALERTE
```

**Actions Automatiques**:
1. Log en ERROR avec contexte
2. Envoi à Sentry (si SENTRY_DSN configuré)
3. Notification Discord/Slack (si ALERT_WEBHOOK_URL configuré)
4. Rate limit: Max 1 alerte par 15 minutes

**Configuration ENV**:
```env
# .env
SENTRY_DSN=https://your-key@sentry.io/project-id
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy
```

### 2. Utilisation Disque Élevée

**Condition**: Disk usage > 80% de la limite (500 MB)

**Seuils**:
```
Déclenchement: disk_usage > 400 MB (80% × 500 MB)
Exemple: 420 MB utilisés → ALERTE
```

**Actions Automatiques**:
1. Log d'alerte avec détails d'utilisation
2. Envoi à Sentry + Discord/Slack
3. Notification: considérer nettoyage manuel

**Recommandation**: Implémenter cleanup automatique des uploads archivés

### 3. Utilisation Mémoire Élevée

**Condition**: Heap memory > 90%

**Seuils**:
```
Déclenchement: (heap_used / heap_total) > 90%
Exemple: 900 MB utilisés sur 1000 MB → ALERTE
```

**Actions Automatiques**:
1. Log en ERROR
2. Notification Sentry + Discord/Slack
3. Graceful shutdown si condition persiste

**Cause Probable**: Memory leak ou trop d'uploads en attente

---

## Configuration Alertes

### Webhooks Discord

```env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN
```

**Créer un webhook**:
1. Discord → Server Settings
2. Integrations → Webhooks
3. **New Webhook**
4. Name: `JT Alerts`
5. Channel: Select `#alerts`
6. Copy URL → Ajouter à `.env`

### Webhooks Slack

```env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Créer un webhook**:
1. Slack → Your Workspace
2. Settings & administration → Manage apps
3. Search: "Incoming Webhooks"
4. **Add to Slack**
5. Choose channel: `#alerts`
6. Copy Webhook URL → Ajouter à `.env`

### Email Alerts

```env
ALERT_EMAIL=your-email@example.com
```

*(Intégration nodemailer optionnelle - à implémenter)*

---

## Monitoring en Production

### Dashboard Temps Réel

```bash
# Terminal 1: Watch health
watch -n 5 'curl -s https://backend.com/health | jq .'

# Terminal 2: Watch metrics
watch -n 10 'curl -s https://backend.com/metrics | jq .alerts'
```

### Format Réponse Alertes

**GET /health**:
```json
{
  "status": "ok",
  "metrics": {
    "errors": {
      "total": 3,
      "rate": "2.50%"
    },
    "disk": {
      "usageMB": 350,
      "usageGB": "0.34"
    },
    "memory": {
      "heapUsagePercent": "62.45%"
    }
  }
}
```

**GET /metrics** (version détaillée):
```json
{
  "alerts": {
    "error_rate": false,
    "disk_usage": false,
    "memory_usage": false
  },
  "errors": {
    "total": 3,
    "last_error": {
      "timestamp": "2026-05-19T10:25:30.000Z",
      "message": "File size exceeded",
      "type": "ValidationError"
    }
  }
}
```

### Déboguer les Alertes

```bash
# Lire les dernières alertes dans logs
tail -f logs/app.log | grep ALERT

# Filtrer par type
tail -f logs/error.log | grep "HIGH_ERROR_RATE\|HIGH_DISK_USAGE\|HIGH_MEMORY"

# Vérifier l'état des alertes
curl -s https://backend.com/metrics | jq .alerts
```

---

## Dashboard Metrics

### Metrics à Tracker

| Métrique | Seuil Alerte | Fréquence |
|----------|-------------|-----------|
| Uptime | < 99% | 5 min |
| Error Rate | > 5% | 10 min |
| Avg Response Time | > 5s | 10 min |
| Disk Usage | > 80% | 1h |
| Failed Uploads | > 10% | 15 min |

### Créer un Dashboard Grafana

```json
{
  "dashboard": {
    "title": "JT ALWM Monitoring",
    "panels": [
      {
        "title": "Uptime",
        "targets": [
          {
            "expr": "up{job='jt-alwm'}"
          }
        ]
      },
      {
        "title": "Uploads (24h)",
        "targets": [
          {
            "expr": "rate(uploads_total[24h])"
          }
        ]
      }
    ]
  }
}
```

### Exporter Metrics

```bash
# Export CSV (via cron script)
curl https://backend.com/metrics | jq . > metrics_$(date +%Y%m%d).json
```

---

## Checklist Monitoring

### Day 1 Setup
- [ ] UptimeRobot monitor créé
- [ ] Sentry project créé
- [ ] DSN ajouté aux .env
- [ ] Alertes email configurées
- [ ] Test de health endpoint

### Week 1 Review
- [ ] Sentry reçoit les erreurs
- [ ] UptimeRobot valide uptime
- [ ] Metrics accessible via `/metrics`
- [ ] Slack/Discord intégré
- [ ] Logs visibles

### Monthly Audit
- [ ] Dashboard Grafana
- [ ] Alert thresholds ajustés
- [ ] Faux positifs réduits
- [ ] SLA review (99.5%)
- [ ] Backup strategy validée

---

## Support & Resources

| Outil | Docs | Support |
|------|------|---------|
| UptimeRobot | [help.uptimerobot.com](https://help.uptimerobot.com) | Email |
| Sentry | [docs.sentry.io](https://docs.sentry.io) | Community |
| Grafana | [grafana.com/docs](https://grafana.com/docs) | Enterprise |

---

**Dernière mise à jour**: 2026-05-19
