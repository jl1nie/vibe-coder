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
  const mockPeerConnection = {
    createOffer: vi.fn().mockResolvedValue({}),
    createAnswer: vi.fn().mockResolvedValue({}),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    createDataChannel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
    connectionState: 'new' as RTCPeerConnectionState,
  };

  Object.defineProperty(window, 'RTCPeerConnection', {
    writable: true,
    value: vi.fn().mockImplementation(() => mockPeerConnection),
  });

  return mockPeerConnection;
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
