import { Request, Response, NextFunction } from 'express';
import { createLogger, generateRequestId, sanitizeLogData } from '../utils/logger';

const logger = createLogger('middleware');

// リクエストログミドルウェア
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // リクエストIDをレスポンスヘッダーに追加
  res.setHeader('X-Request-ID', requestId);
  
  // リクエストの詳細情報
  const requestInfo = {
    requestId,
    method: req.method,
    path: req.path,
    query: sanitizeLogData(req.query),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    referrer: req.get('referrer'),
    timestamp: new Date().toISOString(),
  };
  
  // リクエスト開始ログ
  logger.info('Request started', requestInfo);
  
  // レスポンス完了時のログ
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseInfo = {
      requestId,
      statusCode: res.statusCode,
      duration,
      responseSize: res.get('content-length'),
      method: req.method,
      path: req.path,
      ip: req.ip,
    };
    
    // ステータスコードに応じてログレベルを調整
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', responseInfo);
    } else if (duration > 1000) {
      logger.warn('Slow request completed', responseInfo);
    } else {
      logger.info('Request completed', responseInfo);
    }
  });
  
  // エラーハンドリング
  res.on('error', (error) => {
    logger.error('Response error', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
  });
  
  next();
}

// エラーログミドルウェア
export function errorLogger(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = res.get('X-Request-ID') || generateRequestId();
  
  const errorInfo = {
    requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: req.method,
      path: req.path,
      query: sanitizeLogData(req.query),
      body: sanitizeLogData(req.body),
      headers: sanitizeLogData(req.headers),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    timestamp: new Date().toISOString(),
  };
  
  logger.error('Unhandled error in request', errorInfo);
  
  // エラーをスタックトレースと共に記録
  if (error.stack) {
    logger.debug('Error stack trace', {
      requestId,
      stack: error.stack,
    });
  }
  
  next(error);
}

// パフォーマンス監視ミドルウェア
export function performanceMonitor(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // ナノ秒をミリ秒に変換
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
    };
    
    const performanceInfo = {
      requestId: res.get('X-Request-ID'),
      method: req.method,
      path: req.path,
      duration,
      memoryDiff,
      statusCode: res.statusCode,
    };
    
    // パフォーマンスの問題をログ
    if (duration > 5000) { // 5秒以上
      logger.warn('Very slow request detected', performanceInfo);
    } else if (duration > 1000) { // 1秒以上
      logger.warn('Slow request detected', performanceInfo);
    } else {
      logger.debug('Request performance', performanceInfo);
    }
    
    // メモリ使用量の大幅な増加を検出
    if (memoryDiff.heapUsed > 10 * 1024 * 1024) { // 10MB以上
      logger.warn('High memory usage detected', performanceInfo);
    }
  });
  
  next();
}

// WebSocketログミドルウェア
export function websocketLogger(ws: any, req: Request) {
  const connectionId = generateRequestId();
  const startTime = Date.now();
  
  const connectionInfo = {
    connectionId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    origin: req.get('origin'),
    timestamp: new Date().toISOString(),
  };
  
  logger.info('WebSocket connection established', connectionInfo);
  
  // メッセージ送信のログ
  const originalSend = ws.send;
  ws.send = function(data: any) {
    logger.debug('WebSocket message sent', {
      connectionId,
      dataSize: typeof data === 'string' ? data.length : Buffer.byteLength(data),
      dataType: typeof data,
    });
    return originalSend.call(this, data);
  };
  
  // メッセージ受信のログ
  ws.on('message', (data: any) => {
    logger.debug('WebSocket message received', {
      connectionId,
      dataSize: typeof data === 'string' ? data.length : data.length,
      dataType: typeof data,
    });
  });
  
  // 接続終了のログ
  ws.on('close', (code: number, reason: string) => {
    const duration = Date.now() - startTime;
    logger.info('WebSocket connection closed', {
      connectionId,
      code,
      reason,
      duration,
    });
  });
  
  // エラーのログ
  ws.on('error', (error: Error) => {
    logger.error('WebSocket error', {
      connectionId,
      error: error.message,
      stack: error.stack,
    });
  });
}

// 構造化ログデータの作成
export function createStructuredLog(
  level: string,
  message: string,
  context: Record<string, any> = {}
): Record<string, any> {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    hostname: require('os').hostname(),
    service: 'vibe-coder-host',
    ...sanitizeLogData(context),
  };
}

// ログ集約用のミドルウェア
export function logAggregator(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // ログ情報を収集
  const logData = {
    requestId: res.get('X-Request-ID') || generateRequestId(),
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  };
  
  // ログ情報をリクエストオブジェクトに保存
  (req as any).logData = logData;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const finalLogData = {
      ...logData,
      statusCode: res.statusCode,
      duration,
      responseSize: res.get('content-length'),
    };
    
    // ログ集約システムに送信（実際の実装では外部サービスに送信）
    sendToLogAggregator(finalLogData);
  });
  
  next();
}

// ログ集約システムへの送信
function sendToLogAggregator(logData: Record<string, any>) {
  // 実際の実装では、ElasticSearch、Splunk、CloudWatch等に送信
  logger.debug('Log aggregation', logData);
}

// 機密情報のマスキング
export function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const masked = { ...data };
  const sensitiveFields = [
    'password', 'token', 'key', 'secret', 'auth',
    'authorization', 'cookie', 'session', 'apiKey',
    'claude_api_key', 'claudeApiKey'
  ];
  
  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '[MASKED]';
    }
  }
  
  // 再帰的にマスキング
  for (const key in masked) {
    if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  
  return masked;
}

// APIエンドポイント別のログ設定
export function createEndpointLogger(endpoint: string) {
  const endpointLogger = createLogger(`endpoint:${endpoint}`);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = res.get('X-Request-ID') || generateRequestId();
    
    endpointLogger.info(`${endpoint} request started`, {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    
    res.on('finish', () => {
      endpointLogger.info(`${endpoint} request completed`, {
        requestId,
        statusCode: res.statusCode,
        method: req.method,
        path: req.path,
      });
    });
    
    next();
  };
}