import { vi } from 'vitest';

// Mock environment variables for testing
process.env.CLAUDE_API_KEY = 'test-api-key';
process.env.SESSION_SECRET = 'test-session-secret-with-sufficient-length-for-security';
process.env.PORT = '8080';
process.env.LOG_LEVEL = 'error';
process.env.NODE_ENV = 'test';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation(() => ({
    stdout: {
      on: vi.fn(),
    },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn(),
    kill: vi.fn(),
  })),
}));

// Mock speakeasy
vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn().mockReturnValue({
      base32: 'MOCKBASE32SECRET',
      otpauth_url: 'otpauth://totp/test',
    }),
    totp: {
      verify: vi.fn().mockReturnValue(true),
    },
  },
  generateSecret: vi.fn().mockReturnValue({
    base32: 'MOCKBASE32SECRET',
    otpauth_url: 'otpauth://totp/test',
  }),
  totp: {
    verify: vi.fn().mockReturnValue(true),
  },
}));

// Mock qrcode
vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock-jwt-token'),
  verify: vi.fn().mockReturnValue({ sessionId: 'TEST1234', hostId: '12345678' }),
}));

// Global test utilities
(global as any).createMockSession = (overrides = {}) => ({
  id: 'TEST1234',
  hostId: '12345678',
  totpSecret: 'MOCKBASE32SECRET',
  qrCodeUrl: 'data:image/png;base64,mock-qr-code',
  isAuthenticated: false,
  createdAt: new Date(),
  lastActivity: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  ...overrides,
});

(global as any).createMockClaudeResult = (overrides = {}) => ({
  success: true,
  output: 'Mock command output',
  executionTime: 1000,
  ...overrides,
});