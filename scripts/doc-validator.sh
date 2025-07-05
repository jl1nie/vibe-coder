#!/bin/bash

# 📚 Documentation Validator Script
# ドキュメントの整合性チェックと自動更新

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
DOCS_DIR="$PROJECT_ROOT"
VALIDATION_RESULTS="$PROJECT_ROOT/.doc-validation-results.json"

# Document validation rules
DOCS_TO_VALIDATE=(
    "DEPLOYMENT_MANUAL.md:deployment"
    "CONFIG_DOCUMENTATION.md:configuration"
    "UX_TEST_SUMMARY.md:testing"
    ".env.example:environment"
    "package.json:scripts"
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

# Check if file exists and is readable
check_file_exists() {
    local file="$1"
    local file_path="$DOCS_DIR/$file"
    
    if [[ ! -f "$file_path" ]]; then
        log_error "File not found: $file"
        return 1
    fi
    
    if [[ ! -r "$file_path" ]]; then
        log_error "File not readable: $file"
        return 1
    fi
    
    return 0
}

# Check if documentation matches current code state
validate_deployment_manual() {
    local file="$DOCS_DIR/DEPLOYMENT_MANUAL.md"
    local issues=()
    
    log_info "Validating DEPLOYMENT_MANUAL.md..."
    
    # Check if mentioned scripts exist
    if ! grep -q "scripts/docker-build.sh" "$file"; then
        issues+=("Missing reference to docker-build.sh script")
    fi
    
    if [[ -f "$PROJECT_ROOT/scripts/docker-build.sh" ]] && ! grep -q "\./scripts/docker-build.sh" "$file"; then
        issues+=("Docker build script exists but not properly documented")
    fi
    
    # Check if package.json scripts are documented
    local npm_scripts=$(jq -r '.scripts | keys[]' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "")
    
    for script in $npm_scripts; do
        if [[ "$script" =~ ^(vibe-coder|terminal|preview-ux)$ ]] && ! grep -q "npm run $script" "$file"; then
            issues+=("npm script '$script' not documented in deployment manual")
        fi
    done
    
    # Check environment variables
    if [[ -f "$PROJECT_ROOT/.env.example" ]]; then
        local env_vars=$(grep -E "^[A-Z_]+=.*" "$PROJECT_ROOT/.env.example" | cut -d'=' -f1 | head -5)
        for var in $env_vars; do
            if ! grep -q "$var" "$file"; then
                issues+=("Environment variable '$var' not documented")
            fi
        done
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "DEPLOYMENT_MANUAL.md validation passed"
        return 0
    else
        log_warning "DEPLOYMENT_MANUAL.md validation issues found:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
        return 1
    fi
}

# Validate configuration documentation
validate_config_documentation() {
    local file="$DOCS_DIR/CONFIG_DOCUMENTATION.md"
    local issues=()
    
    log_info "Validating CONFIG_DOCUMENTATION.md..."
    
    # Check if all config files are documented
    local config_files=(
        "vitest.config.ts"
        "playwright.config.ts"
        "tsconfig.json"
        "package.json"
        ".env.example"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$config_file" ]] && ! grep -q "$config_file" "$file"; then
            issues+=("Config file '$config_file' exists but not documented")
        fi
    done
    
    # Check if npm scripts section is up to date
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        local scripts_count=$(jq -r '.scripts | length' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "0")
        if [[ $scripts_count -gt 10 ]] && ! grep -q "npm run" "$file"; then
            issues+=("Package.json has $scripts_count scripts but documentation may be incomplete")
        fi
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "CONFIG_DOCUMENTATION.md validation passed"
        return 0
    else
        log_warning "CONFIG_DOCUMENTATION.md validation issues found:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
        return 1
    fi
}

# Validate UX test documentation
validate_ux_test_summary() {
    local file="$DOCS_DIR/UX_TEST_SUMMARY.md"
    local issues=()
    
    log_info "Validating UX_TEST_SUMMARY.md..."
    
    # Check if test files exist
    local test_files=(
        "test/ux-test.spec.ts"
        "test/accessibility-audit.js"
        "test/lighthouse-ux.js"
        "test/preview-ux-test.js"
    )
    
    for test_file in "${test_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$test_file" ]] && ! grep -q "$test_file" "$file"; then
            issues+=("Test file '$test_file' exists but not documented")
        fi
    done
    
    # Check if npm test scripts are documented
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        local test_scripts=$(jq -r '.scripts | to_entries[] | select(.key | startswith("test")) | .key' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "")
        for script in $test_scripts; do
            if ! grep -q "npm run $script" "$file"; then
                issues+=("Test script '$script' not documented")
            fi
        done
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "UX_TEST_SUMMARY.md validation passed"
        return 0
    else
        log_warning "UX_TEST_SUMMARY.md validation issues found:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
        return 1
    fi
}

# Validate environment variables documentation
validate_env_documentation() {
    local env_file="$PROJECT_ROOT/.env.example"
    local issues=()
    
    log_info "Validating .env.example..."
    
    if [[ ! -f "$env_file" ]]; then
        issues+=(".env.example file not found")
        log_error ".env.example validation failed"
        return 1
    fi
    
    # Check for required environment variables
    local required_vars=(
        "CLAUDE_API_KEY"
        "GITHUB_TOKEN"
        "VERCEL_TOKEN"
        "PRODUCTION_DOMAIN"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file"; then
            issues+=("Required environment variable '$var' not found")
        fi
    done
    
    # Check for documentation comments
    local total_vars=$(grep -E "^[A-Z_]+=.*" "$env_file" | wc -l)
    local commented_sections=$(grep -E "^# =+" "$env_file" | wc -l)
    
    if [[ $commented_sections -lt 5 ]]; then
        issues+=("Environment variables should be organized into documented sections")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success ".env.example validation passed"
        return 0
    else
        log_warning ".env.example validation issues found:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
        return 1
    fi
}

# Validate package.json scripts documentation
validate_package_scripts() {
    local package_file="$PROJECT_ROOT/package.json"
    local issues=()
    
    log_info "Validating package.json scripts..."
    
    if [[ ! -f "$package_file" ]]; then
        issues+=("package.json file not found")
        log_error "package.json validation failed"
        return 1
    fi
    
    # Check for key scripts
    local key_scripts=(
        "vibe-coder"
        "terminal"
        "test"
        "build"
        "lint"
    )
    
    for script in "${key_scripts[@]}"; do
        if ! jq -e ".scripts[\"$script\"]" "$package_file" > /dev/null 2>&1; then
            issues+=("Key script '$script' not found in package.json")
        fi
    done
    
    # Check if all scripts have reasonable commands
    local empty_scripts=$(jq -r '.scripts | to_entries[] | select(.value == "" or .value == null) | .key' "$package_file" 2>/dev/null || echo "")
    for script in $empty_scripts; do
        issues+=("Script '$script' has empty command")
    done
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "package.json scripts validation passed"
        return 0
    else
        log_warning "package.json scripts validation issues found:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
        return 1
    fi
}

# Generate validation report
generate_validation_report() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local total_docs=${#DOCS_TO_VALIDATE[@]}
    local passed_docs=0
    local failed_docs=0
    
    log_info "Generating validation report..."
    
    # Run all validations
    local validation_results=()
    
    for doc_entry in "${DOCS_TO_VALIDATE[@]}"; do
        local doc_file=$(echo "$doc_entry" | cut -d':' -f1)
        local doc_type=$(echo "$doc_entry" | cut -d':' -f2)
        
        local result="{"
        result+="\"file\":\"$doc_file\","
        result+="\"type\":\"$doc_type\","
        result+="\"timestamp\":\"$timestamp\","
        
        if check_file_exists "$doc_file"; then
            case "$doc_type" in
                "deployment")
                    if validate_deployment_manual; then
                        result+="\"status\":\"passed\","
                        result+="\"issues\":[]"
                        passed_docs=$((passed_docs + 1))
                    else
                        result+="\"status\":\"failed\","
                        result+="\"issues\":[\"Validation issues found\"]"
                        failed_docs=$((failed_docs + 1))
                    fi
                    ;;
                "configuration")
                    if validate_config_documentation; then
                        result+="\"status\":\"passed\","
                        result+="\"issues\":[]"
                        passed_docs=$((passed_docs + 1))
                    else
                        result+="\"status\":\"failed\","
                        result+="\"issues\":[\"Validation issues found\"]"
                        failed_docs=$((failed_docs + 1))
                    fi
                    ;;
                "testing")
                    if validate_ux_test_summary; then
                        result+="\"status\":\"passed\","
                        result+="\"issues\":[]"
                        passed_docs=$((passed_docs + 1))
                    else
                        result+="\"status\":\"failed\","
                        result+="\"issues\":[\"Validation issues found\"]"
                        failed_docs=$((failed_docs + 1))
                    fi
                    ;;
                "environment")
                    if validate_env_documentation; then
                        result+="\"status\":\"passed\","
                        result+="\"issues\":[]"
                        passed_docs=$((passed_docs + 1))
                    else
                        result+="\"status\":\"failed\","
                        result+="\"issues\":[\"Validation issues found\"]"
                        failed_docs=$((failed_docs + 1))
                    fi
                    ;;
                "scripts")
                    if validate_package_scripts; then
                        result+="\"status\":\"passed\","
                        result+="\"issues\":[]"
                        passed_docs=$((passed_docs + 1))
                    else
                        result+="\"status\":\"failed\","
                        result+="\"issues\":[\"Validation issues found\"]"
                        failed_docs=$((failed_docs + 1))
                    fi
                    ;;
                *)
                    result+="\"status\":\"skipped\","
                    result+="\"issues\":[\"Unknown document type\"]"
                    ;;
            esac
        else
            result+="\"status\":\"error\","
            result+="\"issues\":[\"File not found or not readable\"]"
            failed_docs=$((failed_docs + 1))
        fi
        
        result+="}"
        validation_results+=("$result")
    done
    
    # Create JSON report
    local report="{"
    report+="\"timestamp\":\"$timestamp\","
    report+="\"summary\":{"
    report+="\"total\":$total_docs,"
    report+="\"passed\":$passed_docs,"
    report+="\"failed\":$failed_docs"
    report+="},"
    report+="\"results\":["
    
    local first=true
    for result in "${validation_results[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            report+=","
        fi
        report+="$result"
    done
    
    report+="]}"
    
    echo "$report" > "$VALIDATION_RESULTS"
    
    # Display summary
    echo
    log_info "📊 Validation Summary:"
    log_info "  Total documents: $total_docs"
    log_success "  Passed: $passed_docs"
    if [[ $failed_docs -gt 0 ]]; then
        log_error "  Failed: $failed_docs"
    else
        log_success "  Failed: $failed_docs"
    fi
    log_info "  Report saved: $VALIDATION_RESULTS"
    
    return $failed_docs
}

# Main function
main() {
    local command="${1:-validate}"
    
    case "$command" in
        "validate")
            log_info "🔍 Starting documentation validation..."
            generate_validation_report
            ;;
        "report")
            if [[ -f "$VALIDATION_RESULTS" ]]; then
                log_info "📊 Latest validation report:"
                cat "$VALIDATION_RESULTS" | jq .
            else
                log_error "No validation report found. Run 'validate' first."
                exit 1
            fi
            ;;
        "help")
            echo "📚 Documentation Validator"
            echo ""
            echo "Usage: $0 [COMMAND]"
            echo ""
            echo "Commands:"
            echo "  validate    Run documentation validation (default)"
            echo "  report      Show latest validation report"
            echo "  help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 validate"
            echo "  $0 report"
            ;;
        *)
            log_error "Unknown command: $command"
            echo "Use '$0 help' for usage information."
            exit 1
            ;;
    esac
}

# Run main function
main "$@"