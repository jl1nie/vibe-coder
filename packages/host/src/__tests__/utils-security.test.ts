import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateCommand,
  sanitizeOutput,
  generateSessionSecret,
  isValidSessionId,
  isValidHostId,
  rateLimit,
  SecurityValidationResult,
} from '../utils/security';

describe('Security Utils', () => {
  beforeEach(() => {
    // Clear global rate limit store before each test
    if (global.rateLimitStore) {
      global.rateLimitStore.clear();
    }
    vi.clearAllMocks();
  });

  describe('validateCommand', () => {
    it('should accept valid command', () => {
      const result = validateCommand('echo "hello world"');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCommand).toBe('echo "hello world"');
      expect(result.reason).toBeUndefined();
    });

    it('should trim whitespace from command', () => {
      const result = validateCommand('  ls -la  ');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCommand).toBe('ls -la');
    });

    it('should reject empty string', () => {
      const result = validateCommand('');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Command must be a non-empty string');
      expect(result.sanitizedCommand).toBeUndefined();
    });

    it('should reject whitespace-only string', () => {
      const result = validateCommand('   ');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Command must be a non-empty string');
    });

    it('should reject non-string input', () => {
      const result = validateCommand(123 as any);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Command must be a non-empty string');
    });

    it('should reject null input', () => {
      const result = validateCommand(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Command must be a non-empty string');
    });

    it('should reject undefined input', () => {
      const result = validateCommand(undefined as any);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Command must be a non-empty string');
    });
  });

  describe('sanitizeOutput', () => {
    it('should redact Anthropic API keys', () => {
      const input = 'Your API key is sk-1234567890abcdef1234567890abcdef1234567890abcd';
      const result = sanitizeOutput(input);
      
      expect(result).toBe('Your API key is [REDACTED_API_KEY]');
    });

    it('should redact GitHub tokens', () => {
      const input = 'Token: ghp_1234567890abcdef1234567890abcdef123456';
      const result = sanitizeOutput(input);
      
      expect(result).toBe('Token: [REDACTED_GITHUB_TOKEN]');
    });

    it('should redact email addresses', () => {
      const input = 'Contact user@example.com for support';
      const result = sanitizeOutput(input);
      
      expect(result).toBe('Contact [REDACTED_EMAIL] for support');
    });

    it('should redact multiple email formats', () => {
      const input = 'Emails: test@domain.org, user.name+tag@example.co.uk';
      const result = sanitizeOutput(input);
      
      expect(result).toBe('Emails: [REDACTED_EMAIL], [REDACTED_EMAIL]');
    });

    it('should redact password patterns', () => {
      const testCases = [
        'password: secret123',
        'passwd=mypassword',
        'pwd secret',
        'PASSWORD: Secret123',
        'PASSWD=MyPassword',
      ];

      testCases.forEach(input => {
        const result = sanitizeOutput(input);
        expect(result).toContain('password=[REDACTED]');
        expect(result).not.toContain('secret');
        expect(result).not.toContain('mypassword');
        expect(result).not.toContain('Secret');
        expect(result).not.toContain('MyPassword');
      });
    });

    it('should handle multiple redactions in same string', () => {
      const input = `
        API Key: sk-1234567890abcdef1234567890abcdef1234567890abcd
        GitHub Token: ghp_1234567890abcdef1234567890abcdef123456
        Email: admin@company.com
        Password: secret123
      `;
      
      const result = sanitizeOutput(input);
      
      expect(result).toContain('[REDACTED_API_KEY]');
      expect(result).toContain('[REDACTED_GITHUB_TOKEN]');
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(result).toContain('password=[REDACTED]');
      expect(result).not.toContain('sk-');
      expect(result).not.toContain('ghp_');
      expect(result).not.toContain('@company.com');
      expect(result).not.toContain('secret123');
    });

    it('should not modify non-sensitive text', () => {
      const input = 'This is a normal log message with no sensitive data';
      const result = sanitizeOutput(input);
      
      expect(result).toBe(input);
    });
  });

  describe('generateSessionSecret', () => {
    it('should generate 64-character string', () => {
      const secret = generateSessionSecret();
      
      expect(secret).toHaveLength(64);
    });

    it('should only contain alphanumeric characters', () => {
      const secret = generateSessionSecret();
      
      expect(secret).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate different secrets each time', () => {
      const secret1 = generateSessionSecret();
      const secret2 = generateSessionSecret();
      
      expect(secret1).not.toBe(secret2);
    });

    it('should generate secrets with good entropy', () => {
      const secrets = new Set();
      for (let i = 0; i < 10; i++) {
        secrets.add(generateSessionSecret());
      }
      
      expect(secrets.size).toBe(10); // All should be unique
    });
  });

  describe('isValidSessionId', () => {
    it('should accept valid session ID', () => {
      expect(isValidSessionId('ABC12345')).toBe(true);
      expect(isValidSessionId('12345678')).toBe(true);
      expect(isValidSessionId('ABCDEFGH')).toBe(true);
    });

    it('should reject invalid session ID format', () => {
      expect(isValidSessionId('abc12345')).toBe(false); // lowercase
      expect(isValidSessionId('ABC1234')).toBe(false); // too short
      expect(isValidSessionId('ABC123456')).toBe(false); // too long
      expect(isValidSessionId('ABC1234@')).toBe(false); // special character
      expect(isValidSessionId('')).toBe(false); // empty
    });

    it('should reject non-string input', () => {
      expect(isValidSessionId(null as any)).toBe(false);
      expect(isValidSessionId(undefined as any)).toBe(false);
      expect(isValidSessionId(12345678 as any)).toBe(false);
    });
  });

  describe('isValidHostId', () => {
    it('should accept valid host ID', () => {
      expect(isValidHostId('12345678')).toBe(true);
      expect(isValidHostId('00000000')).toBe(true);
      expect(isValidHostId('99999999')).toBe(true);
    });

    it('should reject invalid host ID format', () => {
      expect(isValidHostId('1234567')).toBe(false); // too short
      expect(isValidHostId('123456789')).toBe(false); // too long
      expect(isValidHostId('1234567a')).toBe(false); // contains letter
      expect(isValidHostId('1234567@')).toBe(false); // special character
      expect(isValidHostId('')).toBe(false); // empty
    });

    it('should reject non-string input', () => {
      expect(isValidHostId(null as any)).toBe(false);
      expect(isValidHostId(undefined as any)).toBe(false);
      expect(isValidHostId(12345678 as any)).toBe(false);
    });
  });

  describe('rateLimit', () => {
    beforeEach(() => {
      // Mock Date.now for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow requests within limit', () => {
      const identifier = 'test-user';
      const maxRequests = 5;
      const windowMs = 60000; // 1 minute

      // First 5 requests should be allowed
      for (let i = 0; i < maxRequests; i++) {
        expect(rateLimit(identifier, maxRequests, windowMs)).toBe(true);
      }
    });

    it('should reject requests over limit', () => {
      const identifier = 'test-user';
      const maxRequests = 3;
      const windowMs = 60000;

      // First 3 requests allowed
      for (let i = 0; i < maxRequests; i++) {
        expect(rateLimit(identifier, maxRequests, windowMs)).toBe(true);
      }

      // 4th request should be rejected
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(false);
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(false);
    });

    it('should reset count after window expires', () => {
      const identifier = 'test-user';
      const maxRequests = 2;
      const windowMs = 60000;

      // Use up the limit
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(true);
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(true);
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(windowMs + 1000);

      // Should be allowed again
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(true);
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(true);
      expect(rateLimit(identifier, maxRequests, windowMs)).toBe(false);
    });

    it('should track different identifiers separately', () => {
      const maxRequests = 2;
      const windowMs = 60000;

      // User 1 uses up their limit
      expect(rateLimit('user1', maxRequests, windowMs)).toBe(true);
      expect(rateLimit('user1', maxRequests, windowMs)).toBe(true);
      expect(rateLimit('user1', maxRequests, windowMs)).toBe(false);

      // User 2 should still have their full limit
      expect(rateLimit('user2', maxRequests, windowMs)).toBe(true);
      expect(rateLimit('user2', maxRequests, windowMs)).toBe(true);
      expect(rateLimit('user2', maxRequests, windowMs)).toBe(false);
    });

    it('should initialize global store if not exists', () => {
      delete (global as any).rateLimitStore;
      
      expect(rateLimit('test', 5, 60000)).toBe(true);
      expect(global.rateLimitStore).toBeDefined();
      expect(global.rateLimitStore instanceof Map).toBe(true);
    });

    it('should handle rapid successive requests correctly', () => {
      const identifier = 'rapid-user';
      const maxRequests = 10;
      const windowMs = 60000;

      // Make many rapid requests
      const results = [];
      for (let i = 0; i < 15; i++) {
        results.push(rateLimit(identifier, maxRequests, windowMs));
      }

      // First 10 should be true, rest false
      expect(results.slice(0, 10)).toEqual(Array(10).fill(true));
      expect(results.slice(10)).toEqual(Array(5).fill(false));
    });
  });
});