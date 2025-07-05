/**
 * Vitest Global Setup
 * Test Pyramid setup for unit and integration tests
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// === Global Mocks ===

// Mock Web APIs not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

// Mock WebRTC APIs
Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createOffer: vi.fn().mockResolvedValue({}),
    createAnswer: vi.fn().mockResolvedValue({}),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
    connectionState: 'new',
    iceConnectionState: 'new',
    signalingState: 'stable',
  })),
});

// Mock Web Speech API
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    continuous: true,
    interimResults: true,
    lang: 'en-US',
  })),
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: window.SpeechRecognition,
});

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn().mockReturnValue(true),
});

// Mock Service Worker
Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    register: vi.fn().mockResolvedValue({
      installing: null,
      waiting: null,
      active: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    ready: Promise.resolve({
      installing: null,
      waiting: null,
      active: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

// Mock WebSocket
Object.defineProperty(window, 'WebSocket', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    length: 0,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock performance.mark and performance.measure
Object.defineProperty(window.performance, 'mark', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window.performance, 'measure', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window.performance, 'getEntriesByType', {
  writable: true,
  value: vi.fn().mockReturnValue([]),
});

// Mock crypto for UUID generation
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-1234-5678-9012'),
    getRandomValues: vi.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// === Test Environment Setup ===

// Set test environment variables
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('VITEST', 'true');

// Mock fetch for API calls
global.fetch = vi.fn();

// Custom console implementation for test clarity
const originalConsole = console;
global.console = {
  ...originalConsole,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// === Global Test Utilities ===

// Test data factory
export const createMockCommand = (overrides = {}) => ({
  icon: '🔥',
  label: 'Test Command',
  command: 'claude-code test command',
  description: 'A test command',
  category: 'test',
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  id: 'test-session-123',
  workspaceDir: '/tmp/test-workspace',
  isActive: true,
  createdAt: Date.now(),
  lastUsed: Date.now(),
  ...overrides,
});

export const createMockWebRTCConnection = () => ({
  createOffer: vi.fn().mockResolvedValue({ sdp: 'mock-offer', type: 'offer' }),
  createAnswer: vi.fn().mockResolvedValue({ sdp: 'mock-answer', type: 'answer' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  connectionState: 'connected',
  iceConnectionState: 'connected',
  signalingState: 'stable',
});

// === Test Cleanup ===

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Clear DOM
  document.body.innerHTML = '';
  
  // Clear localStorage/sessionStorage
  localStorageMock.clear();
  
  // Reset fetch mock
  vi.mocked(global.fetch).mockReset();
  
  // Reset console mocks
  vi.mocked(console.error).mockReset();
  vi.mocked(console.warn).mockReset();
  vi.mocked(console.log).mockReset();
});

// Fail tests on unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  throw new Error(`Unhandled Promise Rejection: ${reason}`);
});

// === Custom Matchers ===

expect.extend({
  toBeAccessible(received) {
    const hasAriaLabel = received.getAttribute('aria-label') !== null;
    const hasRole = received.getAttribute('role') !== null;
    const hasTabIndex = received.getAttribute('tabindex') !== null;
    
    const pass = hasAriaLabel || hasRole || hasTabIndex;
    
    return {
      message: () => `Expected element to be accessible (have aria-label, role, or tabindex)`,
      pass,
    };
  },
  
  toHaveValidCommand(received) {
    const isString = typeof received === 'string';
    const hasValidLength = received.length > 0 && received.length <= 1000;
    const hasValidPattern = /^[a-zA-Z0-9\s\-_"'.,!?()]+$/.test(received);
    
    const pass = isString && hasValidLength && hasValidPattern;
    
    return {
      message: () => `Expected "${received}" to be a valid command`,
      pass,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeAccessible(): T;
      toHaveValidCommand(): T;
    }
  }
}

// === Performance Testing Setup ===

// Mock performance monitoring
Object.defineProperty(window, 'PerformanceObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })),
});

// === Memory Leak Detection ===

let initialMemoryUsage: number;

beforeAll(() => {
  if (global.gc) {
    global.gc();
  }
  initialMemoryUsage = process.memoryUsage().heapUsed;
});

afterAll(() => {
  if (global.gc) {
    global.gc();
  }
  
  const finalMemoryUsage = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemoryUsage - initialMemoryUsage;
  
  // Warn if memory usage increased significantly (> 50MB)
  if (memoryIncrease > 50 * 1024 * 1024) {
    console.warn(`Memory usage increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB during tests`);
  }
});

// === Error Boundary Testing ===

export const createErrorBoundaryWrapper = () => {
  const errors: Error[] = [];
  
  const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    return (
      <div data-testid="error-boundary">
        {children}
      </div>
    );
  };
  
  return { ErrorBoundary, errors };
};

// === Async Testing Utilities ===

export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

console.log('🧪 Vibe Coder test environment initialized');
console.log('📊 Test Pyramid: Unit (90%+) | Integration (80%+) | E2E (70%+)');