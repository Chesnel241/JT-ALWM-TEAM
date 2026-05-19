# 🔐 Security & Configuration Checklist

## Environment Variables Security

### Production (.env)
```bash
# ⚠️  IMPORTANT : Ne JAMAIS commiter .env en production
# Créer .env à partir du template .env.example
```

### Files à NE PAS COMMITER
```
.env                    # Production secrets
.env.local              # Local secrets
.env.*.local            # All local env files
credentials.json        # API credentials
*.pem                   # SSL certificates
*.key                   # Private keys
```

**Add to .gitignore:**
```
# Environment & Secrets
.env*
!.env.example

# Sensitive files
credentials.json
*.pem
*.key
```

---

## 🔒 Render.com Security

### Environment Variables
```
NODE_ENV=production
PORT=3010
CORS_ORIGIN=https://jt-alwm-frontend.vercel.app
```

### DO NOT expose
```
❌ Database URLs in logs
❌ API keys in error messages
❌ Private information in public endpoints
❌ Uploads directory via web root (use /uploads route only)
```

### Monitoring
```
✓ Health checks pass consistently
✓ No 5xx errors in logs
✓ Response times < 500ms
✓ Container memory usage < 500MB
```

---

## 🔒 Vercel Frontend Security

### Build Secrets (NOT visible in browser)
```
VITE_API_URL      → Runtime endpoint only
```

### DO NOT expose
```
❌ API keys
❌ Auth tokens
❌ Database URLs
❌ Private credentials
```

### Note on VITE_ prefix
```
All VITE_ prefixed variables are embedded in frontend
code after build! Use for non-sensitive URLs only.
```

---

## 🌐 CORS Configuration

### Local Development
```
CORS_ORIGIN=http://localhost:5173,http://localhost
```

### Production
```
CORS_ORIGIN=https://jt-alwm-frontend.vercel.app
```

### Render.com Setup
1. Settings → Environment
2. Update `CORS_ORIGIN` to match your Vercel domain
3. Redeploy service

---

## 📡 Network Ports

### Local Development
```
Frontend  : 80   → localhost:80
Backend   : 3010 → localhost:3010
```

### Production
```
Frontend  : 443  → Vercel CDN (automatic HTTPS)
Backend   : 443  → Render HTTPS endpoint
Internal  : 3010 (within Render container)
```

---

## 🚨 Troubleshooting Checklist

### Backend not responding
```
□ Check Render logs: Dashboard → Logs
□ Verify PORT=3010 in environment
□ Verify CORS_ORIGIN is correctly set
□ Check disk quota not exceeded
□ Check health endpoint: /api/weeks
```

### Frontend shows API errors
```
□ Check browser console for CORS errors
□ Verify VITE_API_URL in Vercel env vars
□ Ping backend health: curl https://backend.onrender.com/api/weeks
□ Check network tab for 403/CORS errors
□ Check backend logs for errors
```

### Docker build fails locally
```
□ docker system prune -a (clean unused)
□ rm -rf node_modules package-lock.json
□ docker-compose build --no-cache
□ Check Dockerfile for typos
□ Verify all COPY paths exist
```

### GitHub Actions failing
```
□ Check workflow logs: GitHub → Actions
□ Verify secrets are set: Settings → Secrets
□ Check YAML syntax: .github/workflows/deploy.yml
□ Verify branch is 'master' (case-sensitive)
□ Verify conditions for deploy jobs
```

---

## 🔄 Update Process

### Update Backend Code
```bash
git commit -m "feat: new feature"
git push origin master
# GitHub Actions → Render auto-deploys
```

### Update Environment Variables
```
1. Render Dashboard → Environment
2. Edit variable
3. Save & Redeploy
```

### Update CORS Origins
```
1. Render Dashboard → Environment
2. Update CORS_ORIGIN
3. Save & Redeploy backend
```

---

## 📝 Logging & Monitoring

### View Logs

**Backend (Render)**
```
Dashboard → Service → Logs
Filter: recent deployments
```

**Frontend (Vercel)**
```
Dashboard → Deployments → [Latest] → Logs
```

**Local Development**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Key Metrics to Monitor
```
✓ API response time < 500ms
✓ Error rate < 1%
✓ Uptime > 99%
✓ CPU usage < 50%
✓ Memory usage < 500MB
```

---

## 🔄 Backup & Recovery

### Uploads Volume (Render)
```
Location: /app/uploads (persistent disk)
Size: 2 GB
Backup: Manual via Render dashboard
```

### Database (Future)
```
Consider adding PostgreSQL for:
- User metadata
- Upload history
- Analytics
```

---

## ✅ Pre-Production Checklist

- [ ] All tests passing (GitHub Actions)
- [ ] Docker builds successful
- [ ] Health checks responding
- [ ] CORS properly configured
- [ ] Secrets configured on Render/Vercel
- [ ] Environment variables set
- [ ] Logs monitoring enabled
- [ ] Tested uploading files
- [ ] Tested API endpoints
- [ ] Frontend connects to backend
- [ ] SSL/HTTPS working

---

## 📞 Emergency Procedures

### If Backend is down
```bash
# 1. Check Render logs
# 2. Verify environment variables
# 3. Manual redeploy: Dashboard → Redeploy
# 4. Check disk space: Settings → Disk
# 5. Force restart: redeploy latest commit
```

### If Frontend is down
```bash
# 1. Check Vercel deployment logs
# 2. Verify build command: npm run build
# 3. Check environment variables
# 4. Redeploy: Vercel → Deployments → Redeploy
```

### If CI/CD failing
```bash
# 1. Check GitHub Actions logs
# 2. Verify secrets are still valid
# 3. Check Docker builds locally: docker-compose build
# 4. Review .github/workflows/deploy.yml syntax
# 5. Manually redeploy if needed
```

---

## 🎓 Useful Commands Reference

```bash
# Local Development
docker-compose up -d              # Start all services
docker-compose logs -f            # View all logs
docker-compose down               # Stop services
docker-compose down -v            # Stop & remove volumes

# Docker Debugging
docker ps                         # List running containers
docker images                     # List images
docker logs <container>           # View container logs
docker exec -it <container> sh   # Access container shell

# Production Commands
# (Use Render/Vercel dashboards instead of CLI)
```

---

## 📚 Further Reading

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Render Environment Variables](https://render.com/docs/environment-variables)

