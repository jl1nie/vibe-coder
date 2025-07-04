import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createLogger } from '../utils/logger';
import { Environment } from '../utils/env';

const logger = createLogger('security');

// レート制限の設定
export function createRateLimiter(env: Environment) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: {
      error: 'Too many requests',
      message: `Rate limit exceeded. Max ${env.RATE_LIMIT_MAX_REQUESTS} requests per ${env.RATE_LIMIT_WINDOW_MS / 1000} seconds`,
      retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
      });
    },
    skip: (req: Request) => {
      // 健康チェックエンドポイントはスキップ
      if (req.path === '/health' || req.path === '/ping') {
        return true;
      }
      return false;
    },
  });
}

// Helmetセキュリティヘッダーの設定
export function createSecurityHeaders(env: Environment) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
  });
}

// CORS設定
export function createCorsOptions(env: Environment) {
  const origins = env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  
  return {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // 開発環境では Origin なしを許可
      if (!origin && env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      if (!origin || origins.includes('*') || origins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS origin blocked', { origin, allowedOrigins: origins });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Version'],
    exposedHeaders: ['X-Request-ID'],
  };
}

// リクエストサイズ制限
export function createBodyParser() {
  return {
    json: { limit: '10mb' },
    urlencoded: { limit: '10mb', extended: true },
  };
}

// セキュリティ監査ログ
export function securityAuditLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // レスポンス完了時にログ出力
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      contentLength: res.get('content-length'),
      referrer: req.get('referrer'),
    };

    // セキュリティ関連のイベントを記録
    if (res.statusCode >= 400) {
      logger.warn('Security audit: HTTP error', logData);
    } else if (req.path.includes('admin') || req.path.includes('config')) {
      logger.info('Security audit: Sensitive path access', logData);
    } else {
      logger.debug('Security audit: Request', logData);
    }
  });

  next();
}

// IPアドレス検証
export function validateClientIP(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip;
  
  // 内部IPアドレスの検証
  if (isInternalIP(clientIP)) {
    logger.debug('Internal IP access', { ip: clientIP, path: req.path });
  } else {
    logger.debug('External IP access', { ip: clientIP, path: req.path });
  }
  
  // 悪意のあるIPアドレスのブロック（簡易実装）
  if (isBlockedIP(clientIP)) {
    logger.warn('Blocked IP address access attempt', { ip: clientIP, path: req.path });
    return res.status(403).json({ error: 'Access forbidden' });
  }
  
  next();
}

// 内部IPアドレスの判定
function isInternalIP(ip: string): boolean {
  const internalRanges = [
    /^127\./,           // localhost
    /^192\.168\./,      // Private network
    /^10\./,            // Private network
    /^172\.(1[6-9]|2\d|3[01])\./,  // Private network
    /^::1$/,            // IPv6 localhost
    /^fc00:/,           // IPv6 private
  ];
  
  return internalRanges.some(range => range.test(ip));
}

// ブロックされたIPアドレスの判定
function isBlockedIP(ip: string): boolean {
  // 実際の実装では、データベースやRedisからブロックリストを取得
  const blockedIPs = new Set([
    // 例: 悪意のあるIPアドレス
  ]);
  
  return blockedIPs.has(ip);
}

// APIキー検証
export function validateAPIKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.get('x-api-key') || req.query.apiKey;
  
  if (!apiKey) {
    logger.warn('API request without key', { 
      ip: req.ip, 
      path: req.path,
      userAgent: req.get('user-agent')
    });
    return res.status(401).json({ error: 'API key required' });
  }
  
  // APIキーの検証（実際の実装では暗号化されたキーを使用）
  if (!isValidAPIKey(apiKey as string)) {
    logger.warn('Invalid API key', { 
      ip: req.ip, 
      path: req.path,
      keyPrefix: (apiKey as string).substring(0, 8) + '...'
    });
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}

// APIキーの検証
function isValidAPIKey(key: string): boolean {
  // 実際の実装では、ハッシュ化されたAPIキーをデータベースで検証
  const validKeys = new Set([
    // 開発用のAPIキー
    'vibe-coder-dev-key-123',
  ]);
  
  return validKeys.has(key);
}

// WebSocketセキュリティ
export function validateWebSocketOrigin(origin: string, env: Environment): boolean {
  const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());
  
  if (allowedOrigins.includes('*')) {
    return true;
  }
  
  return allowedOrigins.includes(origin);
}

// コマンドインジェクション防止
export function sanitizeCommand(command: string): string {
  // 危険な文字列を削除
  const dangerous = [
    '&', '|', ';', '$', '`', '(', ')', 
    '<', '>', '"', "'", '\\', '\n', '\r'
  ];
  
  let sanitized = command;
  dangerous.forEach(char => {
    sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), '');
  });
  
  return sanitized.trim();
}

// ファイルパス検証
export function validateFilePath(filePath: string, allowedDir: string): boolean {
  const normalizedPath = require('path').normalize(filePath);
  const normalizedAllowedDir = require('path').normalize(allowedDir);
  
  // パストラバーサル攻撃を防止
  if (normalizedPath.includes('..')) {
    return false;
  }
  
  // 許可されたディレクトリ内かチェック
  return normalizedPath.startsWith(normalizedAllowedDir);
}

// セキュリティイベントの記録
export function logSecurityEvent(event: string, details: any) {
  logger.warn(`Security event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

// CSRFトークン検証（WebSocketには適用されない）
export function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  // GET、HEAD、OPTIONS以外のリクエストでCSRFトークンを検証
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.get('x-csrf-token') || req.body.csrfToken;
  
  if (!token) {
    logger.warn('CSRF token missing', { 
      ip: req.ip, 
      path: req.path,
      method: req.method 
    });
    return res.status(403).json({ error: 'CSRF token required' });
  }
  
  // トークンの検証（実際の実装では、セッションとの照合）
  if (!isValidCSRFToken(token)) {
    logger.warn('Invalid CSRF token', { 
      ip: req.ip, 
      path: req.path,
      method: req.method 
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

// CSRFトークンの検証
function isValidCSRFToken(token: string): boolean {
  // 実際の実装では、セッションストアからトークンを検証
  // 簡易実装として、固定の形式をチェック
  return /^csrf-[a-f0-9]{32}$/.test(token);
}