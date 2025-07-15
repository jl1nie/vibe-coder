import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebRTCService } from '../services/webrtc-service';
import { SessionManager } from '../services/session-manager';
import { ClaudeService } from '../services/claude-service';
import { 
  setupProtocolTest,
  ProtocolMessageValidator,
  expectCorrectSTUNConfiguration,
  executeClaudeCommand,
  simulateClaudeOutput
} from '../../../shared/src/test-utils';

/**
 * WEBRTC_PROTOCOL.md準拠のHostサイドWebRTCテスト
 * 
 * このテストは、Host側でのWebRTC実装がプロトコル仕様に
 * 準拠していることを検証し、共通モックライブラリを使用します。
 */

// Mock logger
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
describe('WebRTC Protocol Compliance Tests (Host)', () => {
  let webrtcService: WebRTCService;
  let sessionManager: SessionManager;
  let mockClaudeService: any;
  let testSetup: any;

  beforeEach(() => {
    // Setup common protocol test environment
    testSetup = setupProtocolTest();
    
    // Mock ClaudeService
    mockClaudeService = {
      executeCommand: vi.fn().mockResolvedValue(undefined),
      cancelCommand: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ isRunning: false, command: null }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    // Mock SessionManager
    sessionManager = {
      verifyJwtToken: vi.fn().mockReturnValue(true),
      updateSessionActivity: vi.fn(),
      getSession: vi.fn().mockReturnValue({
        sessionId: 'TEST-SESSION',
        authenticated: true,
        webrtcReady: true
      }),
      addWebRTCConnection: vi.fn(),
      removeWebRTCConnection: vi.fn(),
      markSessionConnected: vi.fn(),
      markSessionDisconnected: vi.fn(),
      onAuthentication: vi.fn(), // Add missing method
      getHostId: vi.fn().mockReturnValue('12345678'),
      generateJwtToken: vi.fn().mockReturnValue('mock-jwt-token'),
      incrementReconnectAttempts: vi.fn(),
    } as any;

    webrtcService = new WebRTCService(sessionManager);
  });

  afterEach(() => {
    webrtcService?.cleanup?.();
  });

  describe('Phase 2.2: Host Server Processing', () => {
    describe('SDP Offer Processing', () => {
      it('should handle webrtc-offer-received with JWT verification', async () => {
        const sessionId = 'TEST-SESSION';
        const jwtToken = 'valid-jwt-token';
        const offer = {
          type: 'offer' as const,
          sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n...'
        };

        const connection = await webrtcService.createConnection(sessionId);
        await webrtcService.handleOffer(sessionId, offer, jwtToken);

        // Verify JWT was checked
        expect(sessionManager.verifyJwtToken).toHaveBeenCalledWith(jwtToken, sessionId);
        
        // Verify offer was set
        expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(offer);
      });

      it('should reject webrtc-offer without valid JWT', async () => {
        const sessionId = 'TEST-SESSION';
        const invalidJwtToken = 'invalid-jwt-token';
        const offer = {
          type: 'offer' as const,
          sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n...'
        };

        // Mock JWT verification failure
        sessionManager.verifyJwtToken = vi.fn().mockReturnValue(false);

        await expect(
          webrtcService.handleOffer(sessionId, offer, invalidJwtToken)
        ).rejects.toThrow('Authentication failed');

        expect(mockPeerConnection.setRemoteDescription).not.toHaveBeenCalled();
      });

      it('should create answer after processing offer', async () => {
        const sessionId = 'TEST-SESSION';
        const jwtToken = 'valid-jwt-token';
        const offer = {
          type: 'offer' as const,
          sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n...'
        };

        const connection = await webrtcService.createConnection(sessionId);
        const answer = await webrtcService.handleOffer(sessionId, offer, jwtToken);

        expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
        expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
          type: 'answer',
          sdp: 'mock-sdp-answer'
        });
        expect(answer).toEqual({
          type: 'answer',
          sdp: 'mock-sdp-answer'
        });
      });
    });

    describe('ICE Candidate Processing', () => {
      it('should handle ice-candidate-received with JWT verification', async () => {
        const sessionId = 'TEST-SESSION';
        const jwtToken = 'valid-jwt-token';
        const candidate = {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        };

        const connection = await webrtcService.createConnection(sessionId);
        await webrtcService.handleIceCandidate(sessionId, candidate, jwtToken);

        expect(sessionManager.verifyJwtToken).toHaveBeenCalledWith(jwtToken, sessionId);
        expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
      });

      it('should reject ice-candidate without valid JWT', async () => {
        const sessionId = 'TEST-SESSION';
        const invalidJwtToken = 'invalid-jwt-token';
        const candidate = {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        };

        sessionManager.verifyJwtToken = vi.fn().mockReturnValue(false);

        await expect(
          webrtcService.handleIceCandidate(sessionId, candidate, invalidJwtToken)
        ).rejects.toThrow('Authentication failed');

        expect(mockPeerConnection.addIceCandidate).not.toHaveBeenCalled();
      });
    });
  });

  describe('Phase 3: Claude Code Execution', () => {
    describe('DataChannel Communication', () => {
      it('should handle claude-command via DataChannel', async () => {
        const sessionId = 'TEST-SESSION';
        const commandMessage = {
          type: 'claude-command',
          sessionId,
          commandId: 'CMD_789ABC',
          command: 'create a React component for user profile',
          timestamp: Date.now()
        };

        const connection = await webrtcService.createConnection(sessionId);
        
        // Simulate DataChannel open
        mockDataChannel.readyState = 'open';
        
        // Simulate incoming message
        const messageHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        if (messageHandler) {
          await messageHandler({
            data: JSON.stringify(commandMessage)
          });
        }

        expect(mockClaudeService.executeCommand).toHaveBeenCalledWith(
          commandMessage.command,
          expect.any(Object) // execution context
        );
      });

      it('should stream claude-output in real-time', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);
        
        // Mock Claude service output streaming
        let outputCallback: ((data: string) => void) | undefined;
        mockClaudeService.executeCommand = vi.fn().mockImplementation((command, context) => {
          outputCallback = context.onOutput;
          return Promise.resolve();
        });

        // Execute command
        const commandMessage = {
          type: 'claude-command',
          sessionId,
          commandId: 'CMD_789ABC',
          command: 'create a React component',
          timestamp: Date.now()
        };

        const messageHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        if (messageHandler) {
          await messageHandler({
            data: JSON.stringify(commandMessage)
          });
        }

        // Simulate output streaming
        if (outputCallback) {
          outputCallback('Creating React component...\r\n');
          outputCallback('import React from \'react\';\r\n');
        }

        // Verify output messages were sent
        expect(mockDataChannel.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"claude-output"')
        );
        expect(mockDataChannel.send).toHaveBeenCalledWith(
          expect.stringContaining('"data":"Creating React component..."')
        );
      });

      it('should send claude-completed when command finishes', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);
        
        // Mock Claude service completion
        let completionCallback: ((exitCode: number) => void) | undefined;
        mockClaudeService.executeCommand = vi.fn().mockImplementation((command, context) => {
          completionCallback = context.onCompletion;
          return Promise.resolve();
        });

        // Execute command
        const commandMessage = {
          type: 'claude-command',
          sessionId,
          commandId: 'CMD_789ABC',
          command: 'create a React component',
          timestamp: Date.now()
        };

        const messageHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        if (messageHandler) {
          await messageHandler({
            data: JSON.stringify(commandMessage)
          });
        }

        // Simulate command completion
        if (completionCallback) {
          completionCallback(0); // success
        }

        // Verify completion message was sent
        expect(mockDataChannel.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"claude-completed"')
        );
        expect(mockDataChannel.send).toHaveBeenCalledWith(
          expect.stringContaining('"exitCode":0')
        );
        expect(mockDataChannel.send).toHaveBeenCalledWith(
          expect.stringContaining('"commandId":"CMD_789ABC"')
        );
      });
    });
  });

  describe('Phase 4: Connection State Management', () => {
    describe('ICE Connection State Monitoring', () => {
      it('should handle iceConnectionState changes', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);

        // Simulate ICE connection state changes
        const stateHandler = mockPeerConnection.addEventListener.mock.calls
          .find(call => call[0] === 'iceconnectionstatechange')?.[1];

        if (stateHandler) {
          // Test disconnected state
          mockPeerConnection.iceConnectionState = 'disconnected';
          stateHandler();

          // Test failed state
          mockPeerConnection.iceConnectionState = 'failed';
          stateHandler();

          // Test connected state
          mockPeerConnection.iceConnectionState = 'connected';
          stateHandler();
        }

        expect(sessionManager.markSessionConnected).toHaveBeenCalledWith(sessionId);
      });

      it('should trigger reconnection on connection failure', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);

        const stateHandler = mockPeerConnection.addEventListener.mock.calls
          .find(call => call[0] === 'iceconnectionstatechange')?.[1];

        if (stateHandler) {
          mockPeerConnection.iceConnectionState = 'failed';
          stateHandler();
        }

        // Should mark session as disconnected for reconnection logic
        expect(sessionManager.markSessionDisconnected).toHaveBeenCalledWith(sessionId);
      });
    });

    describe('DataChannel State Monitoring', () => {
      it('should handle DataChannel open state', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);

        const openHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'open')?.[1];

        if (openHandler) {
          openHandler();
        }

        // Should log successful DataChannel opening
        const logger = await import('../utils/logger');
        expect(logger.default.info).toHaveBeenCalledWith(
          expect.stringContaining('DataChannel opened'),
          expect.objectContaining({ sessionId })
        );
      });

      it('should handle DataChannel close state', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);

        const closeHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'close')?.[1];

        if (closeHandler) {
          closeHandler();
        }

        // Should log DataChannel closure
        const logger = await import('../utils/logger');
        expect(logger.default.info).toHaveBeenCalledWith(
          expect.stringContaining('DataChannel closed'),
          expect.objectContaining({ sessionId })
        );
      });
    });
  });

  describe('Protocol Configuration Compliance', () => {
    describe('STUN Configuration', () => {
      it('should use protocol-specified STUN server', async () => {
        const sessionId = 'TEST-SESSION';
        await webrtcService.createConnection(sessionId);

        // Verify wrtc.RTCPeerConnection was called with correct STUN configuration
        const wrtc = await import('wrtc');
        expect(wrtc.RTCPeerConnection).toHaveBeenCalledWith({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
      });
    });

    describe('Message Format Validation', () => {
      it('should validate claude-command message format', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);

        // Test invalid message (missing required fields)
        const invalidMessage = {
          type: 'claude-command',
          sessionId,
          // Missing commandId and command
          timestamp: Date.now()
        };

        const messageHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];

        if (messageHandler) {
          await messageHandler({
            data: JSON.stringify(invalidMessage)
          });
        }

        // Should not execute command with invalid message
        expect(mockClaudeService.executeCommand).not.toHaveBeenCalled();
      });

      it('should handle malformed JSON messages', async () => {
        const sessionId = 'TEST-SESSION';
        const connection = await webrtcService.createConnection(sessionId);

        const messageHandler = mockDataChannel.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];

        if (messageHandler) {
          await messageHandler({
            data: 'invalid-json-{'
          });
        }

        // Should handle gracefully without crashing
        const logger = await import('../utils/logger');
        expect(logger.default.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Security Compliance', () => {
    describe('JWT Token Validation', () => {
      it('should require valid JWT for all WebRTC operations', async () => {
        const sessionId = 'TEST-SESSION';
        const invalidJwt = 'invalid-token';

        sessionManager.verifyJwtToken = vi.fn().mockReturnValue(false);

        // Test offer rejection
        await expect(
          webrtcService.handleOffer(sessionId, { type: 'offer', sdp: 'test' }, invalidJwt)
        ).rejects.toThrow('Authentication failed');

        // Test ICE candidate rejection
        await expect(
          webrtcService.handleIceCandidate(sessionId, { candidate: 'test', sdpMid: '0' }, invalidJwt)
        ).rejects.toThrow('Authentication failed');
      });

      it('should validate session authentication state', async () => {
        const sessionId = 'TEST-SESSION';
        const jwtToken = 'valid-token';

        // Mock unauthenticated session
        sessionManager.getSession = vi.fn().mockReturnValue({
          sessionId,
          authenticated: false,
          webrtcReady: false
        });

        await expect(
          webrtcService.handleOffer(sessionId, { type: 'offer', sdp: 'test' }, jwtToken)
        ).rejects.toThrow('Session not authenticated');
      });
    });
  });
});