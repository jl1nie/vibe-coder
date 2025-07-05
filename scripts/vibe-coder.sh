#!/bin/bash

# 🎯 Vibe Coder - All-in-One Launcher
# スマホから Claude Code を直感的に操作できるモバイル最適化リモート開発環境

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Docker Configuration
DOCKER_IMAGE="vibe-coder/host"
DOCKER_TAG="latest"
OFFICIAL_DOCKER_IMAGE="jl1nie/vibe-coder"

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

log_title() {
    echo -e "${PURPLE}🎯 $1${NC}"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install: https://docs.docker.com/get-docker/ and https://nodejs.org/"
        exit 1
    fi
}

# Load environment variables
load_environment() {
    if [[ -f "$ENV_FILE" ]]; then
        source "$ENV_FILE"
        log_success "Environment loaded from .env.local"
    else
        log_warning ".env.local not found, using defaults"
        log_info "Run: cp .env.example .env.local to customize settings"
    fi
}

# Check if using official Docker image
use_official_image() {
    local use_official="${USE_OFFICIAL_DOCKER_IMAGE:-true}"
    [[ "$use_official" == "true" ]]
}

# Pull or build Docker image
prepare_docker_image() {
    if use_official_image; then
        log_info "Using official Docker image: $OFFICIAL_DOCKER_IMAGE:$DOCKER_TAG"
        if ! docker pull "$OFFICIAL_DOCKER_IMAGE:$DOCKER_TAG" 2>/dev/null; then
            log_warning "Failed to pull official image, building locally..."
            build_docker_image
        else
            log_success "Official Docker image ready"
        fi
    else
        log_info "Building Docker image locally..."
        build_docker_image
    fi
}

# Build Docker image locally
build_docker_image() {
    log_info "Building Docker image: $DOCKER_IMAGE:$DOCKER_TAG"
    
    # Create Dockerfile if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/Dockerfile" ]]; then
        create_dockerfile
    fi
    
    docker build -t "$DOCKER_IMAGE:$DOCKER_TAG" "$PROJECT_ROOT"
    log_success "Docker image built successfully"
}

# Create Dockerfile
create_dockerfile() {
    log_info "Creating Dockerfile..."
    
cat > "$PROJECT_ROOT/Dockerfile" << 'EOF'
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
    bash

# Install Claude Code CLI
RUN npm install -g @anthropic/claude-code

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vibe-coder -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY packages/host/ ./
COPY packages/shared/ ./shared/

# Create necessary directories
RUN mkdir -p /app/workspace /app/sessions && \
    chown -R vibe-coder:nodejs /app

# Switch to non-root user
USER vibe-coder

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose ports
EXPOSE 8080

# Start the application
CMD ["node", "src/server.js"]
EOF

    log_success "Dockerfile created"
}

# Start services
start_services() {
    local claude_api_key="${CLAUDE_API_KEY:-}"
    local signaling_server="${SIGNALING_SERVER_URL:-https://signal.vibe-coder.space}"
    local host_port="${HOST_PORT:-8080}"
    local pwa_port="${PWA_PORT:-3000}"
    
    if [[ -z "$claude_api_key" ]]; then
        log_error "CLAUDE_API_KEY is required"
        log_info "Please set your Claude API key in .env.local:"
        log_info "CLAUDE_API_KEY=sk-ant-xxxxx"
        exit 1
    fi
    
    log_title "Starting Vibe Coder..."
    log_info "🖥️  Host Server: http://localhost:$host_port"
    log_info "📱 PWA: https://vibe-coder.space (or http://localhost:$pwa_port for dev)"
    log_info "📡 Signaling: $signaling_server"
    echo
    
    # Determine which Docker image to use
    local image_to_use
    if use_official_image && docker image inspect "$OFFICIAL_DOCKER_IMAGE:$DOCKER_TAG" &>/dev/null; then
        image_to_use="$OFFICIAL_DOCKER_IMAGE:$DOCKER_TAG"
    else
        image_to_use="$DOCKER_IMAGE:$DOCKER_TAG"
    fi
    
    # Stop existing container if running
    if docker ps -q -f name=vibe-coder-host | grep -q .; then
        log_info "Stopping existing Vibe Coder container..."
        docker stop vibe-coder-host > /dev/null 2>&1 || true
        docker rm vibe-coder-host > /dev/null 2>&1 || true
    fi
    
    # Start host server container
    log_info "Starting Vibe Coder Host Server..."
    docker run -d \
        --name vibe-coder-host \
        -p "$host_port:8080" \
        -e CLAUDE_API_KEY="$claude_api_key" \
        -e SIGNALING_SERVER_URL="$signaling_server" \
        -e NODE_ENV="${NODE_ENV:-production}" \
        -e DEBUG="${DEBUG:-}" \
        -v "$PROJECT_ROOT/workspace:/app/workspace" \
        -v "$PROJECT_ROOT/sessions:/app/sessions" \
        --restart unless-stopped \
        "$image_to_use"
    
    # Wait for server to be ready
    log_info "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$host_port/health" &>/dev/null; then
            break
        fi
        if [[ $i -eq 30 ]]; then
            log_error "Server failed to start within 30 seconds"
            docker logs vibe-coder-host
            exit 1
        fi
        sleep 1
    done
    
    log_success "Vibe Coder Host Server started successfully!"
    
    # Show access information
    echo
    log_title "🎉 Vibe Coder is ready!"
    echo
    log_info "📱 PWA Access:"
    log_info "   • Public: https://vibe-coder.space"
    log_info "   • Dev: npm run dev (in apps/web/)"
    echo
    log_info "🖥️  Host Server:"
    log_info "   • API: http://localhost:$host_port"
    log_info "   • Health: http://localhost:$host_port/health"
    log_info "   • Logs: docker logs -f vibe-coder-host"
    echo
    log_info "📡 Connection:"
    log_info "   • Server ID: $(curl -s http://localhost:$host_port/api/connection/id 2>/dev/null || echo 'starting...')"
    log_info "   • Signaling: $signaling_server"
    echo
    log_success "Ready for mobile connections! 🚀"
}

# Stop services
stop_services() {
    log_info "Stopping Vibe Coder services..."
    
    if docker ps -q -f name=vibe-coder-host | grep -q .; then
        docker stop vibe-coder-host > /dev/null 2>&1 || true
        docker rm vibe-coder-host > /dev/null 2>&1 || true
        log_success "Vibe Coder Host Server stopped"
    else
        log_warning "No running Vibe Coder services found"
    fi
}

# Show status
show_status() {
    log_title "Vibe Coder Status"
    echo
    
    # Check Docker container
    if docker ps -q -f name=vibe-coder-host | grep -q .; then
        log_success "Host Server: Running"
        local server_id=$(curl -s http://localhost:${HOST_PORT:-8080}/api/connection/id 2>/dev/null || echo "unknown")
        log_info "Server ID: $server_id"
    else
        log_warning "Host Server: Stopped"
    fi
    
    # Check Docker image
    if use_official_image; then
        if docker image inspect "$OFFICIAL_DOCKER_IMAGE:$DOCKER_TAG" &>/dev/null; then
            log_success "Docker Image: $OFFICIAL_DOCKER_IMAGE:$DOCKER_TAG (official)"
        else
            log_warning "Official Docker image not available"
        fi
    else
        if docker image inspect "$DOCKER_IMAGE:$DOCKER_TAG" &>/dev/null; then
            log_success "Docker Image: $DOCKER_IMAGE:$DOCKER_TAG (local)"
        else
            log_warning "Local Docker image not built"
        fi
    fi
    
    # Show logs
    if docker ps -q -f name=vibe-coder-host | grep -q .; then
        echo
        log_info "Recent logs:"
        docker logs --tail=10 vibe-coder-host
    fi
}

# Show logs
show_logs() {
    if docker ps -q -f name=vibe-coder-host | grep -q .; then
        log_info "Following Vibe Coder logs (Ctrl+C to exit)..."
        docker logs -f vibe-coder-host
    else
        log_error "Vibe Coder Host Server is not running"
        exit 1
    fi
}

# Show help
show_help() {
    echo "🎯 Vibe Coder - Mobile-First Claude Code Remote Development Environment"
    echo
    echo "Usage:"
    echo "  npm run vibe-coder [COMMAND]"
    echo
    echo "Commands:"
    echo "  start     Start Vibe Coder services (default)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  status    Show service status"
    echo "  logs      Show and follow logs"
    echo "  build     Build Docker image locally"
    echo "  help      Show this help message"
    echo
    echo "Examples:"
    echo "  npm run vibe-coder          # Start services"
    echo "  npm run vibe-coder stop     # Stop services"
    echo "  npm run vibe-coder logs     # View logs"
    echo
    echo "Configuration:"
    echo "  Edit .env.local to customize settings"
    echo "  Set CLAUDE_API_KEY for Claude Code integration"
    echo "  Set USE_OFFICIAL_DOCKER_IMAGE=false to build locally"
    echo
    echo "Access:"
    echo "  📱 PWA: https://vibe-coder.space"
    echo "  🖥️  API: http://localhost:8080"
    echo "  📡 Signaling: https://signal.vibe-coder.space"
}

# Main function
main() {
    local command="${1:-start}"
    
    case "$command" in
        "start")
            check_dependencies
            load_environment
            prepare_docker_image
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 2
            check_dependencies
            load_environment
            prepare_docker_image
            start_services
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "build")
            check_dependencies
            load_environment
            build_docker_image
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"