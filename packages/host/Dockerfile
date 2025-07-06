# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm and Claude Code
RUN npm install -g pnpm@latest
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package.json pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/host/package.json ./packages/host/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/host ./packages/host

# Build both packages using turbo
RUN pnpm build --filter @vibe-coder/host

# Production stage
FROM node:20-alpine AS production

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

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/host/package.json ./packages/host/

# Install all dependencies (production only)
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/host/dist ./packages/host/dist

# Create claude config directory
RUN mkdir -p /app/.claude && \
    chown -R nodejs:nodejs /app/.claude

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

# Set working directory to host package
WORKDIR /app/packages/host

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/host/src/index.js"]