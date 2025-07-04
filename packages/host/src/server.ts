import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

import { createLogger } from './utils/logger';
import { Environment } from './utils/env';
import { setupWebRTCSignaling } from './services/webrtc-signaling';
import { setupClaudeService } from './services/claude-service';
import { setupSessionManager } from './services/session-manager';
import { setupFileWatcher } from './services/file-watcher';
import { createRoutes } from './routes/index';
import { setupWebSocketHandler } from './websocket/handler';
import { 
  createRateLimiter, 
  createSecurityHeaders, 
  createCorsOptions, 
  createBodyParser,
  securityAuditLogger,
  validateClientIP 
} from './middleware/security';
import { 
  requestLogger, 
  errorLogger, 
  performanceMonitor,
  logAggregator
} from './middleware/logging';
import { 
  errorHandler, 
  notFoundHandler, 
  validationErrorHandler,
  databaseErrorHandler,
  errorStatisticsMiddleware,
  setupProcessErrorHandlers
} from './middleware/error';

const logger = createLogger('server');

export interface VibeCoderServer {
  app: express.Application;
  httpServer: ReturnType<typeof createHttpServer>;
  wsServer: WebSocketServer;
  shutdown: () => Promise<void>;
}

export async function createServer(env: Environment): Promise<VibeCoderServer> {
  // プロセスエラーハンドラーの設定
  setupProcessErrorHandlers();

  const app = express();
  
  // セキュリティヘッダー
  app.use(createSecurityHeaders(env));
  
  // CORS設定
  app.use(cors(createCorsOptions(env)));

  // レート制限
  app.use(createRateLimiter(env));

  // JSON解析
  const bodyParserConfig = createBodyParser();
  app.use(express.json(bodyParserConfig.json));
  app.use(express.urlencoded(bodyParserConfig.urlencoded));

  // ログ記録ミドルウェア
  app.use(requestLogger);
  app.use(performanceMonitor);
  app.use(logAggregator);
  app.use(securityAuditLogger);
  
  // セキュリティミドルウェア
  app.use(validateClientIP);

  // HTTPサーバーの作成
  const httpServer = createHttpServer(app);
  
  // WebSocketサーバーの作成
  const wsServer = new WebSocketServer({ 
    server: httpServer,
    path: '/ws',
    clientTracking: true,
    maxPayload: 10 * 1024 * 1024, // 10MB
  });

  // サービスの初期化
  logger.info('Initializing services...');
  const claudeService = setupClaudeService(env);
  const sessionManager = setupSessionManager(wsServer, claudeService);
  const fileWatcher = setupFileWatcher(env);
  const webrtcService = setupWebRTCSignaling(env);
  
  // 依存関係の設定
  const dependencies = {
    env,
    claudeService,
    sessionManager,
    webrtcService,
    fileWatcher,
  };
  
  // WebSocketハンドラーの設定
  setupWebSocketHandler(wsServer, {
    env,
    sessionManager,
    webrtcService,
  });

  // ルートの設定
  app.use('/api', createRoutes(dependencies));

  // 静的ファイルの配信（開発時）
  if (env.NODE_ENV === 'development') {
    app.use('/static', express.static('public'));
  }

  // エラーミドルウェア
  app.use(validationErrorHandler);
  app.use(databaseErrorHandler);
  app.use(errorStatisticsMiddleware);
  app.use(errorLogger);

  // 404ハンドラー
  app.use('*', notFoundHandler);

  // 最終エラーハンドラー
  app.use(errorHandler(env));

  // サーバーの起動
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(env.PORT, env.HOST, () => {
      logger.info(`HTTP Server listening on ${env.HOST}:${env.PORT}`);
      resolve();
    });
    
    httpServer.on('error', (error) => {
      logger.error('HTTP Server error:', error);
      reject(error);
    });
  });

  logger.info('Server started successfully', {
    port: env.PORT,
    host: env.HOST,
    environment: env.NODE_ENV,
    serverId: webrtcService.getServerId(),
  });

  // シャットダウン関数
  const shutdown = async (): Promise<void> => {
    logger.info('Starting graceful shutdown...');
    
    try {
      // WebSocketサーバーの停止
      wsServer.close();
      
      // サービスのクリーンアップ
      await Promise.all([
        claudeService.cleanup(),
        sessionManager.cleanup(),
        fileWatcher.cleanup(),
        webrtcService.cleanup(),
      ]);
      
      // HTTPサーバーの停止
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      logger.info('Server shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  };

  return {
    app,
    httpServer,
    wsServer,
    shutdown,
  };
}