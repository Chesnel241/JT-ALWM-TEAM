# Worker de rendu Remotion pour Docker / Cloud Run.
FROM node:20-bookworm-slim

# 1. Dépendances système de Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 libxkbcommon0 \
    libxfixes3 libxcomposite1 libxdamage1 libxext6 libxcb1 libxcursor1 \
    libgtk-3-0 libpango-1.0-0 libcairo2 libgbm1 fonts-liberation \
    libdrm2 libx11-6 libxshmfence1 libxi6 libxtst6 \
    ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Installation et build
COPY remotion/package*.json ./remotion/
RUN cd remotion && npm ci
COPY remotion ./remotion
RUN cd remotion && node scripts/bundle.js

COPY worker/package*.json ./worker/
RUN cd worker && npm ci
COPY worker ./worker

# Télécharge Chrome
RUN cd worker && node -e "import('@remotion/renderer').then(m=>m.ensureBrowser())"

# 3. Configuration d'exécution
RUN mkdir -p /app/uploads/files/exports

ENV REMOTION_SERVE_URL=/app/remotion/build
ENV PORT=8080
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox"
EXPOSE 8080

WORKDIR /app/worker
CMD ["node", "src/index.js"]
