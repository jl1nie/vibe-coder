export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

export function validateCommand(command: string): SecurityValidationResult {
  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return {
      isValid: false,
      reason: 'Command must be a non-empty string',
    };
  }
  return {
    isValid: true,
    sanitizedCommand: command.trim(),
  };
}

export function sanitizeOutput(output: string): string {
  // Remove potentially sensitive information from output
  return output
    .replace(/sk-[a-zA-Z0-9]{40,}/g, '[REDACTED_API_KEY]') // Anthropic API keys (flexible length)
    .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED_GITHUB_TOKEN]') // GitHub tokens (flexible length)
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[REDACTED_EMAIL]'
    ) // Email addresses
    .replace(/(?:password|passwd|pwd)[\s=:]+\S+/gi, 'password=[REDACTED]'); // Passwords
}

export function generateSessionSecret(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && /^[A-Z0-9]{8}$/.test(sessionId);
}

export function isValidHostId(hostId: string): boolean {
  return typeof hostId === 'string' && /^[0-9]{8}$/.test(hostId);
}

export function rateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): boolean {
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
  var rateLimitStore:
    | Map<string, { count: number; resetTime: number }>
    | undefined;
}
