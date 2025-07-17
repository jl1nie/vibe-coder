import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalingHandler } from './signaling-handler';
import { SessionManager } from './session-manager';
import { SignalingServerConfig } from './types';

describe('SignalingHandler', () => {
  let signalingHandler: SignalingHandler;
  let sessionManager: SessionManager;
  let config: SignalingServerConfig;
  let mockWebSocket: any;
  let clientId: string;

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
    signalingHandler = new SignalingHandler(sessionManager, config);

    // Mock WebSocket
    mockWebSocket = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };

    clientId = 'test-client-123';

    // Spy on sessionManager methods
    vi.spyOn(sessionManager, 'sendToClient');
    vi.spyOn(sessionManager, 'broadcastToSession');
    vi.spyOn(sessionManager, 'registerClient');
    vi.spyOn(sessionManager, 'createSession');
    vi.spyOn(sessionManager, 'joinSession');
    vi.spyOn(sessionManager, 'storeOffer');
    vi.spyOn(sessionManager, 'storeAnswer');
    vi.spyOn(sessionManager, 'storeCandidate');
    vi.spyOn(sessionManager, 'updateClientPing');
    vi.spyOn(sessionManager, 'unregisterClient');
    vi.spyOn(sessionManager, 'getStats');
    vi.spyOn(sessionManager, 'getClient');
  });

  afterEach(() => {
    sessionManager.destroy();
    vi.clearAllMocks();
  });

  describe('Message Parsing and Validation', () => {
    it('should handle invalid JSON gracefully', () => {
      const invalidMessage = '{ invalid json }';

      signalingHandler.handleMessage(clientId, invalidMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Invalid message format'
        })
      );
    });

    it('should handle unknown message type', () => {
      const unknownMessage = JSON.stringify({
        type: 'unknown-type',
        data: 'test'
      });

      signalingHandler.handleMessage(clientId, unknownMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Unknown message type: unknown-type'
        })
      );
    });
  });

  describe('Host Registration', () => {
    it('should register host successfully', () => {
      const registerMessage = JSON.stringify({
        type: 'register-host',
        sessionId: 'session-123',
        hostId: 'host-456',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, registerMessage, mockWebSocket);

      expect(sessionManager.registerClient).toHaveBeenCalledWith(clientId, mockWebSocket, true);
      expect(sessionManager.createSession).toHaveBeenCalledWith('session-123', 'host-456');
      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'host-registered',
          sessionId: 'session-123'
        })
      );
    });

    it('should handle host registration with missing sessionId', () => {
      const registerMessage = JSON.stringify({
        type: 'register-host',
        hostId: 'host-456',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, registerMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Missing sessionId or hostId for host registration'
        })
      );
    });

    it('should handle host registration with missing hostId', () => {
      const registerMessage = JSON.stringify({
        type: 'register-host',
        sessionId: 'session-123',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, registerMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Missing sessionId or hostId for host registration'
        })
      );
    });

    it('should reuse existing session for host registration', () => {
      // Create session first
      sessionManager.createSession('session-123', 'host-456');

      const registerMessage = JSON.stringify({
        type: 'register-host',
        sessionId: 'session-123',
        hostId: 'host-456',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, registerMessage, mockWebSocket);

      // Should not create a new session
      expect(sessionManager.createSession).toHaveBeenCalledTimes(1);
      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'host-registered',
          sessionId: 'session-123'
        })
      );
    });
  });

  describe('Session Join', () => {
    beforeEach(() => {
      // Create a session before testing joins
      sessionManager.createSession('session-123', 'host-456');
    });

    it('should join session successfully', () => {
      vi.mocked(sessionManager.joinSession).mockReturnValue(true);

      const joinMessage = JSON.stringify({
        type: 'join-session',
        sessionId: 'session-123',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, joinMessage, mockWebSocket);

      expect(sessionManager.registerClient).toHaveBeenCalledWith(clientId, mockWebSocket, false);
      expect(sessionManager.joinSession).toHaveBeenCalledWith('session-123', clientId);
      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'session-joined',
          sessionId: 'session-123',
          clientId
        })
      );
      expect(sessionManager.broadcastToSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          type: 'peer-connected',
          sessionId: 'session-123',
          clientId
        }),
        clientId
      );
    });

    it('should handle join with missing sessionId', () => {
      const joinMessage = JSON.stringify({
        type: 'join-session',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, joinMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Missing sessionId for session join'
        })
      );
    });

    it('should handle join to non-existent session', () => {
      vi.mocked(sessionManager.joinSession).mockReturnValue(false);

      const joinMessage = JSON.stringify({
        type: 'join-session',
        sessionId: 'non-existent',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, joinMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Session not found: non-existent'
        })
      );
    });
  });

  describe('WebRTC Offer Handling', () => {
    it('should handle offer successfully', () => {
      vi.mocked(sessionManager.storeOffer).mockReturnValue(true);

      const offer = {
        type: 'offer' as RTCSdpType,
        sdp: 'test-offer-sdp'
      };

      const offerMessage = JSON.stringify({
        type: 'offer',
        sessionId: 'session-123',
        offer,
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, offerMessage, mockWebSocket);

      expect(sessionManager.storeOffer).toHaveBeenCalledWith('session-123', clientId, offer);
      expect(sessionManager.broadcastToSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          type: 'offer-received',
          sessionId: 'session-123',
          clientId,
          offer
        }),
        clientId
      );
    });

    it('should handle offer with missing sessionId', () => {
      const offer = {
        type: 'offer' as RTCSdpType,
        sdp: 'test-offer-sdp'
      };

      const offerMessage = JSON.stringify({
        type: 'offer',
        offer,
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, offerMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Missing sessionId or offer'
        })
      );
    });

    it('should handle offer for non-existent session', () => {
      vi.mocked(sessionManager.storeOffer).mockReturnValue(false);

      const offer = {
        type: 'offer' as RTCSdpType,
        sdp: 'test-offer-sdp'
      };

      const offerMessage = JSON.stringify({
        type: 'offer',
        sessionId: 'non-existent',
        offer,
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, offerMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Session not found: non-existent'
        })
      );
    });
  });

  describe('WebRTC Answer Handling', () => {
    it('should handle answer successfully', () => {
      vi.mocked(sessionManager.storeAnswer).mockReturnValue(true);

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: 'test-answer-sdp'
      };

      const answerMessage = JSON.stringify({
        type: 'answer',
        sessionId: 'session-123',
        answer,
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, answerMessage, mockWebSocket);

      expect(sessionManager.storeAnswer).toHaveBeenCalledWith('session-123', clientId, answer);
      expect(sessionManager.broadcastToSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          type: 'answer-received',
          sessionId: 'session-123',
          clientId,
          answer
        }),
        clientId
      );
    });

    it('should handle answer with missing data', () => {
      const answerMessage = JSON.stringify({
        type: 'answer',
        sessionId: 'session-123',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, answerMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Missing sessionId or answer'
        })
      );
    });
  });

  describe('ICE Candidate Handling', () => {
    it('should handle ICE candidate successfully', () => {
      vi.mocked(sessionManager.storeCandidate).mockReturnValue(true);

      const candidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: 'data'
      };

      const candidateMessage = JSON.stringify({
        type: 'ice-candidate',
        sessionId: 'session-123',
        candidate,
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, candidateMessage, mockWebSocket);

      expect(sessionManager.storeCandidate).toHaveBeenCalledWith('session-123', clientId, candidate);
      expect(sessionManager.broadcastToSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          type: 'candidate-received',
          sessionId: 'session-123',
          clientId,
          candidate
        }),
        clientId
      );
    });

    it('should handle ICE candidate with missing data', () => {
      const candidateMessage = JSON.stringify({
        type: 'ice-candidate',
        sessionId: 'session-123',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, candidateMessage, mockWebSocket);

      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'error',
          error: 'Missing sessionId or candidate'
        })
      );
    });
  });

  describe('Heartbeat Handling', () => {
    it('should handle heartbeat and send acknowledgment', () => {
      const heartbeatMessage = JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      });

      signalingHandler.handleMessage(clientId, heartbeatMessage, mockWebSocket);

      expect(sessionManager.updateClientPing).toHaveBeenCalledWith(clientId);
      expect(sessionManager.sendToClient).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          type: 'heartbeat-ack'
        })
      );
    });
  });

  describe('Disconnection Handling', () => {
    it('should handle client disconnection and notify peers', () => {
      const mockClient = {
        clientId,
        sessionId: 'session-123',
        isHost: false,
        ws: mockWebSocket,
        lastPing: Date.now(),
        connectedAt: Date.now()
      };

      (sessionManager.getClient as any).mockReturnValue(mockClient);

      signalingHandler.handleDisconnection(clientId);

      expect(sessionManager.broadcastToSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          type: 'peer-disconnected',
          sessionId: 'session-123',
          clientId
        }),
        clientId
      );
      expect(sessionManager.unregisterClient).toHaveBeenCalledWith(clientId);
    });

    it('should handle disconnection of client without session', () => {
      const mockClient = {
        clientId,
        isHost: false,
        ws: mockWebSocket,
        lastPing: Date.now(),
        connectedAt: Date.now()
      };

      (sessionManager.getClient as any).mockReturnValue(mockClient);

      signalingHandler.handleDisconnection(clientId);

      expect(sessionManager.broadcastToSession).not.toHaveBeenCalled();
      expect(sessionManager.unregisterClient).toHaveBeenCalledWith(clientId);
    });

    it('should handle disconnection of non-existent client', () => {
      (sessionManager.getClient as any).mockReturnValue(undefined);

      signalingHandler.handleDisconnection(clientId);

      expect(sessionManager.broadcastToSession).not.toHaveBeenCalled();
      expect(sessionManager.unregisterClient).toHaveBeenCalledWith(clientId);
    });
  });

  describe('Statistics', () => {
    it('should provide signaling statistics', () => {
      const mockSessionStats = {
        sessions: 2,
        clients: 3,
        activeSessions: 1,
        activeClients: 2
      };

      (sessionManager.getStats as any).mockReturnValue(mockSessionStats);

      const stats = signalingHandler.getStats();

      expect(stats).toEqual({
        ...mockSessionStats,
        uptime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });
});