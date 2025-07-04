export const VIBE_CODER_VERSION = '0.1.0';

export const DEFAULT_PORTS = {
  HOST: 3000,
  WEBSOCKET: 8080,
  DEV_SERVER: 5173,
} as const;

export const WEBSOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SIGNAL: 'signal',
  COMMAND: 'command',
  OUTPUT: 'output',
  ERROR: 'error',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
} as const;

export const COMMAND_CATEGORIES = {
  DEVELOPMENT: 'development',
  SECURITY: 'security',
  TESTING: 'testing',
  DEPLOYMENT: 'deployment',
  DEBUGGING: 'debugging',
  CUSTOM: 'custom',
} as const;

export const SUPPORTED_LANGUAGES = [
  'ja-JP',
  'en-US',
  'ko-KR',
  'zh-CN',
  'es-ES',
  'fr-FR',
  'de-DE',
] as const;

export const SECURITY_LIMITS = {
  MAX_COMMAND_LENGTH: 1000,
  MAX_SESSION_TIME: 3600000, // 1 hour in ms
  MAX_CONCURRENT_SESSIONS: 5,
  RATE_LIMIT_PER_SECOND: 10,
  RATE_LIMIT_PER_MINUTE: 100,
  RATE_LIMIT_PER_HOUR: 1000,
} as const;

export const DANGEROUS_PATTERNS = [
  /rm\s+-rf?\s*[\/\*]/,
  /sudo\s+(?!claude-code)/,
  /eval\s*\(/,
  /exec\s*\(/,
  /system\s*\(/,
  /curl.*\|\s*sh/,
  /wget.*\|\s*sh/,
  /\$\(.*\)/,
  /`.*`/,
  />\s*\/dev\/null/,
  /chmod\s+777/,
  /chown\s+root/,
] as const;

export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
} as const;

export const ERROR_CODES = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  WEBRTC_ERROR: 'WEBRTC_ERROR',
  
  // Security errors
  COMMAND_BLOCKED: 'COMMAND_BLOCKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  MAX_SESSIONS_REACHED: 'MAX_SESSIONS_REACHED',
  
  // Command errors
  COMMAND_FAILED: 'COMMAND_FAILED',
  COMMAND_TIMEOUT: 'COMMAND_TIMEOUT',
  INVALID_COMMAND: 'INVALID_COMMAND',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export const MIME_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  CSS: 'text/css',
  JS: 'application/javascript',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  SVG: 'image/svg+xml',
} as const;