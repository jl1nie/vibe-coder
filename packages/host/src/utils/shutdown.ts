import { VibeCoderServer } from '../server';
import { Logger } from './logger';

export interface ShutdownOptions {
  timeout?: number; // シャットダウンタイムアウト（ミリ秒）
  forceExit?: boolean; // 強制終了するかどうか
}

export function setupGracefulShutdown(
  server: VibeCoderServer,
  logger: Logger,
  options: ShutdownOptions = {}
): void {
  const { timeout = 30000, forceExit = true } = options;

  let isShuttingDown = false;
  let shutdownTimer: NodeJS.Timeout | null = null;

  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logger.warn(`Received ${signal} during shutdown, ignoring`);
      return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`, {
      signal,
      timeout,
      forceExit,
    });

    // タイムアウトタイマーの設定
    if (timeout > 0) {
      shutdownTimer = setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit', {
          signal,
          timeout,
        });
        
        if (forceExit) {
          process.exit(1);
        }
      }, timeout);
    }

    try {
      // 段階的なシャットダウン
      await performGracefulShutdown(server, logger, signal);
      
      if (shutdownTimer) {
        clearTimeout(shutdownTimer);
      }

      logger.info('Graceful shutdown completed successfully', { signal });
      process.exit(0);
      
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        signal,
        error,
      });

      if (shutdownTimer) {
        clearTimeout(shutdownTimer);
      }

      if (forceExit) {
        process.exit(1);
      }
    }
  };

  // シグナルハンドラーの登録
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  // 未処理例外のハンドリング
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception, initiating emergency shutdown', {
      error,
    });
    
    // 緊急シャットダウン
    emergencyShutdown(server, logger, error)
      .finally(() => {
        if (forceExit) {
          process.exit(1);
        }
      });
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection, initiating emergency shutdown', {
      reason,
      promise: promise.toString(),
    });

    // 緊急シャットダウン
    emergencyShutdown(server, logger, reason)
      .finally(() => {
        if (forceExit) {
          process.exit(1);
        }
      });
  });

  logger.info('Graceful shutdown handlers registered', {
    timeout,
    forceExit,
    signals: ['SIGTERM', 'SIGINT', 'SIGHUP'],
  });
}

async function performGracefulShutdown(
  server: VibeCoderServer,
  logger: Logger,
  signal: string
): Promise<void> {
  const shutdownSteps = [
    {
      name: 'Stop accepting new connections',
      action: async () => {
        // 新しい接続の受け入れを停止
        server.httpServer.close();
        logger.info('HTTP server stopped accepting new connections');
      },
    },
    {
      name: 'Close WebSocket connections',
      action: async () => {
        // WebSocket接続のクリーンな終了
        server.wsServer.close();
        logger.info('WebSocket server closed');
      },
    },
    {
      name: 'Complete server shutdown',
      action: async () => {
        // 残りのクリーンアップ
        await server.shutdown();
        logger.info('Server shutdown completed');
      },
    },
  ];

  for (const step of shutdownSteps) {
    try {
      logger.debug(`Shutdown step: ${step.name}`);
      await step.action();
      logger.debug(`Shutdown step completed: ${step.name}`);
    } catch (error) {
      logger.error(`Shutdown step failed: ${step.name}`, {
        error,
        signal,
      });
      throw error;
    }
  }
}

async function emergencyShutdown(
  server: VibeCoderServer,
  logger: Logger,
  error: any
): Promise<void> {
  logger.warn('Performing emergency shutdown');

  try {
    // 最小限のクリーンアップのみ実行
    await Promise.race([
      server.shutdown(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Emergency shutdown timeout')), 5000)
      ),
    ]);

    logger.info('Emergency shutdown completed');
  } catch (shutdownError) {
    logger.error('Emergency shutdown failed', {
      originalError: error,
      shutdownError,
    });
  }
}

// プロセス健全性チェック
export function setupHealthCheck(logger: Logger): void {
  let lastHealthCheck = Date.now();
  
  const healthCheckInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastHealthCheck;
    
    // イベントループの遅延チェック
    if (timeSinceLastCheck > 35000) { // 30秒間隔で5秒の遅延許容
      logger.warn('Event loop lag detected', {
        expectedInterval: 30000,
        actualInterval: timeSinceLastCheck,
        lag: timeSinceLastCheck - 30000,
      });
    }
    
    lastHealthCheck = now;

    // メモリ使用量チェック
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    // メモリ使用量が1GB を超えたら警告
    if (memUsageMB.rss > 1024) {
      logger.warn('High memory usage detected', {
        memoryUsage: memUsageMB,
      });
    }

    logger.debug('Health check completed', {
      memoryUsage: memUsageMB,
      uptime: Math.round(process.uptime()),
    });
  }, 30000);

  // プロセス終了時にタイマーをクリア
  process.on('exit', () => {
    clearInterval(healthCheckInterval);
  });

  logger.info('Health check monitoring started');
}

// CPUとメモリの監視
export function setupResourceMonitoring(logger: Logger): void {
  const startCpuUsage = process.cpuUsage();
  let lastCpuUsage = startCpuUsage;

  setInterval(() => {
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    const cpuPercent = {
      user: Math.round((currentCpuUsage.user / 1000000) * 100) / 100,
      system: Math.round((currentCpuUsage.system / 1000000) * 100) / 100,
    };

    const memUsage = process.memoryUsage();
    const resourceStats = {
      cpu: cpuPercent,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
    };

    logger.debug('Resource usage', resourceStats);

    // 高CPU使用率の警告
    if (cpuPercent.user > 80 || cpuPercent.system > 80) {
      logger.warn('High CPU usage detected', resourceStats);
    }

    lastCpuUsage = process.cpuUsage();
  }, 60000); // 1分間隔

  logger.info('Resource monitoring started');
}