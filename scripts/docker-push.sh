#!/bin/bash

# 🐳 Docker Push Script for Vibe Coder
# Docker Hub に公式イメージをプッシュ（メンテナー用）

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Docker Configuration
DOCKER_HUB_ORG="jl1nie"
DOCKER_IMAGE_NAME="vibe-coder"
DOCKER_PLATFORMS="linux/amd64,linux/arm64"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as maintainer
check_maintainer() {
    if [[ "${DOCKER_HUB_USERNAME:-}" == "" ]] || [[ "${DOCKER_HUB_TOKEN:-}" == "" ]]; then
        log_error "This script is for official maintainers only"
        log_info "Set DOCKER_HUB_USERNAME and DOCKER_HUB_TOKEN to push official images"
        log_info ""
        log_info "For general users:"
        log_info "  - Use the official image: docker pull $DOCKER_HUB_ORG/$DOCKER_IMAGE_NAME:latest"
        log_info "  - Or build locally: npm run docker:build"
        exit 1
    fi
}

# Login to Docker Hub
docker_login() {
    log_info "Logging in to Docker Hub..."
    echo "$DOCKER_HUB_TOKEN" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin
    log_success "Docker Hub login successful"
}

# Build and push multi-architecture image
build_and_push() {
    local tag="${1:-latest}"
    local full_image="$DOCKER_HUB_ORG/$DOCKER_IMAGE_NAME:$tag"
    
    log_info "Building and pushing multi-architecture image: $full_image"
    log_info "Platforms: $DOCKER_PLATFORMS"
    
    # Create and use buildx builder
    if ! docker buildx inspect vibe-coder-builder &>/dev/null; then
        log_info "Creating buildx builder..."
        docker buildx create --name vibe-coder-builder --driver docker-container --bootstrap
    fi
    
    docker buildx use vibe-coder-builder
    
    # Build and push
    docker buildx build \
        --platform "$DOCKER_PLATFORMS" \
        --tag "$full_image" \
        --push \
        --file "$PROJECT_ROOT/Dockerfile" \
        "$PROJECT_ROOT"
    
    log_success "Image pushed successfully: $full_image"
    
    # Also tag as latest if not already
    if [[ "$tag" != "latest" ]]; then
        local latest_image="$DOCKER_HUB_ORG/$DOCKER_IMAGE_NAME:latest"
        log_info "Tagging as latest: $latest_image"
        
        docker buildx build \
            --platform "$DOCKER_PLATFORMS" \
            --tag "$latest_image" \
            --push \
            --file "$PROJECT_ROOT/Dockerfile" \
            "$PROJECT_ROOT"
        
        log_success "Latest tag updated: $latest_image"
    fi
}

# Create or update Dockerfile
ensure_dockerfile() {
    local dockerfile="$PROJECT_ROOT/Dockerfile"
    
    if [[ ! -f "$dockerfile" ]]; then
        log_info "Creating production Dockerfile..."
        
cat > "$dockerfile" << 'EOF'
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
EOF
        
        log_success "Dockerfile created"
    else
        log_info "Using existing Dockerfile"
    fi
}

# Generate build metadata
generate_metadata() {
    local version="${1:-latest}"
    local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    log_info "Build metadata:"
    log_info "  Version: $version"
    log_info "  Commit: $commit_hash"
    log_info "  Date: $build_date"
    log_info "  Platforms: $DOCKER_PLATFORMS"
}

# Show usage
show_usage() {
    echo "🐳 Docker Push Script for Vibe Coder"
    echo ""
    echo "Usage:"
    echo "  $0 [VERSION]"
    echo ""
    echo "Examples:"
    echo "  $0              # Push as 'latest'"
    echo "  $0 v1.0.0       # Push as 'v1.0.0' and update 'latest'"
    echo ""
    echo "Environment Variables:"
    echo "  DOCKER_HUB_USERNAME - Docker Hub username"
    echo "  DOCKER_HUB_TOKEN    - Docker Hub access token"
    echo ""
    echo "Note: This script is for official maintainers only."
    echo "General users should use: docker pull $DOCKER_HUB_ORG/$DOCKER_IMAGE_NAME:latest"
}

# Validate Docker buildx
check_buildx() {
    if ! docker buildx version &>/dev/null; then
        log_error "Docker buildx is required for multi-architecture builds"
        log_info "Install Docker Desktop or enable buildx plugin"
        exit 1
    fi
}

# Main function
main() {
    local version="${1:-latest}"
    
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "🐳 Starting Docker push process..."
    
    # Validations
    check_maintainer
    check_buildx
    
    # Prepare
    ensure_dockerfile
    generate_metadata "$version"
    
    # Login and push
    docker_login
    build_and_push "$version"
    
    # Success message
    echo ""
    log_success "🎉 Docker image pushed successfully!"
    log_info "Image: $DOCKER_HUB_ORG/$DOCKER_IMAGE_NAME:$version"
    log_info "Pull command: docker pull $DOCKER_HUB_ORG/$DOCKER_IMAGE_NAME:$version"
    echo ""
    log_info "Users can now run:"
    log_info "  npm run vibe-coder  # Uses official Docker image automatically"
}

# Run main function
main "$@"