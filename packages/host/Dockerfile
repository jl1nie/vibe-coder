# Build stage
FROM node:20-bookworm AS builder

# Add security and process management packages
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

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
FROM node:20-bookworm AS production

WORKDIR /app

# Install pnpm, Claude Code and required packages
RUN npm install -g pnpm@latest
RUN npm install -g @anthropic-ai/claude-code

# Add security packages and Claude CLI requirements
RUN apt-get update && apt-get install -y \
    curl \
    zsh \
    git \
    bash \
    build-essential \
    python3 \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/host/package.json ./packages/host/

# Install all dependencies with native rebuilds for wrtc
RUN pnpm install --frozen-lockfile

# Rebuild native modules including wrtc in production environment
# Install node-pre-gyp globally and rebuild wrtc
RUN npm install -g node-pre-gyp

# Force rebuild @roamhq/wrtc from source if prebuilt binaries fail
RUN cd /app/node_modules/.pnpm/@roamhq+wrtc@0.8.0/node_modules/@roamhq/wrtc && \
    (npm run install || npm run install --build-from-source) && \
    ls -la build/ || echo "@roamhq/wrtc build attempted"

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