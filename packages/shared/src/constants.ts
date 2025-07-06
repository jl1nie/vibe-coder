export const SIGNALING_SERVER_URL = 'https://signal.vibe-coder.space';
export const PWA_URL = 'https://vibe-coder.space';

export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const SESSION_CONFIG = {
  expirationTime: 24 * 60 * 60 * 1000, // 24 hours
  maxRetries: 3,
  retryDelay: 1000,
};

export const COMMAND_TIMEOUT = 30000; // 30 seconds
export const CONNECTION_TIMEOUT = 10000; // 10 seconds
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const DEFAULT_PLAYLIST: {
  schema: 'vibe-coder-playlist-v1';
  metadata: {
    name: string;
    description: string;
    author: string;
    version: string;
    tags: string[];
  };
  commands: Array<{
    icon: string;
    label: string;
    command: string;
    description: string;
  }>;
} = {
  schema: 'vibe-coder-playlist-v1',
  metadata: {
    name: 'Claude Code Essentials',
    description: 'Essential commands for Claude Code development',
    author: 'Claude Team',
    version: '1.0.0',
    tags: ['claude-code', 'development', 'essential'],
  },
  commands: [
    {
      icon: '🔐',
      label: 'Login',
      command: 'add user authentication with login and signup',
      description: 'Add authentication system to the project',
    },
    {
      icon: '🐛',
      label: 'Fix Bug',
      command: 'find and fix the bug in this code',
      description: 'Analyze and fix bugs in the current codebase',
    },
    {
      icon: '📱',
      label: 'Mobile',
      command: 'make this responsive for mobile devices',
      description: 'Optimize the UI for mobile devices',
    },
    {
      icon: '🧪',
      label: 'Test',
      command: 'write unit tests for this component',
      description: 'Generate comprehensive unit tests',
    },
    {
      icon: '🎨',
      label: 'Style',
      command: 'improve the UI design and styling',
      description: 'Enhance the visual design and user experience',
    },
    {
      icon: '⚡',
      label: 'Optimize',
      command: 'optimize performance and loading speed',
      description: 'Improve application performance',
    },
    {
      icon: '📝',
      label: 'Docs',
      command: 'add documentation and comments',
      description: 'Generate documentation and code comments',
    },
    {
      icon: '🔄',
      label: 'Refactor',
      command: 'refactor this code for better readability',
      description: 'Improve code structure and maintainability',
    },
    {
      icon: '🌙',
      label: 'Dark Mode',
      command: 'add dark mode support',
      description: 'Implement dark mode theme',
    },
    {
      icon: '📊',
      label: 'API',
      command: 'create a REST API endpoint',
      description: 'Build RESTful API endpoints',
    },
  ],
};

export const VOICE_RECOGNITION_CONFIG = {
  lang: 'ja-JP',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
};

export const TERMINAL_CONFIG = {
  theme: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#00ff00',
  },
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  cursorBlink: true,
  scrollback: 1000,
};

export const SECURITY_CONFIG = {
  allowedCommands: [
    'claude',
    'claude-code',
    'echo', // for testing
    'npm',
    'yarn',
    'pnpm',
    'git',
    'ls',
    'cat',
    'pwd',
    'cd',
  ],
  dangerousPatterns: [
    'rm -rf',
    'sudo',
    'su',
    'chmod',
    'chown',
    'kill',
    'killall',
    'pkill',
    '> /dev/null',
    '&& rm',
    '|| rm',
    '; rm',
  ],
};

export const ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Failed to connect to host',
  INVALID_SESSION: 'Invalid session ID',
  AUTHENTICATION_FAILED: 'Authentication failed',
  COMMAND_TIMEOUT: 'Command execution timeout',
  VOICE_NOT_SUPPORTED: 'Voice recognition not supported',
  WEBRTC_NOT_SUPPORTED: 'WebRTC not supported',
  DANGEROUS_COMMAND: 'Command blocked for security reasons',
} as const;