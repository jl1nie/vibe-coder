import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../services/session-manager';

// Mock dependencies
vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn().mockReturnValue({
      base32: 'JBSWY3DPEHPK3PXP', // Valid base32 secret
      otpauth_url: 'otpauth://totp/Vibe%20Coder:test?secret=JBSWY3DPEHPK3PXP&issuer=Vibe%20Coder'
    }),
    totp: {
      verify: vi.fn().mockReturnValue(true)
    }
  }
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({ sessionId: 'TEST1234', hostId: '12345678' })
  }
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('Host ID Generation', () => {
    it('should generate valid 8-digit host ID', () => {
      const hostId = sessionManager.getHostId();
      expect(hostId).toMatch(/^[0-9]{8}$/);
    });

    it('should use consistent host ID (permanent ID)', () => {
      const manager1 = new SessionManager();
      const manager2 = new SessionManager();
      
      // Host ID is now persistent, so both managers should use the same ID
      expect(manager1.getHostId()).toBe(manager2.getHostId());
      expect(manager1.getHostId()).toMatch(/^\d{8}$/);
      
      manager1.destroy();
      manager2.destroy();
    });
  });

  describe('Session Management', () => {
    it('should create new session with TOTP secret', async () => {
      const result = await sessionManager.createSession();
      
      expect(result.sessionId).toMatch(/^[A-Z0-9]{8}$/);
      expect(result.totpSecret).toMatch(/^[A-Z2-7]{16}$/);
      expect(sessionManager.getTotalSessions()).toBe(1);
    });

    it('should verify TOTP correctly', async () => {
      const { sessionId } = await sessionManager.createSession();
      
      const verified = sessionManager.verifyTotp(sessionId, '123456');
      expect(verified).toBe(true);
      
      const session = sessionManager.getSession(sessionId);
      expect(session?.isAuthenticated).toBe(true);
    });

    it('should generate JWT token for authenticated session', async () => {
      const { sessionId } = await sessionManager.createSession();
      sessionManager.verifyTotp(sessionId, '123456');
      
      const token = sessionManager.generateJwtToken(sessionId);
      expect(token).toBe('mock-jwt-token');
    });

    it('should verify JWT token correctly', async () => {
      const { sessionId } = await sessionManager.createSession();
      sessionManager.verifyTotp(sessionId, '123456');
      
      // Mock the JWT verify to return the actual session ID
      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.default.verify).mockReturnValueOnce({
        sessionId: sessionId,
        hostId: sessionManager.getHostId(),
      });
      
      const decoded = sessionManager.verifyJwtToken('mock-jwt-token');
      expect(decoded).toEqual({
        sessionId: sessionId,
        hostId: sessionManager.getHostId(),
      });
    });

    it('should update session activity', async () => {
      const { sessionId } = await sessionManager.createSession();
      const session = sessionManager.getSession(sessionId);
      const originalActivity = session?.lastActivity;
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      sessionManager.updateSessionActivity(sessionId);
      const updatedSession = sessionManager.getSession(sessionId);
      
      expect(updatedSession?.lastActivity.getTime()).toBeGreaterThan(
        originalActivity?.getTime() || 0
      );
    });

    it('should remove session', async () => {
      const { sessionId } = await sessionManager.createSession();
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      sessionManager.removeSession(sessionId);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    it('should get active sessions only', async () => {
      const { sessionId: session1 } = await sessionManager.createSession();
      await sessionManager.createSession(); // session2 not used but needed for test
      
      // Authenticate only session1
      sessionManager.verifyTotp(session1, '123456');
      
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session1);
    });
  });

  describe('Error Handling', () => {
    it('should handle TOTP verification for non-existent session', () => {
      const verified = sessionManager.verifyTotp('INVALID1', '123456');
      expect(verified).toBe(false);
    });

    it('should throw error when generating JWT for unauthenticated session', async () => {
      const { sessionId } = await sessionManager.createSession();
      
      expect(() => {
        sessionManager.generateJwtToken(sessionId);
      }).toThrow('Session not authenticated');
    });

    it('should return null for invalid JWT token', async () => {
      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.default.verify).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });
      
      const decoded = sessionManager.verifyJwtToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });
});