# Build stage
FROM node:20-alpine AS builder

# Add security and process management packages
RUN apk add --no-cache dumb-init su-exec

# Environment variables for dynamic UID/GID
ARG HOST_UID=1001
ARG HOST_GID=1001

# Create a non-root user with dynamic UID/GID
RUN addgroup -g ${HOST_GID} -S nodejs && \
    adduser -S nodejs -u ${HOST_UID} -G nodejs

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

# Change ownership of everything to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to the non-root user
USER nodejs

# Production stage
FROM node:20-alpine AS production

# Environment variables for dynamic UID/GID (production)
ARG HOST_UID=1001
ARG HOST_GID=1001

WORKDIR /app

# Install pnpm, Claude Code and required packages
RUN npm install -g pnpm@latest
RUN npm install -g @anthropic-ai/claude-code

# Add security packages
RUN apk add --no-cache \
    dumb-init \
    su-exec \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user with dynamic UID/GID
RUN addgroup -g ${HOST_GID} -S nodejs && \
    adduser -S nodejs -u ${HOST_UID} -G nodejs

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/host/package.json ./packages/host/

# Install all dependencies (production only)
RUN pnpm install --frozen-lockfile

# Copy built application
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/host/dist ./packages/host/dist

# Create directories and set permissions
RUN mkdir -p /app/.claude /app/logs && \
    chown -R nodejs:nodejs /app/.claude /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV CLAUDE_CONFIG_PATH=/app/.claude

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Switch to non-root user
USER nodejs

# Set working directory to root for dependencies
WORKDIR /app

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/host/dist/host/src/index.js"]