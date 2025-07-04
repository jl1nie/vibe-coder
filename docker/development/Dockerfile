# Development environment for all packages
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    bash \
    vim \
    libc6-compat

# Install global tools
RUN npm install -g \
    pnpm@8.15.0 \
    @anthropic/claude-code \
    typescript \
    ts-node

# Create development user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S developer -u 1001

# Create workspace
RUN mkdir -p /workspace && \
    chown -R developer:nodejs /workspace

WORKDIR /workspace

# Switch to development user
USER developer

# Set up development environment
ENV NODE_ENV=development
ENV PNPM_HOME="/home/developer/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Expose common development ports
EXPOSE 3000 3001 5173 8080

# Default command
CMD ["bash"]