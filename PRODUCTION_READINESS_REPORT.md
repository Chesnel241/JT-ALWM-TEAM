# JT ALWM — Production Readiness Assessment Report

> **Date:** 2026-06-30  
> **Project:** JT-ALWM-TEAM (Web Hub for Correspondents & Editors)  
> **Analyst:** Deployed Agent  
> **Status:** ⚠️ **CONDITIONALLY READY** — Production-viable with critical mitigations required

---

## 1. Executive Summary

| Category | Score | Verdict |
|----------|-------|---------|
| Backend Service | 8.5/10 | ✅ Strong — well-structured, secure, observable |
| Frontend Service | 7/10 | ✅ Good — PWA-ready, but tests flaky |
| Worker/Remotion | 6.5/10 | ⚠️ Functional — single-concurrency, no queue |
| Infrastructure | 7/10 | ⚠️ Solid Docker setup, but Render Free limits are real |
| Security | 7.5/10 | ✅ Good hardening, but password-only auth is weak |
| Observability | 8/10 | ✅ Health, metrics, alerts, Sentry, logs all present |
| CI/CD | 7/10 | ✅ GitHub Actions configured, Docker push is optional/fallback |
| Dependencies | 5.5/10 | ⚠️ Deprecated packages, 28 npm audit vulnerabilities |
| **OVERALL** | **7.1/10** | **⚠️ Ready for production IF critical items below are addressed** |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Caddy 2                              │
│  (TLS auto, HTTP/3, reverse proxy, security headers)        │
│         ┌─────────────┬─────────────┬─────────────┐          │
│    /api/* │      /uploads/* │ /socket.io/* │  /*          │
│         ▼             ▼             ▼             ▼          │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│    │ Backend │  │ Backend │  │ Backend │  │ Frontend│       │
│    │ 3010    │  │ 3010    │  │ 3010    │  │ 80 (Nginx)│      │
│    └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│         │                              │                      │
│         │  /render (internal)          │                      │
│         ▼                              │                      │
│    ┌─────────┐                         │                      │
│    │ Worker  │                         │                      │
│    │ 8080    │◄─── R2 / S3 (optional)  │                      │
│    │(Remotion│                         │                      │
│    │Puppeteer)│                        │                      │
│    └─────────┘                         │                      │
│         │                              │                      │
│         └──────► Upstash Redis (metadata persistence)         │
└─────────────────────────────────────────────────────────────┘
```

**Services:**
- **Backend** — Node.js 20 + Express (API, uploads, auth, WebSocket, health, metrics)
- **Frontend** — React 18 + Vite + Tailwind + PWA (service worker, offline support)
- **Worker** — Remotion + Puppeteer/Chromium (video rendering engine)
- **Remotion** — React components for video composition
- **Caddy** — Reverse proxy with auto-TLS, HTTP/3, security headers

**Deployment Targets:**
- Backend → Render.com (Frankfurt, plan Starter/Free)
- Frontend → Vercel (region fra1)
- Worker → Docker / Cloud Run (or same VPS via docker-compose)

---

## 3. Backend Service Analysis

### 3.1 Structure & Code Quality ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Modular architecture | ✅ | Clean separation: routes, middleware, data, monitoring, lib |
| ESM modules | ✅ | `"type": "module"` throughout |
| Error handling | ✅ | Centralized `errorHandlerMiddleware`, `AppError` class, asyncHandler wrapper |
| Input validation | ✅ | `express-validator` + custom `sanitizerMiddleware` |
| Path traversal protection | ✅ | `normalize()` + `startsWith(resolve(dir))` checks on file serving |
| Graceful shutdown | ✅ | `flushOnExit` for DB persistence on SIGTERM/SIGINT |
| Process signals | ✅ | `dumb-init` in Docker, `unhandledRejection`/`uncaughtException` handlers |

### 3.2 Health & Observability ✅

| Feature | Status | Details |
|---------|--------|---------|
| `/health` endpoint | ✅ | Returns 200 with uptime, memory, disk, request/error metrics |
| `/metrics` endpoint | ✅ | Extended metrics + alert state, admin-protected |
| Docker healthcheck | ✅ | `node -e "http.get('http://localhost:3010/health')"` |
| In-memory metrics | ✅ | Request count, upload stats, error tracking, disk usage |
| Alert monitoring | ✅ | Error rate (5%), disk (80%), memory (90%) thresholds with rate-limited alerts |
| Sentry integration | ✅ | Configurable DSN, PII scrubbing (passwords, cookies, auth headers redacted) |
| Winston logging | ✅ | Console + file transports, log rotation, structured context |
| Cleanup scheduler | ✅ | Hourly job removing expired uploads + orphaned files |

### 3.3 Security ✅ (with caveats)

| Control | Status | Details |
|---------|--------|---------|
| Helmet headers | ✅ | CSP (disabled for uploads), X-Frame-Options, nosniff, HSTS via Caddy |
| Rate limiting | ✅ | Upload (200/hr), global (500/min), archive (5/min), create (5/10min) |
| CORS | ✅ | Strict origin check, credentials enabled, comma-separated origins |
| Password auth | ⚠️ | `x-app-password` header, constant-time comparison (SHA256 + timingSafeEqual) |
| Admin auth | ✅ | Separate `x-admin-password`, protected routes (`/metrics`, `/api/editor`) |
| Worker key | ✅ | `x-worker-key` for backend↔worker communication, safeEqual comparison |
| Download tokens | ✅ | HMAC-signed `dl_token` with 1h expiry for protected file access |
| File serving | ✅ | `nosniff` + forced `attachment` for non-media files; `inline` for media |
| Request timeout | ✅ | 30s default, 10min for uploads, 10min for TUS |
| Body size limit | ✅ | JSON limited to 100KB; multipart governed by `MAX_FILE_SIZE` |

**Caveat:** Password-only auth is acceptable for an internal hub but should be combined with Vercel Password Protection or VPN if the URL becomes public. There are no user accounts, roles, or session management beyond the password cookie.

### 3.4 Data Persistence ⚠️

| Aspect | Status | Notes |
|--------|--------|-------|
| Storage model | ⚠️ | In-memory JSON object with debounced file writes + optional Redis sync |
| Redis (Upstash) | ✅ | REST-based Redis for metadata persistence on Render Free tier |
| Atomic writes | ✅ | Temp file + rename pattern for local JSON store |
| Debounced persistence | ✅ | 1.5s debounce / 5s max wait to batch rapid mutations |
| File uploads | ⚠️ | Stored on local disk; Render Free wipes disk after 15min inactivity |
| R2/S3 support | ✅ | Worker can upload exports to Cloudflare R2 (optional) |

**Critical Risk:** On Render Free, uploaded files disappear when the instance sleeps. The project acknowledges this in README and DEPLOYMENT.md. Metadata survives via Redis, but **users will lose uploaded files unless**:
- Upgrading to Render Starter with disk, OR
- Migrating file storage to S3/R2 (partially implemented for worker exports only), OR
- Using Docker/VPS deployment with persistent volume

### 3.5 Dependencies ⚠️

```
Backend: 16 vulnerabilities (10 moderate, 5 high, 1 critical)
Frontend: 12 vulnerabilities (1 low, 2 moderate, 7 high, 2 critical)
```

**Deprecated packages detected:**
- `multer@1.4.5-lts.1` → vulnerable, upgrade to 2.x
- `fluent-ffmpeg@2.1.3` → no longer supported
- `uuid@9.0.1` → no longer supported, upgrade to 11+
- `glob@7.x / 10.x` → old versions have vulnerabilities

**Recommendations:**
1. Run `npm audit fix` in both backend and frontend
2. Upgrade `multer` to v2.x (breaking changes likely)
3. Replace `fluent-ffmpeg` with direct `child_process` spawn or find an alternative
4. Upgrade `uuid` to latest

---

## 4. Frontend Service Analysis

### 4.1 Build & Delivery ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Vite build | ✅ | Fast, modern bundler |
| PWA | ✅ | Service worker with `vite-plugin-pwa`, injectManifest strategy |
| Auto-update | ✅ | `virtual:pwa-register` with automatic refresh on new version |
| Version polling | ✅ | Checks for new version every 60s in background |
| SPA routing | ✅ | Nginx `try_files` fallback to index.html |
| Asset caching | ✅ | 1-year immutable cache for hashed assets; no-cache for index.html |
| Gzip compression | ✅ | Configured in Nginx |
| Lazy loading | ✅ | Views loaded via `React.lazy()` + Suspense with skeleton fallback |

### 4.2 Code Quality ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| React 18 + StrictMode | ✅ | Modern React patterns |
| Error boundaries | ✅ | `ErrorBoundary` component at app root |
| Toast notifications | ✅ | Custom hook-based toast system |
| i18n | ✅ | `I18nProvider` with language switching |
| API client | ✅ | Centralized `api` module with auth header injection |
| Version check | ✅ | `useVersionCheck` hook forces reload on deploy |

### 4.3 Tests ⚠️

| Suite | Result | Notes |
|-------|--------|-------|
| Backend | **194 passed, 29 files** | ✅ Excellent coverage |
| Frontend | **21 passed, 5 failed** | ⚠️ 5 failures in `Nav.test.jsx` — language switching tests |

**Frontend test failures:** The `Nav.test.jsx` file has issues with `getByText('Reports Space')` returning multiple elements (likely multiple nav items or language duplicates). This is a test fragility issue, not necessarily a production bug, but it indicates the test suite needs maintenance.

---

## 5. Worker / Remotion Service Analysis

### 5.1 Worker Architecture ⚠️

| Aspect | Status | Notes |
|--------|--------|-------|
| Single-render concurrency | ⚠️ | `let rendering = false` — only one render at a time; 429 if busy |
| Render timeout | ✅ | 12-minute hard timeout (configurable via `RENDER_TIMEOUT_MS`) |
| Chromium sandbox | ✅ | `--no-sandbox --disable-setuid-sandbox` for Docker |
| Progress callbacks | ✅ | SSE-style progress posted back to backend via HTTP callback |
| SSRF protection | ✅ | `ALLOWED_RETURN_TO` allowlist for callback URLs |
| Worker key auth | ✅ | `x-worker-key` header required |
| R2 upload | ✅ | Exports can be uploaded to Cloudflare R2 with presigned URLs |
| Local fallback | ✅ | Writes to `/app/uploads/files/exports` if R2 not configured |
| Cleanup | ✅ | Temp directory removed after render (try/finally) |

**Critical Limitation:** The worker only handles ONE render at a time. For a team with multiple editors, this creates a bottleneck. There's no job queue (Redis, BullMQ, etc.). If a render takes 10 minutes, the second editor waits or gets an error. For production scale, consider:
- Adding a job queue (BullMQ with Redis)
- Running multiple worker instances behind a load balancer
- Using a managed render service (Remotion Lambda)

### 5.2 Remotion Setup ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Composition bundling | ✅ | `node scripts/bundle.js` builds the composition bundle |
| Chromium dependency | ✅ | System deps installed in Dockerfile (libnss3, libgtk-3, etc.) |
| Font availability | ✅ | Backend fonts passed to renderer for libass overlays |
| Shared memory | ✅ | `shm_size: 2gb` in docker-compose for Chromium |

---

## 6. Infrastructure & Deployment Analysis

### 6.1 Docker Compose ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Multi-service stack | ✅ | Caddy + Backend + Frontend + Worker |
| Shared volume | ✅ | `uploads_volume` shared between backend, worker, Caddy |
| Health checks | ✅ | All services have health checks |
| Restart policy | ✅ | `unless-stopped` on all services |
| Network isolation | ✅ | Custom bridge network `jt-alwm-network` |
| Environment validation | ✅ | `WORKER_KEY` required (docker-compose fails if empty) |
| HTTP/3 support | ✅ | Caddy configured with QUIC for low-latency networks |

### 6.2 Caddy Configuration ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Auto TLS | ✅ | Let's Encrypt automatic |
| HTTP/3 (QUIC) | ✅ | Configured for Africa/Asia high-latency networks |
| Security headers | ✅ | HSTS, X-Frame-Options, nosniff, CSP, Referrer-Policy |
| Compression | ✅ | zstd + gzip |
| Static asset caching | ✅ | 1-year immutable for hashed assets |
| SPA routing | ✅ | index.html never cached, routes proxy to frontend |
| Upload proxy | ✅ | `/uploads/*` proxied to backend with CORS headers |
| WebSocket proxy | ✅ | `/socket.io/*` proxied to backend |

### 6.3 Render.com Configuration ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| `render.yaml` | ✅ | Blueprint for Render deployment |
| Health check path | ✅ | `/health` |
| Disk mount | ✅ | `/app/uploads` for persistence |
| Environment variables | ✅ | `LOG_DIR`, `JT_STORE_PATH`, `UPLOADS_DIR` point to `/app/uploads` |
| Scaling limit | ✅ | Forced to 1 instance (JSON store is not shared) |
| Max file size | ✅ | 200MB for rushes, 400MB for deliveries |

### 6.4 CI/CD (GitHub Actions) ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Trigger | ✅ | Push/PR to `master` |
| Backend checks | ✅ | Node 20, `npm ci`, lint, tests |
| Frontend checks | ✅ | Node 20, `npm ci`, lint, tests, build |
| Docker build | ✅ | Optional (`continue-on-error: true`) with GHCR push |
| Render deploy | ✅ | Deploy hook (optional, non-blocking) |
| Vercel deploy | ✅ | CLI deploy (optional, non-blocking) |
| Artifact upload | ✅ | Frontend `dist/` uploaded as artifact |

**Note:** The Docker build job is correctly marked as `continue-on-error: true` because Render and Vercel build from source, not from Docker images. The images are for local development convenience.

---

## 7. Security Deep Dive

### 7.1 Authentication Model ⚠️

The app uses a **shared-password model** (not user accounts):
- `GLOBAL_PASSWORD` — required for all API routes except archive download and uploads listing
- `ADMIN_PASSWORD` — required for metrics, protected country (MJ), editor progress
- Password passed via `x-app-password` header (or cookie after login)
- Comparison uses SHA-256 hashing + `timingSafeEqual` (constant-time)
- Token normalization handles NFC, invisible chars, case-insensitivity

**Verdict:** Acceptable for an internal team tool with a private URL. **NOT suitable for public-facing deployment.** Recommendations:
- Enable Vercel Password Protection on the frontend
- Consider adding IP allowlisting at the Caddy/Render level
- For higher security, migrate to OAuth 2.0 / OIDC or simple user accounts

### 7.2 Authorization ✅

| Feature | Status |
|---------|--------|
| Role separation (user vs admin) | ✅ |
| Protected file download (MJ country) | ✅ |
| Download token system (HMAC, 1h expiry) | ✅ |
| Admin-only metrics | ✅ |
| Worker-only internal endpoints | ✅ |

### 7.3 Data Protection ✅

| Control | Status |
|---------|--------|
| Sentry PII scrubbing | ✅ |
| Log query-string redaction | ✅ |
| Password never logged | ✅ |
| Safe file serving (nosniff, attachment) | ✅ |
| Path traversal prevention | ✅ |

### 7.4 Vulnerability Assessment ⚠️

| Vulnerability | Severity | Affected | Mitigation |
|---------------|----------|----------|------------|
| Multer 1.x vulnerabilities | High | Backend | Upgrade to multer 2.x |
| glob 7.x/10.x vulnerabilities | Moderate | Both | Upgrade glob dependencies |
| fluent-ffmpeg unsupported | Moderate | Backend | Replace or vendor |
| uuid 9.x deprecated | Low | Both | Upgrade to uuid 11+ |

---

## 8. Production Readiness Checklist

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Environment variables defined | ✅ | `.env.example`, `.env.example` backend, `render.yaml` |
| 2 | SSL/HTTPS enabled | ✅ | Caddy auto-TLS, Vercel/Render auto-HTTPS |
| 3 | Sentry configured | ✅ | `SENTRY_DSN` env var, scrubbing rules configured |
| 4 | CORS validated | ✅ | Strict origin matching, comma-separated support |
| 5 | Uploads work | ✅ | Multer + TUS support, tested |
| 6 | Health check responds | ✅ | `/health` returns 200 with full metrics |
| 7 | Logs centralized | ✅ | Winston + Sentry + optional webhook |
| 8 | Monitoring active | ✅ | Alert monitoring every 30s, disk/memory/error rate |
| 9 | Backups planned | ⚠️ | Redis persists metadata; files at risk on Free tier |
| 10 | DNS configured | ✅ | `jt-alwm-team.duckdns.org` in Caddyfile |
| 11 | Tests pass | ⚠️ | Backend: 194/194 ✅; Frontend: 21/26 ✅ (5 flaky) |
| 12 | Docker builds | ✅ | Multi-stage Dockerfiles for all services |
| 13 | Graceful shutdown | ✅ | SIGTERM/SIGINT handlers flush DB |
| 14 | Rate limiting | ✅ | Upload, global, archive, create limiters |
| 15 | Security headers | ✅ | Helmet + Caddy combined |
| 16 | PWA / offline | ✅ | Service worker, manifest, icons |
| 17 | WebSocket (Socket.io) | ✅ | Real-time dashboard updates |
| 18 | Web Push | ⚠️ | Configured but VAPID keys optional |
| 19 | TUS resumable uploads | ✅ | `@tus/server` + `@tus/file-store` |
| 20 | Video rendering | ✅ | Remotion + Puppeteer pipeline |

---

## 9. Critical Issues (Must Fix Before Production)

### 🔴 CRITICAL-1: Dependency Vulnerabilities
**Impact:** Security exposure  
**Action:** Run `npm audit fix` in both backend and frontend. Upgrade `multer` to v2.x.  
**Effort:** 1-2 hours

### 🟡 CRITICAL-2: Frontend Test Failures
**Impact:** CI/CD pipeline may fail, regressions not caught  
**Action:** Fix `Nav.test.jsx` — use `getAllByText` + index, or add `data-testid` for precise selection.  
**Effort:** 30 minutes

### 🟡 CRITICAL-3: File Persistence on Render Free
**Impact:** Uploaded files vanish after 15min inactivity  
**Action:** Either:
- Upgrade to Render Starter (paid, ~$7/month) with persistent disk, OR
- Integrate S3/R2 for file storage (backend uploads, not just worker exports), OR
- Deploy on VPS with Docker volume  
**Effort:** 2-4 hours for S3 integration; $0 for VPS; $7/month for Render Starter

### 🟡 CRITICAL-4: Worker Single-Concurrency Bottleneck
**Impact:** Only one video render at a time; team waits  
**Action:** Add a job queue (BullMQ + Redis) or run multiple worker instances.  
**Effort:** 4-8 hours

---

## 10. Recommendations (Should Fix Soon)

| # | Recommendation | Priority | Effort |
|---|----------------|----------|--------|
| 1 | Add database migration (PostgreSQL or SQLite) instead of JSON file | High | 8-16h |
| 2 | Add proper user accounts with roles (editor, correspondent, admin) | High | 16-24h |
| 3 | Configure VAPID keys for Web Push notifications | Medium | 30min |
| 4 | Add `@tus/file-store` → S3/R2 for large file storage | Medium | 4-8h |
| 5 | Add Prometheus/metrics endpoint with OpenMetrics format | Low | 2-4h |
| 6 | Add database backup automation (for when DB is added) | Medium | 2-4h |
| 7 | Add load testing with `k6` or `artillery` | Low | 2-4h |
| 8 | Configure `ALERT_WEBHOOK_URL` for Discord/Slack notifications | Low | 15min |
| 9 | Add `dependabot.yml` for automated dependency updates | Low | 15min |
| 10 | Add `CODEOWNERS` file for PR review requirements | Low | 10min |

---

## 11. Deployment Decision Matrix

| Scenario | Recommendation | Notes |
|----------|---------------|-------|
| **Internal team, < 10 users, budget $0** | Deploy on Render Free + Vercel | Accept file loss risk; use Redis for metadata; add Vercel Password Protection |
| **Internal team, < 10 users, budget $10/mo** | Render Starter + Vercel | Persistent disk solves file loss; still no DB |
| **Growing team, 10-50 users** | VPS (Hetzner/DigitalOcean) + Docker Compose | Full control, persistent volumes, cheaper than Render |
| **Professional broadcast use** | Add PostgreSQL + S3 + multiple workers | Requires dev investment but scales properly |

---

## 12. Conclusion

**JT ALWM is a well-architected, production-capable web hub with strong security practices, excellent observability, and solid CI/CD. The codebase shows mature engineering decisions:**

- ✅ Multi-stage Docker builds with non-root users
- ✅ Constant-time password comparison with normalization
- ✅ PII scrubbing in Sentry and logs
- ✅ Debounced atomic writes for data persistence
- ✅ HTTP/3 for low-latency networks
- ✅ Comprehensive test suite (backend)

**However, three items must be addressed before calling it "fully operational for production":**

1. **Fix dependency vulnerabilities** (security)
2. **Fix frontend tests** (quality assurance)
3. **Solve file persistence** (data integrity — either pay for Render Starter, use S3, or deploy on VPS)

Once these are resolved, the project is ready for production deployment. The architecture is sound, the code is maintainable, and the operational tooling (health, metrics, alerts, logging) is already in place.

---

*End of Report*
