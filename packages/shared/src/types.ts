export interface Command {
  id: string;
  icon: string;
  label: string;
  description: string;
  command: string;
  category?: string;
  tags?: string[];
  isCustom?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  commands: Command[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  downloadCount?: number;
  rating?: number;
}

export interface PlaylistSchema {
  schema: 'vibe-coder-playlist-v1';
  metadata: {
    name: string;
    description: string;
    author: string;
    version: string;
    tags: string[];
  };
  commands: Command[];
}

export interface WebRTCSignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'close';
  serverId: string;
  clientId: string;
  data: any;
  timestamp: number;
}

export interface ClaudeSession {
  id: string;
  workspaceDir: string;
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
  commands: SessionCommand[];
}

export interface SessionCommand {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  timestamp: string;
  duration: number;
}

export interface TerminalOutput {
  type: 'stdout' | 'stderr' | 'exit' | 'error';
  data: string;
  timestamp: number;
  sessionId: string;
}

export interface SecurityConfig {
  maxCommandLength: number;
  allowedCommands: string[];
  blockedPatterns: RegExp[];
  rateLimits: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
}

export interface HostConfig {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  maxSessions: number;
  workspaceDir: string;
  signalServerUrl: string;
}

export interface ClientConfig {
  serverUrl: string;
  retryAttempts: number;
  timeout: number;
  enableVoiceRecognition: boolean;
  preferredLanguage: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}