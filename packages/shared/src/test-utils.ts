import { vi } from 'vitest';

/**
 * Test utilities for WebRTC protocol compliance tests
 */

export interface SessionStateTestHelper {
  createMockSession(): any;
  verifySessionState(session: any): void;
  mockWebRTCConnection(): any;
  mockSessionManager(): any;
  mockClaudeService(): any;
  mockWebRTCService(): any;
}

/**
 * Setup protocol test environment
 */
export function setupProtocolTest() {
  // Mock common dependencies
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  // Mock WebRTC components
  const mockRTCPeerConnection = {
    createDataChannel: vi.fn(),
    createOffer: vi.fn(),
    createAnswer: vi.fn(),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    iceConnectionState: 'new',
    connectionState: 'new',
    signalingState: 'stable',
  };

  const mockRTCDataChannel = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 'open',
    label: 'test-channel',
  };

  // Mock WebSocket
  const mockWebSocket = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // WebSocket.OPEN
  };

  // Mock session data
  const mockSessionData = {
    sessionId: 'test-session-123',
    hostId: '12345678',
    authenticated: false,
    webrtcReady: false,
    jwtToken: null,
    tokenExpiry: null,
    lastActivity: Date.now(),
    reconnectAttempts: 0,
    securityFlags: {
      suspicious: false,
      multipleConnections: false,
    },
    createdAt: new Date(),
    isAuthenticated: false,
    webrtcConnections: [],
  };

  return {
    mockLogger,
    mockRTCPeerConnection,
    mockRTCDataChannel,
    mockWebSocket,
    mockSessionData,
    
    // Helper methods
    createMockSession: () => ({ ...mockSessionData }),
    verifySessionState: (session: any) => {
      // Verify session has required properties
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('authenticated');
      expect(session).toHaveProperty('webrtcReady');
      expect(session).toHaveProperty('lastActivity');
      expect(session).toHaveProperty('reconnectAttempts');
      expect(session).toHaveProperty('securityFlags');
    },
    
    mockWebRTCConnection: () => ({
      connectionId: 'conn-' + Date.now(),
      state: 'connecting',
      createdAt: new Date(),
      lastActivity: new Date(),
    }),
    
    mockSessionManager: () => ({
      getHostId: vi.fn(() => '12345678'),
      createProtocolSession: vi.fn(),
      updateSessionActivity: vi.fn(),
      getSession: vi.fn(),
      setAuthenticated: vi.fn(),
      generateJwtToken: vi.fn(),
      verifyJwtToken: vi.fn(),
      generateTotpSecret: vi.fn(),
      verifyTotpCode: vi.fn(),
      requiresReAuthentication: vi.fn(),
      extendSession: vi.fn(),
      addWebRTCConnection: vi.fn(),
      getWebRTCConnections: vi.fn(),
      markSessionConnected: vi.fn(),
      markSessionDisconnected: vi.fn(),
      incrementReconnectAttempts: vi.fn(),
      getStats: vi.fn(),
      invalidateSession: vi.fn(),
      destroy: vi.fn(),
    }),
    
    mockClaudeService: () => ({
      executeCommand: vi.fn(),
      cancelCommand: vi.fn(),
      isCommandRunning: vi.fn(),
      getRunningCommandsCount: vi.fn(),
      healthCheck: vi.fn(),
      destroy: vi.fn(),
    }),
    
    mockWebRTCService: () => ({
      initializeSignaling: vi.fn(),
      createPeerConnection: vi.fn(),
      handleSignalingMessage: vi.fn(),
      sendSignalingMessage: vi.fn(),
      cleanupInactiveConnections: vi.fn(),
      logDetailedStatus: vi.fn(),
      destroy: vi.fn(),
    }),
  };
}

/**
 * Session state test helper implementation
 */
export class SessionStateTestHelper {
  private testSetup: ReturnType<typeof setupProtocolTest>;
  
  constructor() {
    this.testSetup = setupProtocolTest();
  }
  
  createMockSession() {
    return this.testSetup.createMockSession();
  }
  
  verifySessionState(session: any) {
    this.testSetup.verifySessionState(session);
  }
  
  mockWebRTCConnection() {
    return this.testSetup.mockWebRTCConnection();
  }
  
  mockSessionManager() {
    return this.testSetup.mockSessionManager();
  }
  
  mockClaudeService() {
    return this.testSetup.mockClaudeService();
  }
  
  mockWebRTCService() {
    return this.testSetup.mockWebRTCService();
  }
}

/**
 * WebRTC protocol test utilities
 */
export const WebRTCTestUtils = {
  /**
   * Create a mock RTCPeerConnection
   */
  createMockPeerConnection: () => ({
    createDataChannel: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    iceConnectionState: 'new',
    connectionState: 'new',
    signalingState: 'stable',
    localDescription: null,
    remoteDescription: null,
    iceGatheringState: 'new',
  }),
  
  /**
   * Create a mock RTCDataChannel
   */
  createMockDataChannel: () => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 'open',
    label: 'test-channel',
    id: 0,
    ordered: true,
    maxRetransmits: null,
    maxPacketLifeTime: null,
    protocol: '',
  }),
  
  /**
   * Create a mock WebSocket
   */
  createMockWebSocket: () => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    url: 'ws://localhost:5175',
    protocol: '',
    extensions: '',
    binaryType: 'blob' as BinaryType,
  }),
  
  /**
   * Create mock ICE candidate
   */
  createMockIceCandidate: () => ({
    candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
    sdpMLineIndex: 0,
    sdpMid: 'data',
    foundation: '1',
    component: 1,
    priority: 2130706431,
    protocol: 'udp',
    type: 'host',
    tcpType: null,
    relatedAddress: null,
    relatedPort: null,
  }),
  
  /**
   * Simulate WebRTC connection state changes
   */
  simulateConnectionStateChange: (mockPeerConnection: any, newState: string) => {
    mockPeerConnection.connectionState = newState;
    mockPeerConnection.iceConnectionState = newState;
    
    // Trigger event listeners
    const listeners = mockPeerConnection.addEventListener.mock.calls;
    listeners.forEach(([event, handler]: [string, Function]) => {
      if (event === 'connectionstatechange' || event === 'iceconnectionstatechange') {
        handler({ target: mockPeerConnection });
      }
    });
  },
  
  /**
   * Simulate ICE candidate gathering
   */
  simulateIceCandidate: (mockPeerConnection: any, candidate: any = null) => {
    const listeners = mockPeerConnection.addEventListener.mock.calls;
    listeners.forEach(([event, handler]: [string, Function]) => {
      if (event === 'icecandidate') {
        handler({ candidate });
      }
    });
  },
  
  /**
   * Simulate data channel message
   */
  simulateDataChannelMessage: (mockDataChannel: any, data: string) => {
    const listeners = mockDataChannel.addEventListener.mock.calls;
    listeners.forEach(([event, handler]: [string, Function]) => {
      if (event === 'message') {
        handler({ data });
      }
    });
  },
};

/**
 * Common test assertions for WebRTC protocols
 */
export const WebRTCAssertions = {
  /**
   * Assert that a peer connection was created correctly
   */
  assertPeerConnectionCreated: (mockPeerConnection: any) => {
    expect(mockPeerConnection).toBeDefined();
    expect(mockPeerConnection.createDataChannel).toBeDefined();
    expect(mockPeerConnection.createOffer).toBeDefined();
    expect(mockPeerConnection.createAnswer).toBeDefined();
  },
  
  /**
   * Assert that signaling messages follow protocol
   */
  assertSignalingMessage: (message: any, expectedType: string) => {
    expect(message).toHaveProperty('type', expectedType);
    expect(message).toHaveProperty('sessionId');
    expect(message).toHaveProperty('hostId');
    expect(message).toHaveProperty('timestamp');
  },
  
  /**
   * Assert that session state is valid
   */
  assertValidSessionState: (session: any) => {
    expect(session).toHaveProperty('sessionId');
    expect(session).toHaveProperty('authenticated');
    expect(session).toHaveProperty('webrtcReady');
    expect(session).toHaveProperty('lastActivity');
    expect(session).toHaveProperty('reconnectAttempts');
    expect(session).toHaveProperty('securityFlags');
    expect(session.securityFlags).toHaveProperty('suspicious');
    expect(session.securityFlags).toHaveProperty('multipleConnections');
  },
};

// Export for easy access
export { vi };