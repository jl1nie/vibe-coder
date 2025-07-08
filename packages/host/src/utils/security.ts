import { isCommandSafe, SECURITY_CONFIG } from '../../../shared/src';
import logger from './logger';

export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

export function validateCommand(command: string): SecurityValidationResult {
  if (!command || typeof command !== 'string') {
    return {
      isValid: false,
      reason: 'Command must be a non-empty string',
    };
  }

  const trimmedCommand = command.trim();
  
  if (trimmedCommand.length === 0) {
    return {
      isValid: false,
      reason: 'Command cannot be empty',
    };
  }

  // Check against dangerous patterns
  if (!isCommandSafe(trimmedCommand)) {
    logger.warn('Blocked dangerous command', { command: trimmedCommand });
    return {
      isValid: false,
      reason: 'Command contains dangerous patterns and has been blocked for security',
    };
  }

  // Allow Claude interactive commands (/help, /exit)
  if (trimmedCommand.startsWith('/help') || trimmedCommand.startsWith('/exit')) {
    return {
      isValid: true,
      sanitizedCommand: trimmedCommand,
      reason: 'Claude interactive command allowed'
    };
  }

  // Check if command starts with an allowed command
  const commandStart = trimmedCommand.split(' ')[0];
  const isAllowed = SECURITY_CONFIG.allowedCommands.some(allowedCmd => 
    commandStart === allowedCmd || trimmedCommand.startsWith(allowedCmd + ' ')
  );
  
  if (!isAllowed) {
    return {
      isValid: false,
      reason: `Command '${commandStart}' is not allowed. Only allowed commands: ${SECURITY_CONFIG.allowedCommands.join(', ')}`,
    };
  }

  // Transform claude commands to non-interactive mode
  let transformedCommand = trimmedCommand;
  
  // Convert 'claude-code' to 'claude --print' (claude-code is legacy name)
  if (transformedCommand.startsWith('claude-code ')) {
    transformedCommand = transformedCommand.replace('claude-code ', 'claude --print ');
  }
  // Convert 'claude' to 'claude --print' if it doesn't already have --print or special flags
  else if (transformedCommand.startsWith('claude ') && 
           !transformedCommand.includes('--print') && 
           !transformedCommand.includes('--help') &&
           !transformedCommand.includes('--version') &&
           !transformedCommand.includes('config') &&
           !transformedCommand.includes('auth')) {
    transformedCommand = transformedCommand.replace('claude ', 'claude --print ');
  }

  return {
    isValid: true,
    sanitizedCommand: transformedCommand,
  };
}

export function sanitizeOutput(output: string): string {
  // Remove potentially sensitive information from output
  return output
    .replace(/sk-[a-zA-Z0-9]{48}/g, '[REDACTED_API_KEY]') // Anthropic API keys
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]') // GitHub tokens
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]') // Email addresses
    .replace(/(?:password|passwd|pwd)[\s=:]+\S+/gi, 'password=[REDACTED]'); // Passwords
}

export function generateSessionSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isValidSessionId(sessionId: string): boolean {
  return /^[A-Z0-9]{8}$/.test(sessionId);
}

export function isValidHostId(hostId: string): boolean {
  return /^[0-9]{8}$/.test(hostId);
}

export function rateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  // Simple in-memory rate limiting
  // In production, use Redis or similar
  const now = Date.now();
  const key = `rateLimit:${identifier}`;
  
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }
  
  const store = global.rateLimitStore;
  const record = store.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }
  
  store.set(key, record);
  
  return record.count <= maxRequests;
}

declare global {
  // eslint-disable-next-line no-var
  var rateLimitStore: Map<string, { count: number; resetTime: number }> | undefined;
}