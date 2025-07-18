import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebRTCService } from '../services/webrtc-service';
import { SessionManager } from '../services/session-manager';

// Mock dependencies
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../services/claude-interactive-service', () => ({
  ClaudeInteractiveService: vi.fn().mockImplementation(() => ({
    createSession: vi.fn(),
    getSession: vi.fn(),
    sendCommand: vi.fn(),
    getActiveSessions: vi.fn(() => []),
    destroy: vi.fn(),
  })),
}));

const mockWebSocket = {
  on: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => mockWebSocket),
}));

vi.mock('../utils/config', () => ({
  hostConfig: {
    signalingUrl: 'ws://localhost:5175',
    signalingWsPath: '/api/ws/signaling',
    signalingConnectionTimeout: 5000,
    signalingHeartbeatInterval: 30000,
    webrtcStunServers: ['stun:stun.l.google.com:19302'],
    webrtcTurnServers: [],
  },
}));

describe('WebRTC Service', () => {
  let webrtcService: WebRTCService;
  let mockSessionManager: any;

  beforeEach(() => {
    mockSessionManager = {
      getHostId: vi.fn(() => '12345678'),
      getSession: vi.fn(() => ({ sessionId: 'test-session', authenticated: true })),
      updateSessionActivity: vi.fn(),
      onAuthentication: vi.fn(),
      getAuthenticatedSessions: vi.fn(() => []),
      destroy: vi.fn(),
    };

    webrtcService = new WebRTCService(mockSessionManager);
    vi.clearAllMocks();
    
    // Reset WebSocket mock
    mockWebSocket.onopen = null;
    mockWebSocket.onclose = null;
    mockWebSocket.onerror = null;
    mockWebSocket.onmessage = null;
  });

  afterEach(() => {
    webrtcService?.destroy();
  });

  describe('Service Initialization', () => {
    it('should initialize with session manager', () => {
      expect(webrtcService).toBeDefined();
      expect(webrtcService instanceof WebRTCService).toBe(true);
    });

    it('should have destroy method', () => {
      expect(typeof webrtcService.destroy).toBe('function');
    });
  });

  describe('Connection Management', () => {
    it('should have cleanup method', () => {
      expect(typeof webrtcService.cleanupInactiveConnections).toBe('function');
    });

    it('should have status logging method', () => {
      expect(typeof webrtcService.logDetailedStatus).toBe('function');
    });

    it('should cleanup inactive connections without error', () => {
      expect(() => webrtcService.cleanupInactiveConnections()).not.toThrow();
    });

    it('should log detailed status without error', () => {
      expect(() => webrtcService.logDetailedStatus()).not.toThrow();
    });
  });

  describe('Service Lifecycle', () => {
    it('should handle initialization', async () => {
      const config = {
        signalingUrl: 'ws://localhost:5175',
        signalingWsPath: '/api/ws/signaling',
        signalingConnectionTimeout: 5000,
        signalingHeartbeatInterval: 30000,
        hostId: '12345678',
        webrtcStunServers: ['stun:stun.l.google.com:19302'],
        webrtcTurnServers: [],
      };
      
      // Mock WebSocket connection success
      setTimeout(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      }, 10);
      
      const result = await webrtcService.initializeSignaling(config);
      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('should handle destruction cleanly', () => {
      expect(() => webrtcService.destroy()).not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should be configurable with session manager', () => {
      const newService = new WebRTCService(mockSessionManager);
      expect(newService).toBeDefined();
      newService.destroy();
    });
  });
});