# ============================================================================
# STAGE 1: BUILD - Install dependencies and prepare files
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies if needed for build)
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Verify the app structure
RUN ls -la

# ============================================================================
# STAGE 2: RUNTIME - Minimal production image
# ============================================================================
FROM node:20-alpine

WORKDIR /app

# Install dumb-init to handle PID 1 signals properly
RUN apk add --no-cache dumb-init

# Copy node_modules and source from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3010

# Expose port
EXPOSE 3010

# Health check to verify backend is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Use dumb-init to handle signals correctly
ENTRYPOINT ["dumb-init", "--"]

# Switch to non-root user
USER node

# Start the application
CMD ["node", "src/index.js"]
