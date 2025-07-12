import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createAuthRouter } from '../routes/auth';
import { SessionManager } from '../services/session-manager';

// Mock dependencies
vi.mock('../middleware/auth', () => ({
  createSessionValidationMiddleware: vi.fn((sessionManager) => (req: any, res: any, next: any) => {
    next();
  }),
}));

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Auth Routes', () => {
  let app: express.Application;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    mockSessionManager = {
      createSession: vi.fn(),
      getSession: vi.fn(),
      removeSession: vi.fn(),
      verifyTotpCode: vi.fn(),
      generateJwtToken: vi.fn(),
      getHostId: vi.fn().mockReturnValue('12345678'),
    } as any;

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(mockSessionManager));

    vi.clearAllMocks();
  });

  describe('POST /api/auth/sessions', () => {
    it('should create new session successfully', async () => {
      const mockSession = {
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockSessionManager.createSession.mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/auth/sessions')
        .expect(201);

      expect(response.body).toEqual({
        sessionId: 'TEST1234',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: mockSession.expiresAt.toISOString(),
      });

      expect(mockSessionManager.createSession).toHaveBeenCalledWith('12345678');
    });

    it('should handle session creation errors', async () => {
      mockSessionManager.createSession.mockImplementation(() => {
        throw new Error('Session creation failed');
      });

      const response = await request(app)
        .post('/api/auth/sessions')
        .expect(500);

      expect(response.body.error).toBe('Failed to create session');
    });
  });

  describe('POST /api/auth/sessions/:sessionId/verify', () => {
    it('should verify TOTP code successfully', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockSessionManager.verifyTotpCode.mockReturnValue(true);
      mockSessionManager.generateJwtToken.mockReturnValue('jwt-token-123');

      const response = await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({ totpCode: '123456' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        token: 'jwt-token-123',
        message: 'Authentication successful',
      });

      expect(mockSessionManager.verifyTotpCode).toHaveBeenCalledWith('TEST1234', '123456');
      expect(mockSessionManager.generateJwtToken).toHaveBeenCalledWith('TEST1234', '12345678');
    });

    it('should reject invalid TOTP code', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockSessionManager.verifyTotpCode.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({ totpCode: '000000' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid TOTP code',
      });

      expect(mockSessionManager.generateJwtToken).not.toHaveBeenCalled();
    });

    it('should reject missing TOTP code', async () => {
      const response = await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('TOTP code is required');
    });

    it('should reject invalid TOTP code format', async () => {
      const response = await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({ totpCode: '12345' }) // Too short
        .expect(400);

      expect(response.body.error).toBe('TOTP code must be 6 digits');
    });

    it('should reject non-numeric TOTP code', async () => {
      const response = await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({ totpCode: 'abcdef' })
        .expect(400);

      expect(response.body.error).toBe('TOTP code must be 6 digits');
    });

    it('should handle verification errors', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockSessionManager.verifyTotpCode.mockImplementation(() => {
        throw new Error('Verification failed');
      });

      const response = await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({ totpCode: '123456' })
        .expect(500);

      expect(response.body.error).toBe('Failed to verify authentication');
    });
  });

  describe('GET /api/auth/sessions/:sessionId', () => {
    it('should return session info successfully', async () => {
      const mockSession = {
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        lastActivity: new Date('2024-01-01T12:00:00Z'),
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);

      const response = await request(app)
        .get('/api/auth/sessions/TEST1234')
        .expect(200);

      expect(response.body).toEqual({
        sessionId: 'TEST1234',
        hostId: '12345678',
        expiresAt: '2024-12-31T23:59:59.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T12:00:00.000Z',
        isValid: true,
      });
    });

    it('should handle non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const response = await request(app)
        .get('/api/auth/sessions/NONEXIST')
        .expect(404);

      expect(response.body.error).toBe('Session not found');
    });

    it('should handle session retrieval errors', async () => {
      mockSessionManager.getSession.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/auth/sessions/TEST1234')
        .expect(500);

      expect(response.body.error).toBe('Failed to get session');
    });
  });

  describe('DELETE /api/auth/sessions/:sessionId', () => {
    it('should delete session successfully', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockSessionManager.removeSession.mockReturnValue(true);

      const response = await request(app)
        .delete('/api/auth/sessions/TEST1234')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Session deleted successfully',
      });

      expect(mockSessionManager.removeSession).toHaveBeenCalledWith('TEST1234');
    });

    it('should handle session deletion errors', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockSessionManager.removeSession.mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      const response = await request(app)
        .delete('/api/auth/sessions/TEST1234')
        .expect(500);

      expect(response.body.error).toBe('Failed to delete session');
    });
  });

  describe('Logging', () => {
    it('should log successful session creation', async () => {
      const logger = await import('../utils/logger');
      const mockSession = {
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockSessionManager.createSession.mockReturnValue(mockSession);

      await request(app)
        .post('/api/auth/sessions')
        .expect(201);

      expect(logger.default.info).toHaveBeenCalledWith('New session created', {
        sessionId: 'TEST1234',
        hostId: '12345678',
      });
    });

    it('should log successful authentication', async () => {
      const logger = await import('../utils/logger');
      mockSessionManager.getSession.mockReturnValue({
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockSessionManager.verifyTotpCode.mockReturnValue(true);
      mockSessionManager.generateJwtToken.mockReturnValue('jwt-token-123');

      await request(app)
        .post('/api/auth/sessions/TEST1234/verify')
        .send({ totpCode: '123456' })
        .expect(200);

      expect(logger.default.info).toHaveBeenCalledWith('Authentication successful', {
        sessionId: 'TEST1234',
        hostId: '12345678',
      });
    });

    it('should log errors', async () => {
      const logger = await import('../utils/logger');
      mockSessionManager.createSession.mockImplementation(() => {
        throw new Error('Test error');
      });

      await request(app)
        .post('/api/auth/sessions')
        .expect(500);

      expect(logger.default.error).toHaveBeenCalledWith('Failed to create session', {
        error: 'Test error',
      });
    });
  });
});