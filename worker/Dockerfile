# Worker de rendu Remotion pour Docker / Cloud Run.
FROM node:20-bookworm-slim

# 1. Dépendances système en root
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 libxkbcommon0 \
    libxfixes3 libxcomposite1 libxdamage1 libxext6 libxcb1 libxcursor1 \
    libgtk-3-0 libpango-1.0-0 libcairo2 libgbm1 fonts-liberation \
    libdrm2 libx11-6 libxshmfence1 libxi6 libxtst6 \
    ca-certificates wget sudo \
  && rm -rf /var/lib/apt/lists/*

# 2. Préparation du dossier de travail
RUN mkdir -p /app && chown node:node /app
WORKDIR /app

# 3. Installation et build en tant qu'utilisateur 'node' (pour le cache Chromium)
USER node

COPY --chown=node:node remotion/package*.json ./remotion/
RUN cd remotion && npm ci
COPY --chown=node:node remotion ./remotion
RUN cd remotion && node scripts/bundle.js

COPY --chown=node:node worker/package*.json ./worker/
RUN cd worker && npm ci
COPY --chown=node:node worker ./worker

# Télécharge Chrome dans /home/node/.cache/
RUN cd worker && node -e "import('@remotion/renderer').then(m=>m.ensureBrowser())"

# 4. Configuration d'exécution
# On repasse en root pour le script de démarrage (qui fixera les permissions du volume)
USER root

ENV REMOTION_SERVE_URL=/app/remotion/build
ENV PORT=8080
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox"
EXPOSE 8080

# Script de démarrage qui crée le dossier d'export, lui donne les droits 777,
# puis lance le worker en tant qu'utilisateur 'node' avec -E pour préserver CHROMIUM_FLAGS.
RUN echo '#!/bin/sh\n\
mkdir -p /app/uploads/files/exports\n\
chmod 777 /app/uploads/files/exports\n\
chmod 755 /app/uploads/files || true\n\
exec sudo -E -u node node src/index.js\n\
' > /app/start.sh && chmod +x /app/start.sh

WORKDIR /app/worker
CMD ["/app/start.sh"]
