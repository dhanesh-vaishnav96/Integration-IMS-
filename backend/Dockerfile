# Build stage
FROM node:18-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy package files first (layer caching - only reinstall when package.json changes)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# ─────────────────────────────────────────────────────────────────────────────
# Runtime stage
FROM node:18-alpine

# Create a non-root user for security (never run as root in containers)
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

WORKDIR /app

# Copy installed node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY --chown=nodeuser:nodejs . .

# Switch to non-root user
USER nodeuser

# Expose application port
EXPOSE 5000

# Health check so Docker/Kubernetes knows when the container is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

# Start the application
CMD ["node", "server.js"]
