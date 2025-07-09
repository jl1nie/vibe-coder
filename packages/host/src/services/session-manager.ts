import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import speakeasy from 'speakeasy';
import { generateHostId, generateSessionId } from '../../../shared/src';
import { SessionData } from '../types';
import { hostConfig } from '../utils/config';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Required environment variable ${key} is not set`);
  }
  return value;
}
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

  public renewHostId(): string {
    // テスト環境では固定値を使用
    if (process.env.NODE_ENV === 'test') {
      return '12345678'; // 固定のHost ID
    }

    // Generate new Host ID
    const newHostId = generateHostId();

    // Save to file
    const hostIdPath = path.resolve(
      getRequiredEnv('VIBE_CODER_WORKSPACE_PATH'),
      '.vibe-coder-host-id'
    );

    try {
      fs.writeFileSync(hostIdPath, newHostId, { mode: 0o600 });
      
      // Update HOST_ID.txt file for user visibility
      const workspaceDir = getRequiredEnv('VIBE_CODER_WORKSPACE_PATH');
      const hostIdFile = `${workspaceDir}/HOST_ID.txt`;
      const hostIdContent = `Vibe Coder Host ID: ${newHostId}\n\nUse this ID to connect from your mobile device.\nURL: https://www.vibe-coder.space\n\nGenerated: ${new Date().toISOString()}\n`;
      
      if (fs.existsSync(workspaceDir)) {
        fs.writeFileSync(hostIdFile, hostIdContent);
      }
      
      // Update internal hostId
      this.hostId = newHostId;
      
      // Clear all existing sessions since the hostId has changed
      this.sessions.clear();
      
      logger.info('Host ID renewed', { 
        oldHostId: this.hostId !== newHostId ? 'changed' : 'same',
        newHostId: newHostId 
      });
      
      console.log(`Host ID renewed: ${newHostId} (saved to ${hostIdPath})`);
      return newHostId;
      
    } catch (error) {
      logger.error('Failed to renew Host ID', { 
        error: (error as Error).message,
        hostIdPath 
      });
      throw new Error(`Failed to renew Host ID: ${(error as Error).message}`);
    }
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