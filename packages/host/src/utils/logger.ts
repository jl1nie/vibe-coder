import winston from 'winston';
import { pino } from 'pino';
import pretty from 'pino-pretty';

// ログレベルの定義
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug'
}

// ログコンテキストの型定義
export interface LogContext {
  sessionId?: string;
  clientId?: string;
  command?: string;
  duration?: number;
  error?: Error | string;
  metadata?: Record<string, any>;
}

// 本格的なロガーインターface
export interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

// Winston ベースのロガー実装
class WinstonLogger implements Logger {
  constructor(private winston: winston.Logger) {}

  error(message: string, context?: LogContext): void {
    this.winston.error(message, this.formatContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, this.formatContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.winston.info(message, this.formatContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, this.formatContext(context));
  }

  child(defaultContext: LogContext): Logger {
    const childWinston = this.winston.child(this.formatContext(defaultContext));
    return new WinstonLogger(childWinston);
  }

  private formatContext(context?: LogContext): any {
    if (!context) return {};

    const formatted: any = { ...context };

    // エラーオブジェクトの処理
    if (context.error) {
      if (context.error instanceof Error) {
        formatted.error = {
          name: context.error.name,
          message: context.error.message,
          stack: context.error.stack,
        };
      } else {
        formatted.error = String(context.error);
      }
    }

    // メタデータの展開
    if (context.metadata) {
      Object.assign(formatted, context.metadata);
      delete formatted.metadata;
    }

    return formatted;
  }
}

// Pino ベースのロガー実装
class PinoLogger implements Logger {
  constructor(private pino: pino.Logger) {}

  error(message: string, context?: LogContext): void {
    this.pino.error(this.formatContext(context), message);
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(this.formatContext(context), message);
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(this.formatContext(context), message);
  }

  debug(message: string, context?: LogContext): void {
    this.pino.debug(this.formatContext(context), message);
  }

  child(defaultContext: LogContext): Logger {
    const childPino = this.pino.child(this.formatContext(defaultContext));
    return new PinoLogger(childPino);
  }

  private formatContext(context?: LogContext): any {
    if (!context) return {};

    const formatted: any = { ...context };

    // エラーオブジェクトの処理
    if (context.error) {
      if (context.error instanceof Error) {
        formatted.err = context.error; // Pinoの標準エラーフィールド
      } else {
        formatted.error = String(context.error);
      }
    }

    return formatted;
  }
}

// ロガーファクトリー
export function createLogger(module?: string): Logger {
  const logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  const logFormat = process.env.LOG_FORMAT || 'pretty';
  const logFilePath = process.env.LOG_FILE_PATH;

  if (logFormat === 'json' || process.env.NODE_ENV === 'production') {
    // Pino (JSON形式、高性能)
    const pinoConfig: pino.LoggerOptions = {
      level: logLevel,
      name: module || 'vibe-coder-host',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          hostname: bindings.hostname,
          name: bindings.name,
        }),
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
    };

    let pinoLogger: pino.Logger;

    if (logFilePath) {
      // ファイル出力
      pinoLogger = pino(pinoConfig, pino.destination(logFilePath));
    } else {
      // 標準出力
      pinoLogger = pino(pinoConfig);
    }

    return new PinoLogger(pinoLogger);
  } else {
    // Winston (Pretty形式、開発用)
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
          }),
          winston.format.errors({ stack: true }),
          winston.format.colorize({ all: true }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const modulePrefix = module ? `[${module}] ` : '';
            const metaStr = Object.keys(meta).length > 0 
              ? '\n' + JSON.stringify(meta, null, 2)
              : '';
            return `${timestamp} ${level}: ${modulePrefix}${message}${metaStr}`;
          })
        ),
      }),
    ];

    if (logFilePath) {
      transports.push(
        new winston.transports.File({
          filename: logFilePath,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );
    }

    const winstonLogger = winston.createLogger({
      level: logLevel,
      defaultMeta: { module },
      transports,
      exitOnError: false,
    });

    return new WinstonLogger(winstonLogger);
  }
}

// デフォルトロガーのエクスポート
export const logger = createLogger('host');

// ログ関連のユーティリティ
export class LogTimer {
  private startTime: number;

  constructor(
    private logger: Logger,
    private operation: string,
    private context?: LogContext
  ) {
    this.startTime = Date.now();
    this.logger.debug(`Starting ${operation}`, context);
  }

  finish(additionalContext?: LogContext): void {
    const duration = Date.now() - this.startTime;
    const context = {
      ...this.context,
      ...additionalContext,
      duration,
    };
    
    this.logger.info(`Completed ${this.operation}`, context);
  }

  error(error: Error | string, additionalContext?: LogContext): void {
    const duration = Date.now() - this.startTime;
    const context = {
      ...this.context,
      ...additionalContext,
      duration,
      error,
    };
    
    this.logger.error(`Failed ${this.operation}`, context);
  }
}

// リクエスト追跡用のミドルウェア用ユーティリティ
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// セキュリティ関連のログフィルタリング
export function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveFields = [
    'password', 'token', 'key', 'secret', 'auth', 'authorization',
    'cookie', 'session', 'api_key', 'apikey', 'claude_api_key'
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // 再帰的にサニタイズ
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

// エラー統計の追跡
class ErrorStats {
  private stats = new Map<string, { count: number; lastOccurred: Date }>();

  record(error: Error | string): void {
    const errorKey = error instanceof Error ? error.name : 'GenericError';
    const current = this.stats.get(errorKey) || { count: 0, lastOccurred: new Date() };
    
    this.stats.set(errorKey, {
      count: current.count + 1,
      lastOccurred: new Date(),
    });
  }

  getStats(): Record<string, { count: number; lastOccurred: Date }> {
    return Object.fromEntries(this.stats);
  }

  clear(): void {
    this.stats.clear();
  }
}

export const errorStats = new ErrorStats();