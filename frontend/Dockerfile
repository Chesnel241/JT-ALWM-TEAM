# ============================================================================
# STAGE 1: BUILD - Build React app with Vite
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Define build arguments
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY public ./public
COPY index.html ./index.html
COPY vite.config.js ./vite.config.js
COPY tailwind.config.js ./tailwind.config.js
COPY postcss.config.js ./postcss.config.js

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

# Create nginx config with gzip enabled and SPA routing
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
  listen 80;
  server_name _;

  # Définir le dossier racine globalement pour que toutes les 'locations' l'utilisent
  root /usr/share/nginx/html;

  # Enable gzip compression
  gzip on;
  gzip_types text/plain text/css text/xml text/javascript 
             application/x-javascript application/xml+rss 
             application/javascript application/json;
  gzip_min_length 1024;
  gzip_vary on;
  gzip_proxied any;
  gzip_comp_level 6;

  # SPA routing: serve index.html for all non-file routes
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets aggressively
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Health check endpoint
  location /health {
    return 200 "OK\n";
    add_header Content-Type text/plain;
  }
}
EOF

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
