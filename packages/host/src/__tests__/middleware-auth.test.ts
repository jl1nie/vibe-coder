import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware, createSessionValidationMiddleware, authenticateSession } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Mock the SessionManager class completely
const mockSessionManager = {
  verifyJwtToken: vi.fn(),
  updateSessionActivity: vi.fn(),
  getSession: vi.fn(),
  removeSession: vi.fn(),
};

// Mock the security module
vi.mock('../utils/security', () => ({
  rateLimit: vi.fn(),
}));

// Mock the logger module
vi.mock('../utils/logger', () => ({
  default: {
    warn: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('createAuthMiddleware', () => {
    it('should successfully authenticate with valid token', async () => {
      const { rateLimit } = await import('../utils/security');
      vi.mocked(rateLimit).mockReturnValue(true);
      
      mockReq.headers!.authorization = 'Bearer valid-token';
      mockSessionManager.verifyJwtToken.mockReturnValue({
        sessionId: 'test-session',
        hostId: 'test-host',
      });

      const authMiddleware = createAuthMiddleware(mockSessionManager as any);
      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockSessionManager.verifyJwtToken).toHaveBeenCalledWith('valid-token');
      expect(mockSessionManager.updateSessionActivity).toHaveBeenCalledWith('test-session');
      expect(mockReq.sessionId).toBe('test-session');
      expect(mockReq.hostId).toBe('test-host');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without authorization header', () => {
      const authMiddleware = createAuthMiddleware(mockSessionManager as any);
      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      mockReq.headers!.authorization = 'Bearer invalid-token';
      mockSessionManager.verifyJwtToken.mockReturnValue(null);

      const authMiddleware = createAuthMiddleware(mockSessionManager as any);
      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request when rate limit exceeded', async () => {
      const { rateLimit } = await import('../utils/security');
      const logger = await import('../utils/logger');
      
      vi.mocked(rateLimit).mockReturnValue(false);
      mockReq.headers!.authorization = 'Bearer valid-token';
      mockSessionManager.verifyJwtToken.mockReturnValue({
        sessionId: 'test-session',
        hostId: 'test-host',
      });

      const authMiddleware = createAuthMiddleware(mockSessionManager as any);
      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(rateLimit).toHaveBeenCalledWith('session:test-session', 60, 60000);
      expect(logger.default.warn).toHaveBeenCalledWith('Rate limit exceeded', { sessionId: 'test-session' });
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('createSessionValidationMiddleware', () => {
    it('should validate existing active session', () => {
      mockReq.params!.sessionId = 'test-session';
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        hostId: 'test-host',
        totpSecret: 'secret',
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      const validationMiddleware = createSessionValidationMiddleware(mockSessionManager as any);
      validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSessionManager.getSession).toHaveBeenCalledWith('test-session');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without session ID', () => {
      const validationMiddleware = createSessionValidationMiddleware(mockSessionManager as any);
      validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Session ID is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with non-existent session', () => {
      mockReq.params!.sessionId = 'non-existent';
      mockSessionManager.getSession.mockReturnValue(null);

      const validationMiddleware = createSessionValidationMiddleware(mockSessionManager as any);
      validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Session not found'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should remove and reject expired session', () => {
      mockReq.params!.sessionId = 'expired-session';
      mockSessionManager.getSession.mockReturnValue({
        id: 'expired-session',
        hostId: 'test-host',
        totpSecret: 'secret',
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      const validationMiddleware = createSessionValidationMiddleware(mockSessionManager as any);
      validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSessionManager.removeSession).toHaveBeenCalledWith('expired-session');
      expect(mockRes.status).toHaveBeenCalledWith(410);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Session expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateSession', () => {
    it('should be an alias for createAuthMiddleware', () => {
      const authMiddleware = authenticateSession(mockSessionManager as any);
      expect(typeof authMiddleware).toBe('function');
    });
  });
});