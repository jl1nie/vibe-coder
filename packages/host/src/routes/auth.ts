import { Router } from 'express';
import { createSessionValidationMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { SessionManager } from '../services/session-manager';
import logger from '../utils/logger';

export function createAuthRouter(sessionManager: SessionManager): Router {
  const router = Router();
  const sessionValidation = createSessionValidationMiddleware(sessionManager);

  // Helper function to check if request is from localhost
  const isLocalhostRequest = (req: any): boolean => {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const forwardedFor = req.get('x-forwarded-for');
    
    return clientIp === '127.0.0.1' || 
           clientIp === '::1' || 
           clientIp === '::ffff:127.0.0.1' ||
           clientIp?.startsWith('127.') ||
           (!forwardedFor && clientIp === '::ffff:172.') || // Docker internal
           (!forwardedFor && clientIp?.startsWith('192.168.'));
  };

  // Localhost-only 2FA setup route (requires physical access to host)
  router.get('/setup', asyncHandler(async (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const forwardedFor = req.get('x-forwarded-for');
    
    // Check if request is from localhost
    const isLocalhost = isLocalhostRequest(req);
    
    if (!isLocalhost) {
      logger.warn('Unauthorized access attempt to 2FA setup', { 
        clientIp, 
        forwardedFor,
        userAgent: req.get('User-Agent') 
      });
      return res.status(403).json({ 
        error: 'Access denied. 2FA setup requires physical access to the host machine.' 
      });
    }

    const { sessionId, totpSecret } = await sessionManager.createSession();
    
    // Generate QR code URL for setup
    const totpUrl = `otpauth://totp/Vibe%20Coder:${sessionManager.getHostId()}?secret=${totpSecret}&issuer=Vibe%20Coder`;
    
    res.json({
      sessionId,
      hostId: sessionManager.getHostId(),
      totpSecret,
      totpUrl,
      message: 'Setup your 2FA authenticator with the provided secret, then use the mobile app to authenticate',
      setupInstructions: [
        '1. Scan the QR code with your authenticator app',
        '2. Or manually enter the TOTP secret',
        '3. Use the Vibe Coder PWA to connect with this Host ID',
        '4. Enter the 6-digit code from your authenticator'
      ]
    });
  }));

  // Renew Host ID (localhost only)
  router.post('/renew-host-id', asyncHandler(async (req, res) => {
    const isLocalhost = isLocalhostRequest(req);
    
    if (!isLocalhost) {
      logger.warn('Unauthorized access attempt to renew Host ID', { 
        clientIp: req.ip,
        userAgent: req.get('User-Agent') 
      });
      return res.status(403).json({ 
        error: 'Access denied. Host ID renewal requires physical access to the host machine.' 
      });
    }

    try {
      const newHostId = sessionManager.renewHostId();
      
      logger.info('Host ID renewed via API', { 
        newHostId,
        ip: req.ip 
      });
      
      res.json({
        success: true,
        newHostId,
        message: 'Host ID has been renewed successfully. All previous sessions have been invalidated.',
        warning: 'You will need to reconnect all mobile devices with the new Host ID.'
      });
    } catch (error) {
      logger.error('Failed to renew Host ID via API', { 
        error: (error as Error).message,
        ip: req.ip 
      });
      
      res.status(500).json({ 
        error: 'Failed to renew Host ID. Please try again.' 
      });
    }
  }));

  // Create new session - now requires pre-authorized Host ID
  router.post('/sessions', asyncHandler(async (req, res) => {
    const { hostId } = req.body;
    
    if (!hostId || hostId !== sessionManager.getHostId()) {
      logger.warn('Invalid Host ID attempt', { 
        providedHostId: hostId,
        actualHostId: sessionManager.getHostId(),
        ip: req.ip 
      });
      return res.status(404).json({ 
        error: 'Host ID not found. Please ensure you have the correct Host ID from your host server.' 
      });
    }

    const { sessionId, totpSecret } = await sessionManager.createSession();
    
    res.status(201).json({
      sessionId,
      hostId: sessionManager.getHostId(),
      totpSecret,
      message: 'Enter the 6-digit code from your authenticator app',
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