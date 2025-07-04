# Multi-stage build for optimization
FROM node:20-alpine AS builder

# Install system dependencies
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/host/package.json ./packages/host/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/host ./packages/host
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build the application
RUN pnpm -F host build

# Production stage
FROM node:20-alpine AS runtime

# Install Claude Code CLI and system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    bash \
    && npm install -g @anthropic/claude-code

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vibe-coder -u 1001

# Create necessary directories
RUN mkdir -p /app/workspace /app/sessions /app/logs && \
    chown -R vibe-coder:nodejs /app

WORKDIR /app

# Copy built application and entrypoint
COPY --from=builder --chown=vibe-coder:nodejs /app/packages/host/dist ./dist
COPY --from=builder --chown=vibe-coder:nodejs /app/node_modules ./node_modules
COPY --chown=vibe-coder:nodejs docker/host/entrypoint.sh ./entrypoint.sh

# Make entrypoint executable
USER root
RUN chmod +x ./entrypoint.sh
USER vibe-coder

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

# Expose ports
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV WORKSPACE_DIR=/app/workspace
ENV LOG_LEVEL=info

# Start the application
ENTRYPOINT ["./entrypoint.sh"]