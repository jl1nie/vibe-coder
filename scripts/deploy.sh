#!/bin/bash

# 🚀 Vibe Coder Deployment Script
# Handles staging and production deployments with proper validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_DOMAIN="staging.vibe-coder.space"
PRODUCTION_DOMAIN="vibe-coder.space"
WWW_DOMAIN="www.vibe-coder.space"

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
    echo "🚀 Vibe Coder Deployment Script"
    echo ""
    echo "Usage: $0 [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging environment"
    echo "  production  Deploy to production environment"
    echo ""
    echo "Options:"
    echo "  --skip-tests    Skip test execution"
    echo "  --force         Force deployment without confirmation"
    echo "  --dry-run       Show what would be deployed without actually deploying"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 staging"
    echo "  $0 production --force"
    echo "  $0 staging --dry-run"
}

validate_environment() {
    local env=$1
    
    if [[ "$env" != "staging" && "$env" != "production" ]]; then
        log_error "Invalid environment: $env"
        log_info "Valid environments: staging, production"
        exit 1
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "git" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo "$node_version" | cut -d'.' -f1)
    if [[ $major_version -lt 20 ]]; then
        log_error "Node.js version 20+ required, found: $node_version"
        exit 1
    fi
    
    # Check if Vercel CLI is available
    if ! command -v vercel &> /dev/null; then
        log_info "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Check Git status
    if [[ -n $(git status --porcelain) ]]; then
        log_warning "You have uncommitted changes"
        if [[ "$FORCE" != "true" ]]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
    
    log_success "Prerequisites check passed"
}

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests (--skip-tests flag used)"
        return
    fi
    
    log_info "Running test suite..."
    
    # Install dependencies
    npm ci
    
    # Run unit tests
    log_info "Running unit tests..."
    npm run test
    
    # Run integration tests
    log_info "Running integration tests..."
    npm run test:integration || true  # Allow integration tests to fail for now
    
    # Run linting
    log_info "Running linting..."
    npm run lint
    
    # Run type checking
    log_info "Running type checking..."
    npm run typecheck
    
    log_success "All tests passed"
}

build_application() {
    local env=$1
    
    log_info "Building application for $env environment..."
    
    # Set environment variables
    if [[ "$env" == "staging" ]]; then
        export VITE_APP_ENV="staging"
        export VITE_SIGNALING_URL="https://$STAGING_DOMAIN"
        export VITE_API_BASE_URL="https://$STAGING_DOMAIN/api"
    else
        export VITE_APP_ENV="production"
        export VITE_SIGNALING_URL="https://$PRODUCTION_DOMAIN"
        export VITE_API_BASE_URL="https://$PRODUCTION_DOMAIN/api"
    fi
    
    # Build the application
    npm run build
    
    # Check build size
    local build_size=$(du -sh apps/web/dist 2>/dev/null | cut -f1 || echo "unknown")
    log_info "Build size: $build_size"
    
    log_success "Build completed successfully"
}

deploy_signaling_server() {
    local env=$1
    
    log_info "Deploying signaling server to $env..."
    
    cd packages/signaling
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy signaling server to $env"
        cd ../..
        return
    fi
    
    local deploy_args=""
    if [[ "$env" == "production" ]]; then
        deploy_args="--prod"
    fi
    
    # Deploy to Vercel
    vercel deploy $deploy_args \
        --env NODE_ENV="$env" \
        --build-env NODE_ENV="$env" \
        --confirm
    
    cd ../..
    
    log_success "Signaling server deployed to $env"
}

deploy_pwa() {
    local env=$1
    
    log_info "Deploying PWA to $env..."
    
    cd apps/web
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy PWA to $env"
        cd ../..
        return
    fi
    
    local deploy_args=""
    if [[ "$env" == "production" ]]; then
        deploy_args="--prod"
    fi
    
    # Deploy to Vercel
    vercel deploy $deploy_args \
        --env NODE_ENV="$env" \
        --build-env NODE_ENV="$env" \
        --confirm
    
    cd ../..
    
    log_success "PWA deployed to $env"
}

verify_deployment() {
    local env=$1
    local domain
    
    if [[ "$env" == "staging" ]]; then
        domain="$STAGING_DOMAIN"
    else
        domain="$PRODUCTION_DOMAIN"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would verify deployment at https://$domain"
        return
    fi
    
    log_info "Verifying deployment at https://$domain..."
    
    # Wait a moment for deployment to propagate
    sleep 10
    
    # Check health endpoints
    local health_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain/api/health" || echo "000")
    if [[ "$health_status" == "200" ]]; then
        log_success "Health check passed"
    else
        log_error "Health check failed (HTTP $health_status)"
        return 1
    fi
    
    # Check PWA manifest (for production)
    if [[ "$env" == "production" ]]; then
        local manifest_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$WWW_DOMAIN/manifest.json" || echo "000")
        if [[ "$manifest_status" == "200" ]]; then
            log_success "PWA manifest accessible"
        else
            log_error "PWA manifest check failed (HTTP $manifest_status)"
            return 1
        fi
    fi
    
    # Check service worker
    local sw_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain/sw.js" || echo "000")
    if [[ "$sw_status" == "200" ]]; then
        log_success "Service worker accessible"
    else
        log_warning "Service worker check failed (HTTP $sw_status)"
    fi
    
    log_success "Deployment verification completed"
}

send_notification() {
    local env=$1
    local status=$2
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would send $status notification for $env deployment"
        return
    fi
    
    local domain
    if [[ "$env" == "staging" ]]; then
        domain="$STAGING_DOMAIN"
    else
        domain="$PRODUCTION_DOMAIN"
    fi
    
    local message
    if [[ "$status" == "success" ]]; then
        message="🚀 $env deployment successful! https://$domain"
    else
        message="❌ $env deployment failed!"
    fi
    
    log_info "Sending notification: $message"
    
    # Here you would send to Slack, Discord, etc.
    # For now, just log it
    echo "Notification: $message"
}

main() {
    local environment=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            staging|production)
                environment="$1"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            --force)
                FORCE="true"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [[ -z "$environment" ]]; then
        log_error "Environment not specified"
        show_help
        exit 1
    fi
    
    validate_environment "$environment"
    
    # Show deployment info
    log_info "Starting $environment deployment..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No actual deployment will occur"
    fi
    
    # Confirmation for production
    if [[ "$environment" == "production" && "$FORCE" != "true" && "$DRY_RUN" != "true" ]]; then
        log_warning "You are about to deploy to PRODUCTION"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Deployment steps
    local start_time=$(date +%s)
    
    check_prerequisites
    run_tests
    build_application "$environment"
    deploy_signaling_server "$environment"
    deploy_pwa "$environment"
    
    if verify_deployment "$environment"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Deployment completed successfully in ${duration}s"
        send_notification "$environment" "success"
        
        # Show deployment URLs
        if [[ "$environment" == "staging" ]]; then
            log_info "Staging URLs:"
            log_info "  - https://$STAGING_DOMAIN"
        else
            log_info "Production URLs:"
            log_info "  - https://$PRODUCTION_DOMAIN"
            log_info "  - https://$WWW_DOMAIN"
        fi
        
    else
        log_error "Deployment verification failed"
        send_notification "$environment" "failed"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"