# Build stage
FROM node:20-alpine AS builder

# Add security and process management packages
RUN apk add --no-cache dumb-init su-exec

WORKDIR /app

# Install pnpm and Claude Code as root first
RUN npm install -g pnpm@latest
RUN npm install -g @anthropic-ai/claude-code

# Copy package files (as root)
COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/host/package.json ./packages/host/

# Install dependencies (as root)
RUN pnpm install --frozen-lockfile

# Copy source code (as root)
COPY packages/shared ./packages/shared
COPY packages/host ./packages/host

# Build shared package first (as root)
RUN cd packages/shared && pnpm build

# Build host package (as root)
RUN cd packages/host && pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm, Claude Code and required packages
RUN npm install -g pnpm@latest
RUN npm install -g @anthropic-ai/claude-code

# Add security packages and Claude CLI requirements
RUN apk add --no-cache \
    dumb-init \
    su-exec \
    curl \
    zsh \
    git \
    bash \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/host/package.json ./packages/host/

# Install all dependencies (production only)
RUN pnpm install --frozen-lockfile

# Copy built application
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/host/dist ./packages/host/dist

# Create directories with permissive permissions (runtime user will be created by entrypoint)
# This ensures the runtime user can access these directories regardless of UID/GID
RUN mkdir -p /app/.claude /app/logs /app/workspace && \
    chmod 755 /app/.claude /app/logs /app/workspace

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV CLAUDE_CONFIG_PATH=/app/.claude

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Create entrypoint script for runtime UID/GID setup
COPY packages/host/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set working directory to workspace (user's directory)
WORKDIR /app/workspace

# Start the application with dynamic user setup
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "/app/packages/host/dist/host/src/index.js"]