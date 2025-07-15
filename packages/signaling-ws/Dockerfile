# WebSocket-only Signaling Server for Vibe Coder
FROM node:18-alpine

# Install netcat for health check (before switching to non-root user)
RUN apk add --no-cache netcat-openbsd

# Create app directory
WORKDIR /app

# Copy package files
COPY packages/signaling-ws/package*.json ./
COPY packages/signaling-ws/tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy source code
COPY packages/signaling-ws/src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source after build
RUN npm prune --production && rm -rf src/ tsconfig.json

# Create non-root user for security
RUN addgroup -g 1001 -S signaling && \
    adduser -S signaling -u 1001

USER signaling

# Expose WebSocket port
EXPOSE 5175

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD nc -z localhost 5175 || exit 1

# Start server
CMD ["node", "dist/server.js"]