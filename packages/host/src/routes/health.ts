import { Router, Request, Response } from 'express';
import { createLogger } from '@vibe-coder/shared';

const logger = createLogger('health-routes');
const router = Router();

// ヘルスチェックエンドポイント
router.get('/', (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '0.1.0',
    nodeVersion: process.version,
    pid: process.pid,
  };

  res.json(healthData);
});

// 詳細ヘルスチェック
router.get('/detailed', (req: Request, res: Response) => {
  const detailed = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      version: process.env.npm_package_version || '0.1.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      claudeApiConfigured: !!process.env.CLAUDE_API_KEY,
      workspaceDir: process.env.WORKSPACE_DIR || '/app/workspace',
    },
  };

  res.json(detailed);
});

// Ready check（Kubernetes ready probe用）
router.get('/ready', (req: Request, res: Response) => {
  // Claude APIキーの存在確認
  if (!process.env.CLAUDE_API_KEY) {
    return res.status(503).json({
      status: 'not-ready',
      reason: 'Claude API key not configured',
    });
  }

  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// Live check（Kubernetes liveness probe用）
router.get('/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter };