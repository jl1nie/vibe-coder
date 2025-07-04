#!/bin/bash
set -e

echo "🚀 Starting Vibe Coder Host Server..."

# Display environment information
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Host: $HOST"
echo "Workspace: $WORKSPACE_DIR"
echo "Log Level: $LOG_LEVEL"

# Validate required environment variables
if [ -z "$CLAUDE_API_KEY" ]; then
    echo "⚠️  Warning: CLAUDE_API_KEY not set"
fi

# Check if workspace directory exists
if [ ! -d "$WORKSPACE_DIR" ]; then
    echo "Creating workspace directory: $WORKSPACE_DIR"
    mkdir -p "$WORKSPACE_DIR"
fi

# Check if logs directory exists
if [ ! -d "/app/logs" ]; then
    echo "Creating logs directory: /app/logs"
    mkdir -p "/app/logs"
fi

# Verify Claude Code CLI is available
if command -v claude-code &> /dev/null; then
    echo "✅ Claude Code CLI is available"
    claude-code --version
else
    echo "❌ Claude Code CLI not found"
    exit 1
fi

# Health check before starting
echo "Performing pre-startup health check..."

# Check if Node.js can run
if ! node --version &> /dev/null; then
    echo "❌ Node.js not available"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if the application files exist
if [ ! -f "/app/dist/index.js" ]; then
    echo "❌ Application files not found in /app/dist/"
    exit 1
fi

echo "✅ Application files found"

# Set up signal handlers for graceful shutdown
trap 'echo "Received SIGTERM, shutting down gracefully..."; kill -TERM $PID' TERM
trap 'echo "Received SIGINT, shutting down gracefully..."; kill -INT $PID' INT

# Start the application
echo "🎯 Starting Vibe Coder Host Server on $HOST:$PORT"
node dist/index.js &
PID=$!

# Wait for the process
wait $PID