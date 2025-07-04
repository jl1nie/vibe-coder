import { Router } from 'express';
import { createHealthRoutes } from './health';
import { createSessionRoutes } from './sessions';
import { createWebRTCRoutes } from './webrtc';
import { createFileRoutes } from './files';
import { createStatsRoutes } from './stats';
import { Environment } from '../utils/env';
import { ClaudeService } from '../services/claude-service';
import { SessionManager } from '../services/session-manager';
import { WebRTCSignalingService } from '../services/webrtc-signaling';
import { FileWatcherService } from '../services/file-watcher';

export interface RouteDependencies {
  env: Environment;
  claudeService: ClaudeService;
  sessionManager: SessionManager;
  webrtcService: WebRTCSignalingService;
  fileWatcher: FileWatcherService;
}

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  // ルートパス
  router.get('/', (req, res) => {
    res.json({
      service: 'Vibe Coder Host Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: dependencies.env.NODE_ENV,
      serverId: dependencies.webrtcService.getServerId(),
    });
  });

  // 各種ルートの登録
  router.use('/health', createHealthRoutes(dependencies));
  router.use('/sessions', createSessionRoutes(dependencies));
  router.use('/webrtc', createWebRTCRoutes(dependencies));
  router.use('/files', createFileRoutes(dependencies));
  router.use('/stats', createStatsRoutes(dependencies));

  return router;
}