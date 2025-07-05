# Multi-stage build for Vibe Coder Host Server
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine as runtime

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    bash \
    ca-certificates

# Install Claude Code CLI
RUN npm install -g @anthropic/claude-code

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vibe-coder -u 1001

# Set working directory
WORKDIR /app

# Copy application files
COPY --from=builder /app/node_modules ./node_modules
COPY packages/host/ ./
COPY packages/shared/ ./shared/

# Create necessary directories
RUN mkdir -p /app/workspace /app/sessions /app/logs && \
    chown -R vibe-coder:nodejs /app

# Switch to non-root user
USER vibe-coder

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose ports
EXPOSE 8080

# Environment variables
ENV NODE_ENV=production
ENV HOST_PORT=8080
ENV SIGNALING_SERVER_URL=https://signal.vibe-coder.space

# Start the application
CMD ["node", "src/server.js"]