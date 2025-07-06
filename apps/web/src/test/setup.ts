import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
  var createMockTerminalOutput: (overrides?: object) => any;
  var createMockConnectionStatus: (overrides?: object) => any;
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock Web Speech API
Object.defineProperty(window as any, 'webkitSpeechRecognition', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: 'ja-JP',
    maxAlternatives: 1,
  })),
});

Object.defineProperty(window as any, 'SpeechRecognition', {
  writable: true,
  value: window.webkitSpeechRecognition,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock environment variables
vi.mock('@vibe-coder/shared', async () => {
  const actual = await vi.importActual<Record<string, any>>('@vibe-coder/shared');
  return {
    ...actual,
    SIGNALING_SERVER_URL: 'http://localhost:3000',
    PWA_URL: 'http://localhost:5173',
  };
});

// Global test utilities
global.createMockTerminalOutput = (overrides = {}) => ({
  id: Date.now().toString(),
  type: 'info' as const,
  text: 'Test output',
  timestamp: new Date(),
  ...overrides,
});

global.createMockConnectionStatus = (overrides = {}) => ({
  isConnected: false,
  ...overrides,
});