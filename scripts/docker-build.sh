#!/bin/bash

# 🐳 Docker Image Build & Push Script
# ホストサーバー用Dockerイメージのビルドとレジストリプッシュ

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
IMAGE_NAME="vibe-coder/host"
REGISTRY_URL="ghcr.io"
FULL_IMAGE_NAME="${REGISTRY_URL}/${IMAGE_NAME}"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
VERSION=$(node -p "require('./package.json').version")

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

show_help() {
    echo "🐳 Docker Image Build & Push Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [TAG]"
    echo ""
    echo "Arguments:"
    echo "  TAG         Image tag (default: latest)"
    echo ""
    echo "Options:"
    echo "  --build-only    Build image without pushing"
    echo "  --push-only     Push existing image without building"
    echo "  --platform      Target platform (default: linux/amd64,linux/arm64)"
    echo "  --registry      Registry URL (default: ghcr.io)"
    echo "  --no-cache      Build without cache"
    echo "  --verbose       Verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build and push latest"
    echo "  $0 v1.0.0            # Build and push with version tag"
    echo "  $0 --build-only      # Build only without pushing"
    echo "  $0 --platform linux/amd64  # Build for specific platform"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Buildx
    if ! docker buildx version &> /dev/null; then
        log_error "Docker Buildx is not available"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir &> /dev/null; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

check_docker_registry_auth() {
    log_info "Checking Docker registry authentication..."
    
    if [[ "$REGISTRY_URL" == "ghcr.io" ]]; then
        # Check GitHub Container Registry authentication
        if ! echo "$GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin &> /dev/null; then
            log_warning "GitHub Container Registry authentication failed"
            log_info "Please set GITHUB_TOKEN environment variable or run: docker login ghcr.io"
            
            if [[ "$PUSH_ONLY" == "true" || "$BUILD_ONLY" != "true" ]]; then
                read -p "Continue without authentication? Push will fail. (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
        else
            log_success "GitHub Container Registry authentication successful"
        fi
    elif [[ "$REGISTRY_URL" == "docker.io" ]]; then
        # Check Docker Hub authentication
        if ! docker login &> /dev/null; then
            log_warning "Docker Hub authentication required"
            log_info "Please run: docker login"
            exit 1
        fi
    fi
}

validate_dockerfile() {
    local dockerfile_path="docker/host/Dockerfile"
    
    log_info "Validating Dockerfile..."
    
    if [[ ! -f "$dockerfile_path" ]]; then
        log_error "Dockerfile not found at $dockerfile_path"
        exit 1
    fi
    
    # Check for security best practices
    local issues=0
    
    # Check for root user
    if grep -q "USER root" "$dockerfile_path" && ! grep -q "USER.*[^root]" "$dockerfile_path"; then
        log_warning "Dockerfile should not run as root user"
        issues=$((issues + 1))
    fi
    
    # Check for HEALTHCHECK
    if ! grep -q "HEALTHCHECK" "$dockerfile_path"; then
        log_warning "Dockerfile should include HEALTHCHECK instruction"
        issues=$((issues + 1))
    fi
    
    # Check for specific versions
    if grep -q "FROM.*:latest" "$dockerfile_path"; then
        log_warning "Dockerfile should use specific image versions instead of 'latest'"
        issues=$((issues + 1))
    fi
    
    if [[ $issues -eq 0 ]]; then
        log_success "Dockerfile validation passed"
    else
        log_warning "Dockerfile has $issues potential issues"
    fi
}

build_image() {
    local tag="$1"
    local full_tag="${FULL_IMAGE_NAME}:${tag}"
    
    log_info "Building Docker image: $full_tag"
    log_info "Platform: $PLATFORM"
    log_info "Context: $(pwd)"
    
    # Prepare build arguments
    local build_args=(
        --build-arg "BUILD_DATE=$BUILD_DATE"
        --build-arg "GIT_COMMIT=$GIT_COMMIT"
        --build-arg "GIT_BRANCH=$GIT_BRANCH"
        --build-arg "VERSION=$VERSION"
        --platform "$PLATFORM"
        --tag "$full_tag"
        --file "docker/host/Dockerfile"
    )
    
    # Add cache options
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args+=(--no-cache)
    else
        build_args+=(--cache-from "$full_tag")
    fi
    
    # Add progress output
    if [[ "$VERBOSE" == "true" ]]; then
        build_args+=(--progress plain)
    else
        build_args+=(--progress auto)
    fi
    
    # Build for multiple platforms if needed
    if [[ "$PLATFORM" == *","* ]]; then
        build_args+=(--push)
        log_info "Multi-platform build detected, will push automatically"
    else
        build_args+=(--load)
    fi
    
    # Execute build
    if docker buildx build "${build_args[@]}" .; then
        log_success "Docker image built successfully: $full_tag"
        
        # Show image information
        if [[ "$PLATFORM" != *","* ]]; then
            local image_size=$(docker images --format "table {{.Size}}" "$full_tag" | tail -n 1)
            log_info "Image size: $image_size"
        fi
        
        return 0
    else
        log_error "Docker image build failed"
        return 1
    fi
}

push_image() {
    local tag="$1"
    local full_tag="${FULL_IMAGE_NAME}:${tag}"
    
    log_info "Pushing Docker image: $full_tag"
    
    if docker push "$full_tag"; then
        log_success "Docker image pushed successfully: $full_tag"
        
        # Show registry information
        log_info "Image available at: $full_tag"
        log_info "Pull command: docker pull $full_tag"
        
        return 0
    else
        log_error "Docker image push failed"
        return 1
    fi
}

tag_additional_versions() {
    local base_tag="$1"
    local full_base_tag="${FULL_IMAGE_NAME}:${base_tag}"
    
    # Tag with version if not already a version tag
    if [[ "$base_tag" != "$VERSION" && "$base_tag" != "v$VERSION" ]]; then
        local version_tag="${FULL_IMAGE_NAME}:${VERSION}"
        log_info "Tagging with version: $version_tag"
        docker tag "$full_base_tag" "$version_tag"
        
        if [[ "$PUSH_ONLY" != "true" && "$BUILD_ONLY" != "true" ]]; then
            push_image "$VERSION"
        fi
    fi
    
    # Tag with branch name if not main/master
    if [[ "$GIT_BRANCH" != "main" && "$GIT_BRANCH" != "master" && "$base_tag" != "$GIT_BRANCH" ]]; then
        local branch_tag="${FULL_IMAGE_NAME}:${GIT_BRANCH}"
        log_info "Tagging with branch: $branch_tag"
        docker tag "$full_base_tag" "$branch_tag"
        
        if [[ "$PUSH_ONLY" != "true" && "$BUILD_ONLY" != "true" ]]; then
            push_image "$GIT_BRANCH"
        fi
    fi
}

generate_image_metadata() {
    local tag="$1"
    local full_tag="${FULL_IMAGE_NAME}:${tag}"
    
    log_info "Generating image metadata..."
    
    local metadata_file="docker-image-metadata.json"
    
    cat > "$metadata_file" << EOF
{
  "image": "$full_tag",
  "tag": "$tag",
  "version": "$VERSION",
  "buildDate": "$BUILD_DATE",
  "gitCommit": "$GIT_COMMIT",
  "gitBranch": "$GIT_BRANCH",
  "registry": "$REGISTRY_URL",
  "platform": "$PLATFORM",
  "pullCommand": "docker pull $full_tag",
  "runCommand": "docker run -d -p 8080:8080 --name vibe-coder-host $full_tag"
}
EOF
    
    log_success "Image metadata saved to $metadata_file"
}

main() {
    local tag="latest"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build-only)
                BUILD_ONLY="true"
                shift
                ;;
            --push-only)
                PUSH_ONLY="true"
                shift
                ;;
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --registry)
                REGISTRY_URL="$2"
                FULL_IMAGE_NAME="${REGISTRY_URL}/${IMAGE_NAME}"
                shift 2
                ;;
            --no-cache)
                NO_CACHE="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                tag="$1"
                shift
                ;;
        esac
    done
    
    # Set defaults
    PLATFORM="${PLATFORM:-linux/amd64,linux/arm64}"
    BUILD_ONLY="${BUILD_ONLY:-false}"
    PUSH_ONLY="${PUSH_ONLY:-false}"
    NO_CACHE="${NO_CACHE:-false}"
    VERBOSE="${VERBOSE:-false}"
    
    # Validate arguments
    if [[ "$BUILD_ONLY" == "true" && "$PUSH_ONLY" == "true" ]]; then
        log_error "Cannot specify both --build-only and --push-only"
        exit 1
    fi
    
    # Show configuration
    log_info "Docker Image Build Configuration:"
    log_info "  Image: $FULL_IMAGE_NAME"
    log_info "  Tag: $tag"
    log_info "  Platform: $PLATFORM"
    log_info "  Version: $VERSION"
    log_info "  Git Commit: $GIT_COMMIT"
    log_info "  Git Branch: $GIT_BRANCH"
    echo
    
    # Execute steps
    check_prerequisites
    validate_dockerfile
    
    if [[ "$PUSH_ONLY" != "true" ]]; then
        check_docker_registry_auth
    fi
    
    # Build image
    if [[ "$PUSH_ONLY" != "true" ]]; then
        if ! build_image "$tag"; then
            exit 1
        fi
    fi
    
    # Push image
    if [[ "$BUILD_ONLY" != "true" ]]; then
        if [[ "$PLATFORM" != *","* ]]; then  # Single platform builds need explicit push
            if ! push_image "$tag"; then
                exit 1
            fi
        fi
        
        # Tag additional versions
        tag_additional_versions "$tag"
    fi
    
    # Generate metadata
    generate_image_metadata "$tag"
    
    log_success "Docker image build process completed successfully!"
    log_info "Image: $FULL_IMAGE_NAME:$tag"
    
    if [[ "$BUILD_ONLY" != "true" ]]; then
        log_info "Registry: $REGISTRY_URL"
        log_info "Pull command: docker pull $FULL_IMAGE_NAME:$tag"
    fi
}

# Run main function with all arguments
main "$@"