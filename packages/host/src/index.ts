#!/usr/bin/env node

import { config } from 'dotenv';
import { createServer } from './server';
import { createLogger } from './utils/logger';
import { setupGracefulShutdown, setupHealthCheck, setupResourceMonitoring } from './utils/shutdown';
import { validateEnvironment, getDisplayableEnvironment } from './utils/env';

const logger = createLogger('main');

// 環境変数の読み込み
config();

async function main() {
  try {
    // 環境変数の検証
    const env = validateEnvironment();
    
    logger.info('🚀 Starting Vibe Coder Host Server...', {
      version: process.env.npm_package_version || '1.0.0',
      environment: getDisplayableEnvironment(env),
    });

    // システム監視の開始
    setupHealthCheck(logger);
    setupResourceMonitoring(logger);

    // サーバーの作成と起動
    const server = await createServer(env);
    
    // Graceful shutdown の設定
    setupGracefulShutdown(server, logger, {
      timeout: 30000,
      forceExit: true,
    });
    
    logger.info('✅ Vibe Coder Host Server started successfully!', {
      httpPort: env.PORT,
      host: env.HOST,
      pid: process.pid,
      nodeVersion: process.version,
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', { error });
    process.exit(1);
  }
}

// 未処理の例外とPromise拒否をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// メイン関数の実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}