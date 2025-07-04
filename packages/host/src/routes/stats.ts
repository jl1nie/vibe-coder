import { Router, Request, Response } from 'express';
import { RouteDependencies } from './index';
import { asyncHandler } from '../middleware/error';
import { createLogger } from '../utils/logger';

const logger = createLogger('stats-routes');

export function createStatsRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const { claudeService, sessionManager, webrtcService, fileWatcher } = dependencies;

  // 全体統計情報
  router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const stats = {
      claude: {
        activeSessions: claudeService.getActiveSessions().length,
        totalSessions: claudeService.getActiveSessions().length,
      },
      sessions: sessionManager.getStats(),
      webrtc: webrtcService.getStats(),
      fileWatcher: fileWatcher.getStats(),
      system: getSystemStats(),
      timestamp: new Date().toISOString(),
    };

    res.json(stats);
  }));

  // Claude統計情報
  router.get('/claude', asyncHandler(async (req: Request, res: Response) => {
    const activeSessions = claudeService.getActiveSessions();
    
    const stats = {
      activeSessions: activeSessions.length,
      sessions: activeSessions.map(session => ({
        id: session.id,
        workspaceDir: session.workspaceDir,
        isActive: session.isActive,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        age: Date.now() - session.createdAt,
        idleTime: Date.now() - session.lastUsed,
      })),
      timestamp: new Date().toISOString(),
    };

    res.json(stats);
  }));

  // セッション統計情報
  router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
    const stats = sessionManager.getStats();

    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  // WebRTC統計情報
  router.get('/webrtc', asyncHandler(async (req: Request, res: Response) => {
    const stats = webrtcService.getStats();
    const connectedPeers = webrtcService.getConnectedPeers();

    const detailedStats = {
      ...stats,
      peers: connectedPeers.map(peer => ({
        id: peer.id,
        isConnected: peer.isConnected,
        lastSeen: peer.lastSeen,
        age: Date.now() - peer.lastSeen,
        metadata: peer.metadata,
      })),
      timestamp: new Date().toISOString(),
    };

    res.json(detailedStats);
  }));

  // ファイル監視統計情報
  router.get('/files', asyncHandler(async (req: Request, res: Response) => {
    const stats = fileWatcher.getStats();
    const watchedSessions = fileWatcher.getWatchedSessions();

    const detailedStats = {
      ...stats,
      sessions: watchedSessions.map(session => ({
        sessionId: session.sessionId,
        workspaceDir: session.workspaceDir,
        isActive: session.isActive,
        fileCount: session.fileCount,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        age: Date.now() - session.createdAt,
        inactiveTime: Date.now() - session.lastActivity,
      })),
      timestamp: new Date().toISOString(),
    };

    res.json(detailedStats);
  }));

  // システム統計情報
  router.get('/system', asyncHandler(async (req: Request, res: Response) => {
    const stats = getSystemStats();

    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  // パフォーマンス統計情報
  router.get('/performance', asyncHandler(async (req: Request, res: Response) => {
    const performanceStats = getPerformanceStats();

    res.json({
      stats: performanceStats,
      timestamp: new Date().toISOString(),
    });
  }));

  // リアルタイム統計情報（WebSocket向け）
  router.get('/realtime', asyncHandler(async (req: Request, res: Response) => {
    const realtimeStats = {
      claude: {
        activeSessions: claudeService.getActiveSessions().length,
      },
      sessions: {
        connected: sessionManager.getStats().connectedClients,
        active: sessionManager.getStats().activeSessions,
      },
      webrtc: {
        connectedPeers: webrtcService.getConnectedPeers().length,
      },
      files: {
        watchedSessions: fileWatcher.getWatchedSessions().length,
        totalFiles: fileWatcher.getStats().totalFiles,
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
      timestamp: Date.now(),
    };

    res.json(realtimeStats);
  }));

  return router;
}

// システム統計情報の取得
function getSystemStats() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    process: {
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      claudeApiConfigured: !!process.env.CLAUDE_API_KEY,
    },
  };
}

// パフォーマンス統計情報の取得
function getPerformanceStats() {
  const startUsage = process.cpuUsage();
  const startTime = process.hrtime.bigint();

  // 少し待ってCPU使用率を計算
  setTimeout(() => {
    const diff = process.cpuUsage(startUsage);
    const timeDiff = Number(process.hrtime.bigint() - startTime) / 1000000; // ms

    const cpuPercent = {
      user: (diff.user / 1000 / timeDiff) * 100,
      system: (diff.system / 1000 / timeDiff) * 100,
    };

    logger.debug('CPU usage calculated', cpuPercent);
  }, 100);

  return {
    eventLoopLag: getEventLoopLag(),
    memoryTrend: getMemoryTrend(),
    requestsPerSecond: getRequestsPerSecond(),
  };
}

// イベントループ遅延の測定
function getEventLoopLag(): number {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1000000; // ms
    return lag;
  });
  return 0; // 簡易実装
}

// メモリ使用量のトレンド
function getMemoryTrend(): any {
  // 実際の実装では、時系列データを保存して傾向を分析
  const current = process.memoryUsage();
  return {
    current: Math.round(current.heapUsed / 1024 / 1024),
    trend: 'stable', // 'increasing', 'decreasing', 'stable'
  };
}

// リクエスト/秒の計算
function getRequestsPerSecond(): number {
  // 実際の実装では、リクエストカウンターを使用
  return 0; // 簡易実装
}