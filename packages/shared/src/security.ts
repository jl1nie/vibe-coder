import { DANGEROUS_PATTERNS, SECURITY_LIMITS } from './constants';
import { createError, ERROR_CODES } from './utils';

export class SecurityValidator {
  private static instance: SecurityValidator;
  private rateLimitMap = new Map<string, number[]>();

  public static getInstance(): SecurityValidator {
    if (!SecurityValidator.instance) {
      SecurityValidator.instance = new SecurityValidator();
    }
    return SecurityValidator.instance;
  }

  public validateCommand(command: string): boolean {
    // 長さ制限
    if (command.length > SECURITY_LIMITS.MAX_COMMAND_LENGTH) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        `Command too long: ${command.length} > ${SECURITY_LIMITS.MAX_COMMAND_LENGTH}`
      );
    }

    // 危険パターンチェック
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        throw createError(
          ERROR_CODES.COMMAND_BLOCKED,
          `Dangerous pattern detected: ${pattern.source}`,
          { command: this.sanitizeCommand(command) }
        );
      }
    }

    // ASCII文字のみ許可
    if (!/^[\x20-\x7E\s]*$/.test(command)) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Non-ASCII characters not allowed'
      );
    }

    // 空のコマンドは拒否
    if (command.trim().length === 0) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Empty command not allowed'
      );
    }

    return true;
  }

  public checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const requests = this.rateLimitMap.get(identifier) || [];
    
    // 1秒以内のリクエストを除去
    const recentRequests = requests.filter(
      timestamp => now - timestamp < 1000
    );

    if (recentRequests.length >= SECURITY_LIMITS.RATE_LIMIT_PER_SECOND) {
      throw createError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded: too many requests per second',
        { identifier, requestCount: recentRequests.length }
      );
    }

    // 新しいリクエストを追加
    recentRequests.push(now);
    this.rateLimitMap.set(identifier, recentRequests);

    return true;
  }

  public sanitizeCommand(command: string): string {
    // ログ出力用にコマンドをサニタイズ
    return command
      .replace(/(['"`;$\\])/g, '\\$1')
      .substring(0, 100);
  }

  public isClaudeCodeCommand(command: string): boolean {
    const trimmed = command.trim();
    return trimmed.startsWith('claude-code') || 
           trimmed.startsWith('claude') ||
           trimmed.startsWith('npm ') ||
           trimmed.startsWith('pnpm ') ||
           trimmed.startsWith('yarn ') ||
           trimmed.startsWith('git ') ||
           trimmed.startsWith('ls') ||
           trimmed.startsWith('pwd') ||
           trimmed.startsWith('cat ') ||
           trimmed.startsWith('head ') ||
           trimmed.startsWith('tail ');
  }

  public validateFileName(fileName: string): boolean {
    // ファイル名の検証
    if (fileName.length > 255) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Filename too long'
      );
    }

    // 危険な文字の検出
    if (/[<>:"|?*\x00-\x1f]/.test(fileName)) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid characters in filename'
      );
    }

    // 予約語チェック
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(fileName.toUpperCase())) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Reserved filename not allowed'
      );
    }

    return true;
  }

  public validateImageUpload(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid file type for image upload'
      );
    }

    if (file.size > maxSize) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'File too large for upload'
      );
    }

    return true;
  }

  public cleanupRateLimitMap(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [identifier, requests] of this.rateLimitMap.entries()) {
      const recentRequests = requests.filter(
        timestamp => timestamp > oneHourAgo
      );

      if (recentRequests.length === 0) {
        this.rateLimitMap.delete(identifier);
      } else {
        this.rateLimitMap.set(identifier, recentRequests);
      }
    }
  }
}

export const securityValidator = SecurityValidator.getInstance();

export const validateCommand = (command: string): boolean => {
  return securityValidator.validateCommand(command);
};

export const checkRateLimit = (identifier: string): boolean => {
  return securityValidator.checkRateLimit(identifier);
};

export const sanitizeCommand = (command: string): string => {
  return securityValidator.sanitizeCommand(command);
};

export const isClaudeCodeCommand = (command: string): boolean => {
  return securityValidator.isClaudeCodeCommand(command);
};

// CSP設定
export const getContentSecurityPolicy = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "font-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
};

// セキュリティヘッダー
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'Content-Security-Policy': getContentSecurityPolicy(),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
};