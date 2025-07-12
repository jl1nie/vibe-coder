# Host Package Test Suite

This directory contains comprehensive tests for the Vibe Coder Host server, focusing on WebSocket-based WebRTC signaling and Claude Code integration.

## Test Structure

### Core Service Tests
- **`claude-service.test.ts`** - Tests basic Claude Code execution and command handling
- **`claude-interactive.test.ts`** - Tests interactive Claude sessions and real-time communication
- **`session-manager.test.ts`** - Tests authentication, session management, and security

### WebRTC & Communication Tests
- **`webrtc-claude-integration.test.ts`** - Tests WebRTC data channel communication with Claude
- **`websocket-signaling-integration.test.ts`** - Tests WebSocket signaling functionality 
- **`e2e-websocket-signaling.test.ts`** - End-to-end tests with mock signaling server

### Integration Tests
- **`claude-integration.test.ts`** - High-level integration tests between components

## Testing Strategy

### Unit Tests (70%)
- Service layer logic (Claude, WebRTC, Session management)
- Configuration validation and error handling
- Mock all external dependencies (WebSocket, child processes, etc.)

### Integration Tests (20%)
- Component interaction (WebRTC ↔ Claude, Signaling ↔ WebRTC)
- WebSocket message flow and state management
- Authentication flow integration

### E2E Tests (10%)
- Full WebSocket signaling flow with mock server
- Real-time communication scenarios
- Connection lifecycle management

## Key Test Features

### WebSocket Signaling Tests
- ✅ Connection establishment and error handling
- ✅ Message routing (offer/answer/ICE candidates)
- ✅ Reconnection and connection recovery
- ✅ Multiple concurrent sessions
- ✅ Performance and latency testing

### Claude Integration Tests
- ✅ Data channel communication
- ✅ Command execution and output streaming
- ✅ Error handling and graceful degradation
- ✅ Concurrent command processing

### Security & Authentication Tests
- ✅ Session lifecycle management
- ✅ TOTP 2FA authentication
- ✅ JWT token validation
- ✅ Host ID persistence and validation

## Removed Obsolete Tests

The following REST API endpoints have been removed in favor of WebSocket signaling:
- `/api/webrtc/answer` - Now handled via WebSocket
- `/api/webrtc/ice-candidate` - Now handled via WebSocket  
- `/api/webrtc/signal` - Replaced by WebSocket signaling

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test claude-service.test.ts

# Run with coverage
pnpm test --coverage

# Run E2E tests only
pnpm test e2e-websocket-signaling.test.ts
```

## Test Configuration

Tests use Vitest with the following key mocks:
- `simple-peer` - WebRTC peer connection simulation
- `wrtc` - Node.js WebRTC implementation  
- `ws` - WebSocket library for signaling tests
- `child_process` - Claude Code execution

All tests are configured to run in isolated environments with proper cleanup and no external dependencies.