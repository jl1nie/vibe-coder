import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock WebRTC APIs
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  addIceCandidate: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

global.RTCSessionDescription = vi.fn().mockImplementation((init) => init);
global.RTCIceCandidate = vi.fn().mockImplementation((init) => init);

// Mock Web APIs
global.navigator.mediaDevices = {
  getUserMedia: vi.fn(),
  enumerateDevices: vi.fn(),
  getDisplayMedia: vi.fn(),
};

// Mock Web Speech API
global.SpeechRecognition = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

global.webkitSpeechRecognition = global.SpeechRecognition;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = { ...localStorageMock };

// Mock crypto
global.crypto = {
  randomUUID: vi.fn(() => 'test-uuid'),
  getRandomValues: vi.fn((array) => array),
  subtle: {} as SubtleCrypto,
};

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
global.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Security test utilities
export const createSecureTestEnv = () => ({
  // Mock secure random values
  getSecureRandom: () => crypto.getRandomValues(new Uint8Array(32)),
  
  // Mock CSP violations
  mockCSPViolation: (directive: string) => {
    const event = new Event('securitypolicyviolation') as any;
    event.directive = directive;
    event.blockedURI = 'https://malicious.com';
    window.dispatchEvent(event);
  },
  
  // Validate command security
  validateCommandSecurity: (command: string) => {
    const dangerousPatterns = [
      /rm\s+-rf?\s*[\/\*]/,
      /sudo\s+(?!claude-code)/,
      /eval\s*\(/,
      /exec\s*\(/,
      /system\s*\(/,
      /curl.*\|\s*sh/,
      /wget.*\|\s*sh/,
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(command));
  },
});

// Clean up after each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});