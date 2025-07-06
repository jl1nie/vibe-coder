import { Router } from 'express';
import { SessionManager } from '../services/session-manager';
import { createSessionValidationMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import logger from '../utils/logger';

export function createAuthRouter(sessionManager: SessionManager): Router {
  const router = Router();
  const sessionValidation = createSessionValidationMiddleware(sessionManager);

  // Create new session and get TOTP secret for 2FA setup
  router.post('/sessions', asyncHandler(async (_req, res) => {
    const { sessionId, totpSecret } = await sessionManager.createSession();
    
    res.status(201).json({
      sessionId,
      hostId: sessionManager.getHostId(),
      totpSecret,
      message: 'Enter the TOTP secret in your authenticator app, then provide TOTP code',
    });
  }));

  // Verify TOTP and get JWT token
  router.post('/sessions/:sessionId/verify', 
    sessionValidation,
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      const { totpCode } = req.body;

      if (!totpCode) {
        return res.status(400).json({ error: 'TOTP code is required' });
      }

      const verified = sessionManager.verifyTotp(sessionId, totpCode);
      
      if (!verified) {
        logger.warn('TOTP verification failed', { sessionId, ip: req.ip });
        return res.status(401).json({ error: 'Invalid TOTP code' });
      }

      const token = sessionManager.generateJwtToken(sessionId);
      
      res.json({
        success: true,
        token,
        message: 'Authentication successful',
      });
    })
  );

  // Get session status
  router.get('/sessions/:sessionId/status',
    sessionValidation,
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      const session = sessionManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        sessionId: session.id,
        hostId: session.hostId,
        isAuthenticated: session.isAuthenticated,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
      });
    })
  );

  // Refresh session (extend expiry)
  router.post('/sessions/:sessionId/refresh',
    sessionValidation,
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      const session = sessionManager.getSession(sessionId);
      
      if (!session || !session.isAuthenticated) {
        return res.status(401).json({ error: 'Session not authenticated' });
      }

      // Extend session by 24 hours
      session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      session.lastActivity = new Date();

      const newToken = sessionManager.generateJwtToken(sessionId);
      
      res.json({
        success: true,
        token: newToken,
        expiresAt: session.expiresAt,
      });
    })
  );

  // Delete session (logout)
  router.delete('/sessions/:sessionId',
    sessionValidation,
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      
      sessionManager.removeSession(sessionId);
      
      res.json({
        success: true,
        message: 'Session deleted successfully',
      });
    })
  );

  return router;
}