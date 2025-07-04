import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { Environment } from '../utils/env';

const logger = createLogger('error-handler');

// カスタムエラークラス
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// バリデーションエラー
export class ValidationError extends AppError {
  public field?: string;
  public value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, 400);
    this.field = field;
    this.value = value;
    this.code = 'VALIDATION_ERROR';
  }
}

// 認証エラー
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.code = 'AUTHENTICATION_ERROR';
  }
}

// 認可エラー
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
    this.code = 'AUTHORIZATION_ERROR';
  }
}

// リソースが見つからないエラー
export class NotFoundError extends AppError {
  public resource?: string;

  constructor(message: string, resource?: string) {
    super(message, 404);
    this.resource = resource;
    this.code = 'NOT_FOUND_ERROR';
  }
}

// レート制限エラー
export class RateLimitError extends AppError {
  public retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429);
    this.retryAfter = retryAfter;
    this.code = 'RATE_LIMIT_ERROR';
  }
}

// サービス利用不可エラー
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503);
    this.code = 'SERVICE_UNAVAILABLE';
  }
}

// エラーハンドラーミドルウェア
export function errorHandler(env: Environment) {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = res.get('X-Request-ID') || 'unknown';
    
    // エラーの詳細情報を収集
    const errorInfo = {
      requestId,
      name: error.name,
      message: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    // AppError（操作可能なエラー）の処理
    if (error instanceof AppError) {
      logger.warn('Operational error occurred', {
        ...errorInfo,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        code: error.code,
      });

      return res.status(error.statusCode).json({
        error: {
          message: error.message,
          code: error.code,
          requestId,
          ...(env.NODE_ENV === 'development' && { stack: error.stack }),
        },
      });
    }

    // 予期しないエラー（プログラムエラー）の処理
    logger.error('Unexpected error occurred', errorInfo);

    // 開発環境では詳細なエラー情報を返す
    if (env.NODE_ENV === 'development') {
      return res.status(500).json({
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          requestId,
        },
      });
    }

    // 本番環境では一般的なエラーメッセージを返す
    res.status(500).json({
      error: {
        message: 'Internal server error',
        requestId,
      },
    });
  };
}

// 404エラーハンドラー
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.path}`, 'route');
  next(error);
}

// 非同期エラーキャッチャー
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// バリデーションエラーハンドラー
export function validationErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Joi validation error
  if (error.isJoi) {
    const validationError = new ValidationError(
      error.details.map((detail: any) => detail.message).join(', ')
    );
    return next(validationError);
  }

  // Zod validation error
  if (error.name === 'ZodError') {
    const validationError = new ValidationError(
      error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ')
    );
    return next(validationError);
  }

  next(error);
}

// データベースエラーハンドラー
export function databaseErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // MongoDB error
  if (error.name === 'MongoError') {
    if (error.code === 11000) {
      const duplicateError = new ValidationError('Duplicate key error');
      return next(duplicateError);
    }
  }

  // PostgreSQL error
  if (error.code === '23505') {
    const duplicateError = new ValidationError('Duplicate key error');
    return next(duplicateError);
  }

  if (error.code === '23503') {
    const foreignKeyError = new ValidationError('Foreign key constraint violation');
    return next(foreignKeyError);
  }

  next(error);
}

// WebSocketエラーハンドラー
export function websocketErrorHandler(ws: any, error: Error) {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };

  logger.error('WebSocket error', errorInfo);

  // クライアントにエラーを送信
  if (ws.readyState === 1) { // OPEN
    ws.send(JSON.stringify({
      type: 'error',
      payload: {
        message: 'An error occurred',
        timestamp: Date.now(),
      },
    }));
  }
}

// Claude Code エラーハンドラー
export function claudeErrorHandler(error: any): AppError {
  // Claude API エラー
  if (error.status === 401) {
    return new AuthenticationError('Invalid Claude API key');
  }

  if (error.status === 429) {
    return new RateLimitError('Claude API rate limit exceeded', error.retryAfter);
  }

  if (error.status === 503) {
    return new ServiceUnavailableError('Claude API service unavailable');
  }

  // プロセス実行エラー
  if (error.code === 'ENOENT') {
    return new AppError('Claude Code CLI not found', 500);
  }

  if (error.code === 'ETIMEDOUT') {
    return new AppError('Command execution timeout', 408);
  }

  // 一般的なエラー
  return new AppError(error.message || 'Unknown error occurred');
}

// エラー統計の収集
class ErrorStatistics {
  private errorCounts = new Map<string, number>();
  private lastErrors = new Map<string, Date>();

  recordError(error: Error) {
    const errorKey = `${error.name}:${error.message}`;
    
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    this.lastErrors.set(errorKey, new Date());
  }

  getStatistics() {
    const stats: Record<string, any> = {};
    
    for (const [errorKey, count] of this.errorCounts) {
      stats[errorKey] = {
        count,
        lastOccurred: this.lastErrors.get(errorKey),
      };
    }
    
    return stats;
  }

  reset() {
    this.errorCounts.clear();
    this.lastErrors.clear();
  }
}

export const errorStatistics = new ErrorStatistics();

// エラー統計ミドルウェア
export function errorStatisticsMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  errorStatistics.recordError(error);
  next(error);
}

// 致命的エラーハンドラー
export function fatalErrorHandler(error: Error) {
  logger.error('Fatal error occurred', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // アプリケーションを適切にシャットダウン
  process.exit(1);
}

// プロセス例外ハンドラーのセットアップ
export function setupProcessErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    fatalErrorHandler(error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason,
      promise: promise.toString(),
    });
    
    // Promise rejection を Error に変換
    const error = reason instanceof Error ? reason : new Error(String(reason));
    fatalErrorHandler(error);
  });
}

// エラーレスポンスの標準化
export function createErrorResponse(error: AppError, requestId: string, includeStack: boolean = false) {
  const response: any = {
    error: {
      message: error.message,
      code: error.code,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  if (error instanceof ValidationError && error.field) {
    response.error.field = error.field;
    response.error.value = error.value;
  }

  if (error instanceof RateLimitError && error.retryAfter) {
    response.error.retryAfter = error.retryAfter;
  }

  return response;
}