# Worker de rendu Remotion pour Cloud Run.
FROM node:20-bookworm-slim

# Dépendances système de Chromium headless (requis par @remotion/renderer).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 libxkbcommon0 \
    libxfixes3 libxcomposite1 libxdamage1 libxext6 libxcb1 libxcursor1 \
    libgtk-3-0 libpango-1.0-0 libcairo2 libgbm1 fonts-liberation \
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

ENV REMOTION_SERVE_URL=/app/remotion/build
ENV PORT=8080
EXPOSE 8080
WORKDIR /app/worker
CMD ["node", "src/index.js"]
