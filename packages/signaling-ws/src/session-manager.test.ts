import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from './session-manager';
import { SignalingServerConfig, ClientConnection } from './types';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let config: SignalingServerConfig;
  let mockWebSocket: any;

  beforeEach(() => {
    config = {
      port: 5175,
      host: '127.0.0.1',
      heartbeatInterval: 1000,
      sessionTimeout: 10000,
      clientTimeout: 5000,
      corsOrigins: ['http://localhost:3000']
    };

    sessionManager = new SessionManager(config);

    // Mock WebSocket for testing
    mockWebSocket = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      close: vi.fn(),
    };
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const sessionId = 'test-session-123';
      const hostId = 'test-host-456';

      const session = sessionManager.createSession(sessionId, hostId);

      expect(session).toEqual({
        sessionId,
        hostId,
        clients: new Set(),
        offers: new Map(),
        answers: new Map(),
        candidates: new Map(),
        createdAt: expect.any(Number),
        lastActivity: expect.any(Number),
      });

      expect(sessionManager.getSession(sessionId)).toBe(session);
    });

    it('should update session activity timestamp', async () => {
      const sessionId = 'test-session-123';
      const hostId = 'test-host-456';

      const session = sessionManager.createSession(sessionId, hostId);
      const originalActivity = session.lastActivity;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      sessionManager.updateSessionActivity(sessionId);
      
      const updatedSession = sessionManager.getSession(sessionId);
      expect(updatedSession!.lastActivity).toBeGreaterThan(originalActivity);
    });

    it('should handle non-existent session gracefully', () => {
      const result = sessionManager.getSession('non-existent');
      expect(result).toBeUndefined();
    });

    it('should join client to session', () => {
      const sessionId = 'test-session-123';
      const hostId = 'test-host-456';
      const clientId = 'client-789';

      sessionManager.createSession(sessionId, hostId);
      const result = sessionManager.joinSession(sessionId, clientId);

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.clients.has(clientId)).toBe(true);
    });

    it('should fail to join non-existent session', () => {
      const result = sessionManager.joinSession('non-existent', 'client-123');
      expect(result).toBe(false);
    });

    it('should remove client from session', () => {
      const sessionId = 'test-session-123';
      const hostId = 'test-host-456';
      const clientId = 'client-789';

      sessionManager.createSession(sessionId, hostId);
      sessionManager.joinSession(sessionId, clientId);

      sessionManager.leaveSession(sessionId, clientId);

      // Session should be removed when last client leaves
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeUndefined();
    });

    it('should remove session when last client leaves', () => {
      const sessionId = 'test-session-123';
      const hostId = 'test-host-456';
      const clientId = 'client-789';

      sessionManager.createSession(sessionId, hostId);
      sessionManager.joinSession(sessionId, clientId);

      sessionManager.leaveSession(sessionId, clientId);

      const session = sessionManager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  describe('WebRTC Offer/Answer Management', () => {
    let sessionId: string;
    let clientId: string;

    beforeEach(() => {
      sessionId = 'test-session-123';
      clientId = 'client-789';
      sessionManager.createSession(sessionId, 'host-456');
      sessionManager.joinSession(sessionId, clientId);
    });

    it('should store and retrieve offers', () => {
      const offer = {
        type: 'offer' as RTCSdpType,
        sdp: 'test-offer-sdp'
      };

      const result = sessionManager.storeOffer(sessionId, clientId, offer);
      expect(result).toBe(true);

      const retrievedOffer = sessionManager.getOffer(sessionId, clientId);
      expect(retrievedOffer).toEqual(offer);
    });

    it('should store and retrieve answers', () => {
      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: 'test-answer-sdp'
      };

      const result = sessionManager.storeAnswer(sessionId, clientId, answer);
      expect(result).toBe(true);

      const retrievedAnswer = sessionManager.getAnswer(sessionId, clientId);
      expect(retrievedAnswer).toEqual(answer);
    });

    it('should fail to store offer for non-existent session', () => {
      const offer = {
        type: 'offer' as RTCSdpType,
        sdp: 'test-offer-sdp'
      };

      const result = sessionManager.storeOffer('non-existent', clientId, offer);
      expect(result).toBe(false);
    });

    it('should store and retrieve ICE candidates', () => {
      const candidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: 'data'
      };

      const result = sessionManager.storeCandidate(sessionId, clientId, candidate);
      expect(result).toBe(true);

      const candidates = sessionManager.getCandidatesForClient(sessionId, 'other-client');
      expect(candidates).toContain(candidate);
    });

    it('should exclude own candidates when retrieving for client', () => {
      const candidate1 = {
        candidate: 'test-candidate-1',
        sdpMLineIndex: 0,
        sdpMid: 'data'
      };

      const candidate2 = {
        candidate: 'test-candidate-2',
        sdpMLineIndex: 0,
        sdpMid: 'data'
      };

      sessionManager.storeCandidate(sessionId, clientId, candidate1);
      sessionManager.storeCandidate(sessionId, 'other-client', candidate2);

      const candidates = sessionManager.getCandidatesForClient(sessionId, clientId);
      expect(candidates).toContain(candidate2);
      expect(candidates).not.toContain(candidate1);
    });
  });

  describe('Client Connection Management', () => {
    it('should register client connection', () => {
      const clientId = 'client-123';
      const isHost = true;

      sessionManager.registerClient(clientId, mockWebSocket, isHost);

      const client = sessionManager.getClient(clientId);
      expect(client).toEqual({
        clientId,
        isHost,
        ws: mockWebSocket,
        lastPing: expect.any(Number),
        connectedAt: expect.any(Number),
      });
    });

    it('should update client session', () => {
      const clientId = 'client-123';
      const sessionId = 'session-456';

      sessionManager.registerClient(clientId, mockWebSocket, false);
      sessionManager.updateClientSession(clientId, sessionId);

      const client = sessionManager.getClient(clientId);
      expect(client!.sessionId).toBe(sessionId);
    });

    it('should update client ping timestamp', async () => {
      const clientId = 'client-123';

      sessionManager.registerClient(clientId, mockWebSocket, false);
      const originalPing = sessionManager.getClient(clientId)!.lastPing;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      sessionManager.updateClientPing(clientId);
      
      const client = sessionManager.getClient(clientId);
      expect(client!.lastPing).toBeGreaterThan(originalPing);
    });

    it('should unregister client and remove from session', () => {
      const clientId = 'client-123';
      const sessionId = 'session-456';

      sessionManager.createSession(sessionId, 'host-789');
      sessionManager.registerClient(clientId, mockWebSocket, false);
      sessionManager.updateClientSession(clientId, sessionId);
      sessionManager.joinSession(sessionId, clientId);

      sessionManager.unregisterClient(clientId);

      expect(sessionManager.getClient(clientId)).toBeUndefined();
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeUndefined(); // Session removed when last client leaves
    });

    it('should get all clients in session', () => {
      const sessionId = 'session-456';
      const client1Id = 'client-1';
      const client2Id = 'client-2';

      sessionManager.createSession(sessionId, 'host-789');
      
      sessionManager.registerClient(client1Id, mockWebSocket, false);
      sessionManager.registerClient(client2Id, mockWebSocket, false);
      
      sessionManager.updateClientSession(client1Id, sessionId);
      sessionManager.updateClientSession(client2Id, sessionId);

      const clients = sessionManager.getClientsInSession(sessionId);
      expect(clients).toHaveLength(2);
      expect(clients.map(c => c.clientId)).toContain(client1Id);
      expect(clients.map(c => c.clientId)).toContain(client2Id);
    });
  });

  describe('Message Broadcasting', () => {
    let sessionId: string;
    let client1Id: string;
    let client2Id: string;
    let mockWs1: any;
    let mockWs2: any;

    beforeEach(() => {
      sessionId = 'session-456';
      client1Id = 'client-1';
      client2Id = 'client-2';

      mockWs1 = {
        readyState: 1,
        send: vi.fn(),
      };

      mockWs2 = {
        readyState: 1,
        send: vi.fn(),
      };

      sessionManager.createSession(sessionId, 'host-789');
      sessionManager.registerClient(client1Id, mockWs1, false);
      sessionManager.registerClient(client2Id, mockWs2, false);
      sessionManager.updateClientSession(client1Id, sessionId);
      sessionManager.updateClientSession(client2Id, sessionId);
    });

    it('should send message to specific client', () => {
      const message = { type: 'test', data: 'hello' };

      const result = sessionManager.sendToClient(client1Id, message);

      expect(result).toBe(true);
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).not.toHaveBeenCalled();
    });

    it('should fail to send to disconnected client', () => {
      mockWs1.readyState = 3; // WebSocket.CLOSED

      const message = { type: 'test', data: 'hello' };
      const result = sessionManager.sendToClient(client1Id, message);

      expect(result).toBe(false);
      expect(mockWs1.send).not.toHaveBeenCalled();
    });

    it('should handle send error gracefully', () => {
      mockWs1.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      const message = { type: 'test', data: 'hello' };
      const result = sessionManager.sendToClient(client1Id, message);

      expect(result).toBe(false);
    });

    it('should broadcast to all clients in session', () => {
      const message = { type: 'broadcast', data: 'hello all' };

      sessionManager.broadcastToSession(sessionId, message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should broadcast to all clients except sender', () => {
      const message = { type: 'broadcast', data: 'hello others' };

      sessionManager.broadcastToSession(sessionId, message, client1Id);

      expect(mockWs1.send).not.toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate session and client statistics', () => {
      sessionManager.createSession('session-1', 'host-1');
      sessionManager.createSession('session-2', 'host-2');
      
      sessionManager.registerClient('client-1', mockWebSocket, false);
      sessionManager.registerClient('client-2', mockWebSocket, true);

      const stats = sessionManager.getStats();

      expect(stats.sessions).toBe(2);
      expect(stats.clients).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.activeClients).toBe(2);
    });

    it('should identify inactive sessions and clients', () => {
      // Create session and update activity to be older than timeout
      const sessionId = 'old-session';
      const session = sessionManager.createSession(sessionId, 'host-1');
      session.lastActivity = Date.now() - (config.sessionTimeout + 1000);

      // Register client with old ping
      const clientId = 'old-client';
      sessionManager.registerClient(clientId, mockWebSocket, false);
      const client = sessionManager.getClient(clientId)!;
      client.lastPing = Date.now() - (config.clientTimeout + 1000);

      const stats = sessionManager.getStats();

      expect(stats.sessions).toBe(1);
      expect(stats.clients).toBe(1);
      expect(stats.activeSessions).toBe(0);
      expect(stats.activeClients).toBe(0);
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should clean up expired sessions and clients', () => {
      // Create session with old activity
      const sessionId = 'old-session';
      const session = sessionManager.createSession(sessionId, 'host-1');
      session.lastActivity = Date.now() - (config.sessionTimeout + 1000);

      // Register client with old ping
      const clientId = 'old-client';
      sessionManager.registerClient(clientId, mockWebSocket, false);
      const client = sessionManager.getClient(clientId)!;
      client.lastPing = Date.now() - (config.clientTimeout + 1000);

      // Trigger cleanup manually (private method access for testing)
      (sessionManager as any).cleanup();

      expect(sessionManager.getSession(sessionId)).toBeUndefined();
      expect(sessionManager.getClient(clientId)).toBeUndefined();
    });

    it('should destroy all resources on destroy', () => {
      sessionManager.createSession('session-1', 'host-1');
      sessionManager.registerClient('client-1', mockWebSocket, false);

      sessionManager.destroy();

      const stats = sessionManager.getStats();
      expect(stats.sessions).toBe(0);
      expect(stats.clients).toBe(0);
    });
  });
});