import { SECURITY_CONFIG } from './constants';

export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function generateHostId(): string {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
}

export function isValidSessionId(sessionId: string): boolean {
  return /^[A-Z0-9]{8}$/.test(sessionId);
}

export function isValidHostId(hostId: string): boolean {
  return /^[0-9]{8}$/.test(hostId);
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ja-JP', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function sanitizeCommand(command: string): string {
  return command.trim().replace(/[;&|`${}()]/g, '');
}

export function isCommandSafe(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  
  // Check for dangerous patterns
  for (const pattern of SECURITY_CONFIG.dangerousPatterns) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  // Check if command starts with allowed commands
  const firstWord = command.split(' ')[0];
  if (!SECURITY_CONFIG.allowedCommands.includes(firstWord)) {
    return false;
  }
  
  return true;
}

export function validatePlaylistJSON(json: any): boolean {
  try {
    if (!json || typeof json !== 'object') return false;
    if (json.schema !== 'vibe-coder-playlist-v1') return false;
    if (!json.metadata || !json.commands) return false;
    if (!Array.isArray(json.commands)) return false;
    
    // Validate each command
    for (const command of json.commands) {
      if (!command.icon || !command.label || !command.command) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let retryCount = 0;
    
    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          reject(error);
        } else {
          setTimeout(attempt, delay);
        }
      }
    };
    
    attempt();
  });
}

export function createLogger(prefix: string) {
  return {
    info: (message: string, ...args: any[]) => {
      console.log(`[${prefix}] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${prefix}] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${prefix}] ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.DEBUG?.includes(prefix) || process.env.DEBUG === '*') {
        console.log(`[${prefix}] ${message}`, ...args);
      }
    },
  };
}

export function parseClaudeCodeCommand(input: string): string {
  const trimmed = input.trim();
  
  // If it already starts with claude-code, return as is
  if (trimmed.startsWith('claude-code')) {
    return trimmed;
  }
  
  // Wrap in claude-code command
  return `claude-code "${trimmed}"`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function createEventEmitter<T extends Record<string, any>>() {
  const listeners: Partial<{ [K in keyof T]: Array<(data: T[K]) => void> }> = {};
  
  return {
    on<K extends keyof T>(event: K, listener: (data: T[K]) => void) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event]!.push(listener);
    },
    
    off<K extends keyof T>(event: K, listener: (data: T[K]) => void) {
      if (listeners[event]) {
        listeners[event] = listeners[event]!.filter(l => l !== listener);
      }
    },
    
    emit<K extends keyof T>(event: K, data: T[K]) {
      if (listeners[event]) {
        listeners[event]!.forEach(listener => listener(data));
      }
    },
    
    once<K extends keyof T>(event: K, listener: (data: T[K]) => void) {
      const onceListener = (data: T[K]) => {
        listener(data);
        this.off(event, onceListener);
      };
      this.on(event, onceListener);
    },
  };
}