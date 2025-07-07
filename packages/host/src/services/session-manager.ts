import { generateSessionId } from '../../../shared/src';
import speakeasy from 'speakeasy';
import jwt from 'jsonwebtoken';
import { SessionData } from '../types';
import { hostConfig } from '../utils/config';
import logger from '../utils/logger';

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private hostId: string;
  private cleanupInterval!: NodeJS.Timeout;

  constructor() {
    this.hostId = hostConfig.hostId;
    this.startCleanupTimer();
    logger.info('Session Manager initialized', { hostId: this.hostId });
  }

  public getHostId(): string {
    return this.hostId;
  }

  public async createSession(): Promise<{ sessionId: string; totpSecret: string }> {
    const sessionId = generateSessionId();
    
    // Use persistent TOTP secret from config (shared across all sessions)
    const totpSecret = hostConfig.totpSecret;

    const session: SessionData = {
      id: sessionId,
      hostId: this.hostId,
      totpSecret: totpSecret,
      isAuthenticated: false,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    this.sessions.set(sessionId, session);
    
    logger.info('Session created', { sessionId, hostId: this.hostId });
    
    return { sessionId, totpSecret };
  }

  public verifyTotp(sessionId: string, token: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('TOTP verification failed: session not found', { sessionId });
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: session.totpSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (verified) {
      session.isAuthenticated = true;
      session.lastActivity = new Date();
      logger.info('TOTP verification successful', { sessionId });
    } else {
      logger.warn('TOTP verification failed: invalid token', { sessionId });
    }

    return verified;
  }

  public generateJwtToken(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isAuthenticated) {
      throw new Error('Session not authenticated');
    }

    return jwt.sign(
      {
        sessionId,
        hostId: this.hostId,
        exp: Math.floor(session.expiresAt.getTime() / 1000),
      },
      hostConfig.sessionSecret
    );
  }

  public verifyJwtToken(token: string): { sessionId: string; hostId: string } | null {
    try {
      const decoded = jwt.verify(token, hostConfig.sessionSecret) as any;
      
      const session = this.sessions.get(decoded.sessionId);
      if (!session || !session.isAuthenticated) {
        return null;
      }

      // Update last activity
      session.lastActivity = new Date();
      
      return {
        sessionId: decoded.sessionId,
        hostId: decoded.hostId,
      };
    } catch (error) {
      logger.warn('JWT verification failed', { error: (error as Error).message });
      return null;
    }
  }

  public getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  public updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  public removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info('Session removed', { sessionId });
  }

  public getActiveSessions(): SessionData[] {
    return Array.from(this.sessions.values()).filter(
      session => session.isAuthenticated && new Date() < session.expiresAt
    );
  }

  public getTotalSessions(): number {
    return this.sessions.size;
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: cleanedCount });
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}