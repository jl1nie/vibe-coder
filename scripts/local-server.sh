#!/bin/bash

# 🖥️ Vibe Coder Local Server Management Script
# ローカル開発環境の簡易起動・管理

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
LOGS_DIR="$PROJECT_ROOT/logs"
PIDS_DIR="$PROJECT_ROOT/.pids"

# Service Configuration
SERVICES=(
    "host:3001:packages/host:npm run dev"
    "signaling:3000:packages/signaling:npm run dev" 
    "pwa:5173:apps/web:npm run dev"
    "mock:4173:test:npm run test:ux-suite"
)

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

log_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

show_help() {
    cat << EOF
${PURPLE}🖥️ Vibe Coder Local Server Management${NC}

${CYAN}USAGE:${NC}
    $0 [COMMAND] [OPTIONS]

${CYAN}COMMANDS:${NC}
    start [SERVICE]     Start all services or specific service
    stop [SERVICE]      Stop all services or specific service  
    restart [SERVICE]   Restart all services or specific service
    status              Show status of all services
    logs [SERVICE]      Show logs for all services or specific service
    clean               Clean up logs and PID files
    setup               Setup local development environment
    test                Run UX test against local servers
    help                Show this help message

${CYAN}SERVICES:${NC}
    host                Host Server (Claude Code integration)
    signaling           Signaling Server (WebRTC coordination)
    pwa                 PWA Frontend (React app)
    mock                Mock Server (for testing)

${CYAN}OPTIONS:${NC}
    -v, --verbose       Verbose output
    -b, --background    Run in background
    -f, --foreground    Run in foreground (default for start)
    -t, --timeout SEC   Timeout for operations (default: 30)
    --no-logs           Don't show logs
    --port PORT         Override default port

${CYAN}EXAMPLES:${NC}
    $0 start                    # Start all services
    $0 start pwa                # Start only PWA
    $0 stop                     # Stop all services
    $0 status                   # Show service status
    $0 logs host                # Show host server logs
    $0 restart signaling        # Restart signaling server
    $0 test                     # Run UX tests against local

${CYAN}DEVELOPMENT WORKFLOW:${NC}
    1. $0 setup                 # Initial setup
    2. $0 start                 # Start all services
    3. $0 test                  # Run tests
    4. $0 logs                  # Check logs
    5. $0 stop                  # Stop when done

${CYAN}URLs:${NC}
    PWA:              http://localhost:5173
    Host Server:      http://localhost:3001
    Signaling Server: http://localhost:3000
    Mock Server:      http://localhost:4173
EOF
}

setup_directories() {
    mkdir -p "$LOGS_DIR" "$PIDS_DIR"
    log_success "Created directories: logs, .pids"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("node" "npm" "git")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is not installed"
            return 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo "$node_version" | cut -d'.' -f1)
    if [[ $major_version -lt 20 ]]; then
        log_error "Node.js version 20+ required, found: $node_version"
        return 1
    fi
    
    log_success "Dependencies check passed"
}

install_packages() {
    log_info "Installing packages..."
    
    cd "$PROJECT_ROOT"
    
    if [[ -f "pnpm-workspace.yaml" ]] && command -v pnpm &> /dev/null; then
        log_info "Using pnpm workspace..."
        pnpm install
    else
        log_info "Using npm..."
        npm install
    fi
    
    log_success "Packages installed"
}

setup_env() {
    log_info "Setting up environment..."
    
    cd "$PROJECT_ROOT"
    
    if [[ ! -f ".env.local" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env.local
            log_success "Created .env.local from .env.example"
            log_warning "Please edit .env.local with your actual values"
        else
            log_warning ".env.example not found, skipping env setup"
        fi
    else
        log_info ".env.local already exists"
    fi
}

get_service_config() {
    local service_name="$1"
    
    for service in "${SERVICES[@]}"; do
        local name=$(echo "$service" | cut -d: -f1)
        if [[ "$name" == "$service_name" ]]; then
            echo "$service"
            return 0
        fi
    done
    
    return 1
}

get_service_pid() {
    local service_name="$1"
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    if [[ -f "$pid_file" ]]; then
        cat "$pid_file"
    fi
}

is_service_running() {
    local service_name="$1"
    local pid=$(get_service_pid "$service_name")
    
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

wait_for_service() {
    local service_name="$1"
    local port="$2"
    local timeout="${3:-30}"
    
    log_info "Waiting for $service_name on port $port..."
    
    local count=0
    while [[ $count -lt $timeout ]]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            log_success "$service_name is ready on port $port"
            return 0
        fi
        
        sleep 1
        count=$((count + 1))
        
        if [[ $((count % 5)) -eq 0 ]]; then
            log_info "Still waiting for $service_name... ($count/$timeout)"
        fi
    done
    
    log_error "$service_name failed to start within ${timeout}s"
    return 1
}

start_service() {
    local service_name="$1"
    local config=$(get_service_config "$service_name")
    
    if [[ -z "$config" ]]; then
        log_error "Unknown service: $service_name"
        return 1
    fi
    
    if is_service_running "$service_name"; then
        log_warning "$service_name is already running"
        return 0
    fi
    
    local port=$(echo "$config" | cut -d: -f2)
    local directory=$(echo "$config" | cut -d: -f3)
    local command=$(echo "$config" | cut -d: -f4-)
    
    local service_dir="$PROJECT_ROOT/$directory"
    local log_file="$LOGS_DIR/$service_name.log"
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    log_info "Starting $service_name on port $port..."
    log_info "Directory: $service_dir"
    log_info "Command: $command"
    
    if [[ ! -d "$service_dir" ]]; then
        log_error "Service directory not found: $service_dir"
        return 1
    fi
    
    cd "$service_dir"
    
    # Start service in background
    if [[ "$BACKGROUND" == "true" ]]; then
        nohup $command > "$log_file" 2>&1 &
        local pid=$!
        echo $pid > "$pid_file"
        
        log_success "Started $service_name (PID: $pid)"
        
        # Wait for service to be ready
        if ! wait_for_service "$service_name" "$port" "$TIMEOUT"; then
            stop_service "$service_name"
            return 1
        fi
    else
        log_info "Running $service_name in foreground..."
        log_info "Press Ctrl+C to stop"
        exec $command
    fi
}

stop_service() {
    local service_name="$1"
    local pid=$(get_service_pid "$service_name")
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    if [[ -z "$pid" ]]; then
        log_warning "$service_name is not running"
        return 0
    fi
    
    log_info "Stopping $service_name (PID: $pid)..."
    
    # Graceful shutdown
    if kill -TERM "$pid" 2>/dev/null; then
        local count=0
        while [[ $count -lt 10 ]] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Force killing $service_name..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
    
    # Clean up PID file
    rm -f "$pid_file"
    
    log_success "Stopped $service_name"
}

show_status() {
    log_header "Service Status"
    echo
    
    printf "%-12s %-8s %-8s %-20s %-s\n" "SERVICE" "STATUS" "PID" "PORT" "URL"
    printf "%-12s %-8s %-8s %-20s %-s\n" "--------" "------" "---" "----" "---"
    
    for service in "${SERVICES[@]}"; do
        local name=$(echo "$service" | cut -d: -f1)
        local port=$(echo "$service" | cut -d: -f2)
        local pid=$(get_service_pid "$name")
        
        if is_service_running "$name"; then
            local status="${GREEN}RUNNING${NC}"
            local url="http://localhost:$port"
        else
            local status="${RED}STOPPED${NC}"
            local url="-"
            pid="-"
        fi
        
        printf "%-12s %-16s %-8s %-20s %-s\n" "$name" "$status" "$pid" "$port" "$url"
    done
    
    echo
}

show_logs() {
    local service_name="$1"
    
    if [[ -n "$service_name" ]]; then
        local log_file="$LOGS_DIR/$service_name.log"
        if [[ -f "$log_file" ]]; then
            log_info "Showing logs for $service_name..."
            tail -f "$log_file"
        else
            log_error "Log file not found: $log_file"
        fi
    else
        log_info "Showing logs for all services..."
        for service in "${SERVICES[@]}"; do
            local name=$(echo "$service" | cut -d: -f1)
            local log_file="$LOGS_DIR/$name.log"
            
            if [[ -f "$log_file" ]]; then
                echo -e "\n${CYAN}=== $name ===${NC}"
                tail -n 20 "$log_file"
            fi
        done
    fi
}

run_tests() {
    log_header "Running UX Tests against Local Servers"
    
    # Check if services are running
    local required_services=("pwa" "signaling")
    for service in "${required_services[@]}"; do
        if ! is_service_running "$service"; then
            log_error "$service is not running. Please start it first."
            return 1
        fi
    done
    
    cd "$PROJECT_ROOT"
    
    log_info "Running UX test suite..."
    if npm run test:ux-suite; then
        log_success "UX tests passed!"
    else
        log_error "UX tests failed!"
        return 1
    fi
}

clean_up() {
    log_info "Cleaning up logs and PID files..."
    
    # Stop all services first
    for service in "${SERVICES[@]}"; do
        local name=$(echo "$service" | cut -d: -f1)
        if is_service_running "$name"; then
            stop_service "$name"
        fi
    done
    
    # Clean up files
    rm -rf "$LOGS_DIR"/* "$PIDS_DIR"/*
    
    log_success "Cleanup completed"
}

setup_local_env() {
    log_header "Setting up Local Development Environment"
    
    setup_directories
    check_dependencies
    install_packages
    setup_env
    
    log_success "Local environment setup completed!"
    log_info "Next steps:"
    log_info "  1. Edit .env.local with your configuration"
    log_info "  2. Run: $0 start"
    log_info "  3. Run: $0 test"
}

main() {
    local command="$1"
    local service="$2"
    
    # Set defaults
    BACKGROUND="${BACKGROUND:-true}"
    TIMEOUT="${TIMEOUT:-30}"
    VERBOSE="${VERBOSE:-false}"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE="true"
                shift
                ;;
            -b|--background)
                BACKGROUND="true"
                shift
                ;;
            -f|--foreground)
                BACKGROUND="false"
                shift
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --no-logs)
                NO_LOGS="true"
                shift
                ;;
            --port)
                OVERRIDE_PORT="$2"
                shift 2
                ;;
            *)
                if [[ -z "$command" ]]; then
                    command="$1"
                elif [[ -z "$service" ]]; then
                    service="$1"
                fi
                shift
                ;;
        esac
    done
    
    # Ensure directories exist
    setup_directories
    
    case "$command" in
        start)
            if [[ -n "$service" ]]; then
                start_service "$service"
            else
                log_header "Starting All Services"
                for svc in "${SERVICES[@]}"; do
                    local name=$(echo "$svc" | cut -d: -f1)
                    start_service "$name" || true
                done
                
                if [[ "$NO_LOGS" != "true" && "$BACKGROUND" == "true" ]]; then
                    echo
                    show_status
                    echo
                    log_info "All services started. Use '$0 logs' to view logs"
                    log_info "Use '$0 stop' to stop all services"
                fi
            fi
            ;;
        stop)
            if [[ -n "$service" ]]; then
                stop_service "$service"
            else
                log_header "Stopping All Services"
                for svc in "${SERVICES[@]}"; do
                    local name=$(echo "$svc" | cut -d: -f1)
                    stop_service "$name"
                done
            fi
            ;;
        restart)
            if [[ -n "$service" ]]; then
                stop_service "$service"
                sleep 2
                start_service "$service"
            else
                log_header "Restarting All Services"
                for svc in "${SERVICES[@]}"; do
                    local name=$(echo "$svc" | cut -d: -f1)
                    stop_service "$name"
                done
                sleep 2
                for svc in "${SERVICES[@]}"; do
                    local name=$(echo "$svc" | cut -d: -f1)
                    start_service "$name"
                done
            fi
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$service"
            ;;
        test)
            run_tests
            ;;
        clean)
            clean_up
            ;;
        setup)
            setup_local_env
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Handle Ctrl+C gracefully
trap 'echo; log_warning "Interrupted! Stopping services..."; clean_up; exit 1' INT

# Run main function with all arguments
main "$@"