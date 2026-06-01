# Worker de rendu Remotion pour Docker / Cloud Run.
FROM node:20-bookworm-slim

# Dépendances système de Chromium headless (requis par @remotion/renderer).
# Inclut libdrm2, libx11-6, libxshmfence1 pour compatibilité complète.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 libxkbcommon0 \
    libxfixes3 libxcomposite1 libxdamage1 libxext6 libxcb1 libxcursor1 \
    libgtk-3-0 libpango-1.0-0 libcairo2 libgbm1 fonts-liberation \
    libdrm2 libx11-6 libxshmfence1 libxi6 libxtst6 \
    ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bundle Remotion (composition partagée).
COPY remotion/package*.json ./remotion/
RUN cd remotion && npm ci
COPY remotion ./remotion
RUN cd remotion && node scripts/bundle.js

# Worker.
COPY worker/package*.json ./worker/
RUN cd worker && npm ci
COPY worker ./worker

# Télécharge le navigateur headless de Remotion à la construction (cold start).
RUN cd worker && node -e "import('@remotion/renderer').then(m=>m.ensureBrowser())"

# Créer un utilisateur non-root pour que Chromium puisse utiliser son sandbox.
# Chrome refuse catégoriquement de lancer le sandbox en tant que root.
RUN useradd -m remotionuser \
  && mkdir -p /app/uploads/files/exports \
  && chown -R remotionuser:remotionuser /app/uploads \
  && chown -R remotionuser:remotionuser /app/worker \
  && chown -R remotionuser:remotionuser /app/remotion/build \
  && chown -R remotionuser:remotionuser /tmp

USER remotionuser

ENV REMOTION_SERVE_URL=/app/remotion/build
ENV PORT=8080
EXPOSE 8080
WORKDIR /app/worker
CMD ["node", "src/index.js"]
