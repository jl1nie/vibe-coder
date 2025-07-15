import { describe, it, expect } from 'vitest';
import {
  SignalingServerConfig,
  SignalingSession,
  ClientConnection,
  SignalingMessage,
  RegisterHostMessage,
  JoinSessionMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  HeartbeatMessage,
  ErrorMessage,
  SuccessMessage
} from './types';

describe('Type Definitions', () => {
  describe('SignalingServerConfig', () => {
    it('should define valid config structure', () => {
      const config: SignalingServerConfig = {
        port: 5175,
        host: '127.0.0.1',
        heartbeatInterval: 1000,
        sessionTimeout: 10000,
        clientTimeout: 5000,
        corsOrigins: ['http://localhost:3000']
      };

      expect(config.port).toBe(5175);
      expect(config.host).toBe('127.0.0.1');
      expect(config.heartbeatInterval).toBe(1000);
      expect(config.sessionTimeout).toBe(10000);
      expect(config.clientTimeout).toBe(5000);
      expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    });

    it('should allow multiple CORS origins', () => {
      const config: SignalingServerConfig = {
        port: 5175,
        host: '127.0.0.1',
        heartbeatInterval: 1000,
        sessionTimeout: 10000,
        clientTimeout: 5000,
        corsOrigins: [
          'http://localhost:3000',
          'http://localhost:5174',
          'https://vibe-coder.space'
        ]
      };

      expect(config.corsOrigins).toHaveLength(3);
    });
  });

  describe('SignalingSession', () => {
    it('should define valid session structure', () => {
      const session: SignalingSession = {
        sessionId: 'session-123',
        hostId: 'host-456',
        clients: new Set(['client-1', 'client-2']),
        offers: new Map([
          ['client-1', { type: 'offer', sdp: 'offer-sdp' }]
        ]),
        answers: new Map([
          ['client-1', { type: 'answer', sdp: 'answer-sdp' }]
        ]),
        candidates: new Map([
          ['client-1', [{ candidate: 'test-candidate', sdpMLineIndex: 0 }]]
        ]),
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      expect(session.sessionId).toBe('session-123');
      expect(session.hostId).toBe('host-456');
      expect(session.clients.has('client-1')).toBe(true);
      expect(session.clients.has('client-2')).toBe(true);
      expect(session.offers.get('client-1')).toEqual({ type: 'offer', sdp: 'offer-sdp' });
      expect(session.answers.get('client-1')).toEqual({ type: 'answer', sdp: 'answer-sdp' });
      expect(session.candidates.get('client-1')).toHaveLength(1);
    });
  });

  describe('ClientConnection', () => {
    it('should define valid client connection structure', () => {
      const mockWs = { send: () => {}, close: () => {} };
      
      const client: ClientConnection = {
        clientId: 'client-123',
        sessionId: 'session-456',
        isHost: false,
        ws: mockWs,
        lastPing: Date.now(),
        connectedAt: Date.now()
      };

      expect(client.clientId).toBe('client-123');
      expect(client.sessionId).toBe('session-456');
      expect(client.isHost).toBe(false);
      expect(client.ws).toBe(mockWs);
      expect(typeof client.lastPing).toBe('number');
      expect(typeof client.connectedAt).toBe('number');
    });

    it('should allow optional sessionId', () => {
      const mockWs = { send: () => {}, close: () => {} };
      
      const client: ClientConnection = {
        clientId: 'client-123',
        isHost: true,
        ws: mockWs,
        lastPing: Date.now(),
        connectedAt: Date.now()
      };

      expect(client.sessionId).toBeUndefined();
    });
  });

  describe('Message Types', () => {
    it('should define RegisterHostMessage correctly', () => {
      const message: RegisterHostMessage = {
        type: 'register-host',
        sessionId: 'session-123',
        hostId: 'host-456',
        timestamp: Date.now()
      };

      expect(message.type).toBe('register-host');
      expect(message.sessionId).toBe('session-123');
      expect(message.hostId).toBe('host-456');
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define JoinSessionMessage correctly', () => {
      const message: JoinSessionMessage = {
        type: 'join-session',
        sessionId: 'session-123',
        timestamp: Date.now()
      };

      expect(message.type).toBe('join-session');
      expect(message.sessionId).toBe('session-123');
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define OfferMessage correctly', () => {
      const offer = { type: 'offer' as RTCSdpType, sdp: 'test-sdp' };
      
      const message: OfferMessage = {
        type: 'offer',
        sessionId: 'session-123',
        offer,
        timestamp: Date.now()
      };

      expect(message.type).toBe('offer');
      expect(message.sessionId).toBe('session-123');
      expect(message.offer).toEqual(offer);
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define AnswerMessage correctly', () => {
      const answer = { type: 'answer' as RTCSdpType, sdp: 'test-sdp' };
      
      const message: AnswerMessage = {
        type: 'answer',
        sessionId: 'session-123',
        answer,
        timestamp: Date.now()
      };

      expect(message.type).toBe('answer');
      expect(message.sessionId).toBe('session-123');
      expect(message.answer).toEqual(answer);
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define IceCandidateMessage correctly', () => {
      const candidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: 'data'
      };
      
      const message: IceCandidateMessage = {
        type: 'ice-candidate',
        sessionId: 'session-123',
        candidate,
        timestamp: Date.now()
      };

      expect(message.type).toBe('ice-candidate');
      expect(message.sessionId).toBe('session-123');
      expect(message.candidate).toEqual(candidate);
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define HeartbeatMessage correctly', () => {
      const message: HeartbeatMessage = {
        type: 'heartbeat',
        timestamp: Date.now()
      };

      expect(message.type).toBe('heartbeat');
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define ErrorMessage correctly', () => {
      const message: ErrorMessage = {
        type: 'error',
        error: 'Test error message',
        timestamp: Date.now()
      };

      expect(message.type).toBe('error');
      expect(message.error).toBe('Test error message');
      expect(typeof message.timestamp).toBe('number');
    });

    it('should define SuccessMessage correctly', () => {
      const message: SuccessMessage = {
        type: 'host-registered',
        sessionId: 'session-123',
        clientId: 'client-456',
        timestamp: Date.now()
      };

      expect(message.type).toBe('host-registered');
      expect(message.sessionId).toBe('session-123');
      expect(message.clientId).toBe('client-456');
      expect(typeof message.timestamp).toBe('number');
    });

    it('should allow SuccessMessage with minimal fields', () => {
      const message: SuccessMessage = {
        type: 'connected',
        timestamp: Date.now()
      };

      expect(message.type).toBe('connected');
      expect(message.sessionId).toBeUndefined();
      expect(message.clientId).toBeUndefined();
      expect(typeof message.timestamp).toBe('number');
    });
  });

  describe('Union Types', () => {
    it('should accept all message types in SignalingMessage union', () => {
      const messages: SignalingMessage[] = [
        { type: 'register-host', sessionId: 'session-123', hostId: 'host-456', timestamp: Date.now() },
        { type: 'join-session', sessionId: 'session-123', timestamp: Date.now() },
        { type: 'offer', sessionId: 'session-123', offer: { type: 'offer', sdp: 'test' }, timestamp: Date.now() },
        { type: 'answer', sessionId: 'session-123', answer: { type: 'answer', sdp: 'test' }, timestamp: Date.now() },
        { type: 'ice-candidate', sessionId: 'session-123', candidate: { candidate: 'test' }, timestamp: Date.now() },
        { type: 'heartbeat', timestamp: Date.now() }
      ];

      expect(messages).toHaveLength(6);
      messages.forEach(message => {
        expect(message).toHaveProperty('type');
        expect(message).toHaveProperty('timestamp');
      });
    });
  });

  describe('WebRTC Types', () => {
    it('should handle RTCSessionDescriptionInit correctly', () => {
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 127.0.0.1\r\n...'
      };

      expect(offer.type).toBe('offer');
      expect(typeof offer.sdp).toBe('string');
    });

    it('should handle RTCIceCandidateInit correctly', () => {
      const candidate: RTCIceCandidateInit = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'test'
      };

      expect(typeof candidate.candidate).toBe('string');
      expect(typeof candidate.sdpMLineIndex).toBe('number');
      expect(typeof candidate.sdpMid).toBe('string');
      expect(typeof candidate.usernameFragment).toBe('string');
    });

    it('should handle minimal RTCIceCandidateInit', () => {
      const candidate: RTCIceCandidateInit = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host'
      };

      expect(typeof candidate.candidate).toBe('string');
      expect(candidate.sdpMLineIndex).toBeUndefined();
      expect(candidate.sdpMid).toBeUndefined();
      expect(candidate.usernameFragment).toBeUndefined();
    });
  });
});