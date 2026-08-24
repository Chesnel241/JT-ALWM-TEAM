# ============================================================================
# STAGE 1: BUILD - Build React app with Vite
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Define build arguments
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Install dependencies
RUN npm ci

# Copy remotion for relative imports
COPY remotion /remotion

# Copy source code
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./index.html
COPY frontend/vite.config.js ./vite.config.js
COPY frontend/tailwind.config.js ./tailwind.config.js
COPY frontend/postcss.config.js ./postcss.config.js

# Build the Vite application
RUN npm run build

# Verify build output
RUN ls -la dist/

# ============================================================================
# STAGE 2: RUNTIME - Serve with nginx-alpine
# ============================================================================
FROM nginx:1.27-alpine

# Configure nginx with gzip and optimizations
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx config with gzip enabled, backend proxying, and SPA routing
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
  listen 80;
  server_name _;

  # Définir le dossier racine globalement pour que toutes les 'locations' l'utilisent
  root /usr/share/nginx/html;
  client_max_body_size 20G;

  # Enable gzip compression
  gzip on;
  gzip_types text/plain text/css text/xml text/javascript 
             application/x-javascript application/xml+rss 
             application/javascript application/json;
  gzip_min_length 1024;
  gzip_vary on;
  gzip_proxied any;
  gzip_comp_level 6;

  # Health check endpoint
  location /health {
    return 200 "OK\n";
    add_header Content-Type text/plain;
  }

  # Proxy /uploads/ vers le backend (pour vidéos, audios, images, rushes, exports)
  location /uploads/ {
    proxy_pass http://backend:3010/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
  }

  # Proxy /api/ vers le backend (API REST & TUS)
  location /api/ {
    proxy_pass http://backend:3010/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 7200s;
    proxy_send_timeout 7200s;
    proxy_request_buffering off;
  }

  # Proxy /socket.io/ vers le backend (WebSocket)
  location /socket.io/ {
    proxy_pass http://backend:3010/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Cache static assets aggressively
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  # SPA routing: serve index.html for all non-file routes
  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
