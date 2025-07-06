import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { SessionManager } from '../services/session-manager';
import { rateLimit } from '../utils/security';
import logger from '../utils/logger';

export function createAuthMiddleware(sessionManager: SessionManager) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const decoded = sessionManager.verifyJwtToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Rate limiting per session
    const identifier = `session:${decoded.sessionId}`;
    if (!rateLimit(identifier, 60, 60000)) { // 60 requests per minute
      logger.warn('Rate limit exceeded', { sessionId: decoded.sessionId });
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    req.sessionId = decoded.sessionId;
    req.hostId = decoded.hostId;
    
    // Update session activity
    sessionManager.updateSessionActivity(decoded.sessionId);
    
    next();
  };
}

export function createSessionValidationMiddleware(sessionManager: SessionManager) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (new Date() > session.expiresAt) {
      sessionManager.removeSession(sessionId);
      return res.status(410).json({ error: 'Session expired' });
    }

    next();
  };
}

export function authenticateSession(sessionManager: SessionManager) {
  return createAuthMiddleware(sessionManager);
}