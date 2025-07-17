import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebRTCService } from '../services/webrtc-service';
import { SessionManager } from '../services/session-manager';

// Mock @roamhq/wrtc
vi.mock('@roamhq/wrtc', () => ({
  RTCPeerConnection: vi.fn().mockImplementation(() => ({
    createOffer: vi.fn(),
    createAnswer: vi.fn(),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    createDataChannel: vi.fn(),
    close: vi.fn(),
    iceConnectionState: 'new',
    signalingState: 'stable',
    connectionState: 'new',
    onicecandidate: null,
    oniceconnectionstatechange: null,
    onsignalingstatechange: null,
    ondatachannel: null,
    onconnectionstatechange: null,
  })),
}));

// Mock ClaudeInteractiveService
vi.mock('../services/claude-interactive-service', () => ({
  ClaudeInteractiveService: vi.fn().mockImplementation(() => ({
    createSession: vi.fn(),
    getSession: vi.fn(),
    sendCommand: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock WebSocket
vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('WebRTCService', () => {
  let webrtcService: WebRTCService;
  let mockSessionManager: any;

  beforeEach(() => {
    mockSessionManager = {
      onAuthentication: vi.fn(),
      getHostId: vi.fn().mockReturnValue('12345678'),
      getAuthenticatedSessions: vi.fn().mockReturnValue(['session1', 'session2']),
    };

    webrtcService = new WebRTCService(mockSessionManager);
    vi.clearAllMocks();
  });

  describe('createConnection', () => {
    it('should create new WebRTC connection', async () => {
      const sessionId = 'test-session';
      
      const connection = await webrtcService.createConnection(sessionId);
      
      expect(connection).toBeDefined();
      expect(connection.sessionId).toBe(sessionId);
      expect(connection.id).toMatch(/^test-session-\d+$/);
      expect(connection.isConnected).toBe(false);
      expect(connection.createdAt).toBeInstanceOf(Date);
      expect(connection.lastActivity).toBeInstanceOf(Date);
    });

    it('should generate unique connection IDs', async () => {
      const sessionId = 'test-session';
      
      const connection1 = await webrtcService.createConnection(sessionId);
      const connection2 = await webrtcService.createConnection(sessionId);
      
      expect(connection1.id).not.toBe(connection2.id);
    });

    it('should store the connection', async () => {
      const sessionId = 'test-session';
      
      const connection = await webrtcService.createConnection(sessionId);
      const storedConnection = webrtcService.getConnection(connection.id);
      
      expect(storedConnection).toBe(connection);
    });

    it('should log connection creation', async () => {
      const logger = await import('../utils/logger');
      const sessionId = 'test-session';
      
      await webrtcService.createConnection(sessionId);
      
      expect(logger.default.info).toHaveBeenCalledWith(
        'WebRTC connection created',
        expect.objectContaining({
          sessionId,
          connectionId: expect.any(String),
        })
      );
    });
  });

  describe('getConnection', () => {
    it('should return existing connection', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      const retrieved = webrtcService.getConnection(connection.id);
      
      expect(retrieved).toBe(connection);
    });

    it('should return null for non-existent connection', () => {
      const retrieved = webrtcService.getConnection('non-existent');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('getConnectionBySessionId', () => {
    it('should return connection by session ID', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      const retrieved = webrtcService.getConnectionBySessionId(sessionId);
      
      expect(retrieved).toBe(connection);
    });

    it('should return null for non-existent session', () => {
      const retrieved = webrtcService.getConnectionBySessionId('non-existent');
      
      expect(retrieved).toBeNull();
    });

    it('should return most recent connection for session', async () => {
      const sessionId = 'test-session';
      const connection1 = await webrtcService.createConnection(sessionId);
      
      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const connection2 = await webrtcService.createConnection(sessionId);
      
      const retrieved = webrtcService.getConnectionBySessionId(sessionId);
      
      expect(retrieved).toBe(connection2);
    });
  });

  describe('getConnections', () => {
    it('should return all connections', async () => {
      const connection1 = await webrtcService.createConnection('session-1');
      const connection2 = await webrtcService.createConnection('session-2');
      
      const connections = webrtcService.getConnections();
      
      expect(connections).toHaveLength(2);
      expect(connections).toContain(connection1);
      expect(connections).toContain(connection2);
    });

    it('should return empty array when no connections exist', () => {
      const connections = webrtcService.getConnections();
      
      expect(connections).toHaveLength(0);
    });
  });

  describe('removeConnection', () => {
    it('should remove existing connection', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      const removed = webrtcService.removeConnection(connection.id);
      
      expect(removed).toBe(true);
      expect(webrtcService.getConnection(connection.id)).toBeNull();
    });

    it('should return false for non-existent connection', () => {
      const removed = webrtcService.removeConnection('non-existent');
      
      expect(removed).toBe(false);
    });

    it('should clean up peer connection', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      // Mock peer with destroy method
      const mockPeer = { destroy: vi.fn() };
      (connection as any).peer = mockPeer;
      
      webrtcService.removeConnection(connection.id);
      
      expect(mockPeer.destroy).toHaveBeenCalled();
    });

    it('should log connection removal', async () => {
      const logger = await import('../utils/logger');
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      webrtcService.removeConnection(connection.id);
      
      expect(logger.default.info).toHaveBeenCalledWith(
        'WebRTC connection removed',
        expect.objectContaining({
          connectionId: connection.id,
          sessionId: sessionId,
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('should send message to connected peer', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      // Mock connected peer
      const mockPeer = {
        connected: true,
        send: vi.fn(),
      };
      (connection as any).peer = mockPeer;
      connection.isConnected = true;
      
      const message = { type: 'test', data: 'hello' };
      const sent = webrtcService.sendMessage(connection.id, message);
      
      expect(sent).toBe(true);
      expect(mockPeer.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send message to disconnected peer', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      // Mock disconnected peer
      const mockPeer = {
        connected: false,
        send: vi.fn(),
      };
      (connection as any).peer = mockPeer;
      connection.isConnected = false;
      
      const message = { type: 'test', data: 'hello' };
      const sent = webrtcService.sendMessage(connection.id, message);
      
      expect(sent).toBe(false);
      expect(mockPeer.send).not.toHaveBeenCalled();
    });

    it('should return false for non-existent connection', () => {
      const message = { type: 'test', data: 'hello' };
      const sent = webrtcService.sendMessage('non-existent', message);
      
      expect(sent).toBe(false);
    });

    it('should handle send errors gracefully', async () => {
      const logger = await import('../utils/logger');
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      // Mock peer that throws on send
      const mockPeer = {
        connected: true,
        send: vi.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
      };
      (connection as any).peer = mockPeer;
      connection.isConnected = true;
      
      const message = { type: 'test', data: 'hello' };
      const sent = webrtcService.sendMessage(connection.id, message);
      
      expect(sent).toBe(false);
      expect(logger.default.error).toHaveBeenCalledWith(
        'Failed to send WebRTC message',
        expect.objectContaining({
          connectionId: connection.id,
          error: 'Send failed',
        })
      );
    });
  });

  describe('updateLastActivity', () => {
    it('should update connection last activity', async () => {
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      const originalActivity = connection.lastActivity;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      webrtcService.updateLastActivity(connection.id);
      
      expect(connection.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    it('should not throw for non-existent connection', () => {
      expect(() => {
        webrtcService.updateLastActivity('non-existent');
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove inactive connections', async () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      const connection1 = await webrtcService.createConnection(sessionId1);
      const connection2 = await webrtcService.createConnection(sessionId2);
      
      // Make connection1 inactive (older than threshold)
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      connection1.lastActivity = oldTime;
      
      webrtcService.cleanup();
      
      expect(webrtcService.getConnection(connection1.id)).toBeNull();
      expect(webrtcService.getConnection(connection2.id)).toBeDefined();
    });

    it('should log cleanup activity', async () => {
      const logger = await import('../utils/logger');
      const sessionId = 'test-session';
      const connection = await webrtcService.createConnection(sessionId);
      
      // Make connection inactive
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      connection.lastActivity = oldTime;
      
      webrtcService.cleanup();
      
      expect(logger.default.info).toHaveBeenCalledWith(
        'WebRTC cleanup completed',
        expect.objectContaining({
          removedConnections: 1,
          totalConnections: 0,
        })
      );
    });
  });
});