import { Request } from 'express';
import { WebSocket } from 'ws';

export interface AuthenticatedRequest extends Request {
  sessionId?: string;
  hostId?: string;
}

export interface WebSocketWithSessionId extends WebSocket {
  sessionId?: string;
  hostId?: string;
  isAlive?: boolean;
}

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  executionTime: number;
}

export interface HostConfig {
  port: number;
  claudeConfigPath: string;
  signalingUrl: string;
  sessionSecret: string;
  maxConcurrentSessions: number;
  commandTimeout: number;
  enableSecurity: boolean;
  logLevel: string;
  hostId: string;
}

export interface SessionData {
  id: string;
  hostId: string;
  clientId?: string;
  totpSecret: string;
  isAuthenticated: boolean;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface CommandExecution {
  id: string;
  sessionId: string;
  command: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: ClaudeCodeResult;
}

export interface WebRTCPeerConnection {
  sessionId: string;
  peer: any; // SimplePeer instance
  isConnected: boolean;
  createdAt: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  sessions: {
    active: number;
    total: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  claude: {
    available: boolean;
    lastCheck: Date;
  };
}