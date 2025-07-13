import { render, RenderOptions, waitFor } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { vi } from 'vitest';

// Import act from react instead of react-dom/test-utils
import { act } from 'react';

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Helper function to wrap async operations in act
export const renderWithAct = async (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  let result: ReturnType<typeof render>;

  await act(async () => {
    result = customRender(ui, options);
  });

  return result!;
};

// Helper function to wait for async operations with act
export const waitForWithAct = async (callback: () => void | Promise<void>) => {
  await act(async () => {
    await waitFor(callback);
  });
};

export * from '@testing-library/react';
export { act, customRender as render };

// Mock helpers
export const mockVoiceRecognition = () => {
  const mockRecognition = {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: 'ja-JP',
    maxAlternatives: 1,
  };

  Object.defineProperty(window, 'webkitSpeechRecognition', {
    writable: true,
    value: vi.fn().mockImplementation(() => mockRecognition),
  });

  return mockRecognition;
};

export const mockWebRTC = () => {
  const mockDataChannel = {
    readyState: 'open' as RTCDataChannelState,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };

  const mockPeerConnection = {
    createOffer: vi.fn().mockResolvedValue({
      type: 'offer',
      sdp: 'mock-offer-sdp'
    }),
    createAnswer: vi.fn().mockResolvedValue({
      type: 'answer', 
      sdp: 'mock-answer-sdp'
    }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    createDataChannel: vi.fn().mockReturnValue(mockDataChannel),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
    connectionState: 'new' as RTCPeerConnectionState,
    iceConnectionState: 'new' as RTCIceConnectionState,
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    onicecandidate: null,
    oniceconnectionstatechange: null,
    ondatachannel: null,
  };

  Object.defineProperty(window, 'RTCPeerConnection', {
    writable: true,
    value: vi.fn().mockImplementation(() => mockPeerConnection),
  });

  return { mockPeerConnection, mockDataChannel };
};

export const mockWebSocket = () => {
  const mockWebSocket = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    ping: vi.fn(),
  };

  Object.defineProperty(window, 'WebSocket', {
    writable: true,
    value: vi.fn().mockImplementation(() => mockWebSocket),
  });

  return mockWebSocket;
};

export const createMockTerminalOutput = (overrides = {}) => ({
  id: Date.now().toString(),
  type: 'info' as const,
  text: 'Test output',
  timestamp: new Date(),
  ...overrides,
});

export const createMockConnectionStatus = (overrides = {}) => ({
  isConnected: false,
  ...overrides,
});

export const waitForTimeout = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

// WebSocket signaling mock helpers
export const mockSignalingFlow = () => {
  const mockWebSocketInstance = mockWebSocket();
  const { mockPeerConnection, mockDataChannel } = mockWebRTC();
  
  // Simulate WebSocket signaling message flow
  const simulateSignalingMessage = (type: string, data: any) => {
    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify({ type, ...data })
    });
    
    if (mockWebSocketInstance.onmessage) {
      (mockWebSocketInstance.onmessage as any)(messageEvent);
    }
  };
  
  // Simulate successful WebRTC P2P connection establishment
  const simulateP2PConnection = () => {
    // Simulate WebSocket connection
    if (mockWebSocketInstance.onopen) {
      (mockWebSocketInstance.onopen as any)(new Event('open'));
    }
    
    // Simulate signaling messages
    simulateSignalingMessage('session-joined', { sessionId: 'test-session' });
    
    // Simulate WebRTC connection
    if (mockPeerConnection.oniceconnectionstatechange) {
      Object.defineProperty(mockPeerConnection, 'iceConnectionState', {
        value: 'connected'
      });
      (mockPeerConnection.oniceconnectionstatechange as any)(new Event('iceconnectionstatechange'));
    }
    
    // Simulate data channel open
    if (mockDataChannel.onopen) {
      (mockDataChannel.onopen as any)(new Event('open'));
    }
  };
  
  return {
    mockWebSocket: mockWebSocketInstance,
    mockPeerConnection,
    mockDataChannel,
    simulateSignalingMessage,
    simulateP2PConnection
  };
};

// Mock WebRTC P2P command execution
export const mockP2PCommandExecution = (mockDataChannel: any, _command: string, response: string) => {
  // Simulate sending command via data channel
  // const commandMessage = JSON.stringify({
  //   type: 'claude-command',
  //   command,
  //   timestamp: Date.now()
  // });
  
  // Simulate receiving response via data channel
  setTimeout(() => {
    if (mockDataChannel.onmessage) {
      const responseEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'output',
          data: response
        })
      });
      mockDataChannel.onmessage(responseEvent);
      
      // Simulate command completion
      const completedEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'completed',
          timestamp: Date.now()
        })
      });
      mockDataChannel.onmessage(completedEvent);
    }
  }, 100);
};

// No REST API fallback - WebRTC P2P only
export const mockWebRTCOnlyFlow = () => {
  // Remove fetch from global scope to ensure WebRTC P2P only
  const originalFetch = global.fetch;
  
  // Mock fetch to reject REST API calls
  global.fetch = vi.fn().mockRejectedValue(
    new Error('REST API is disabled - WebRTC P2P connection required')
  );
  
  return {
    restore: () => {
      global.fetch = originalFetch;
    }
  };
};
