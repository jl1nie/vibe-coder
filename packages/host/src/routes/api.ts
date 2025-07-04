import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { 
  createLogger, 
  createError, 
  ERROR_CODES,
  validateCommand,
  checkRateLimit
} from '@vibe-coder/shared';
import { ClaudeService } from '../services/claude';
import { SessionManager } from '../services/session';
import { WebRTCService } from '../services/webrtc';

const logger = createLogger('api-routes');
const router = Router();

// サービスインスタンス（DIコンテナ的な使用）
let claudeService: ClaudeService;
let sessionManager: SessionManager;
let webrtcService: WebRTCService;

// サービス注入関数
export const injectServices = (
  claude: ClaudeService,
  session: SessionManager,
  webrtc: WebRTCService
) => {
  claudeService = claude;
  sessionManager = session;
  webrtcService = webrtc;
};

// レート制限設定
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 100リクエスト/15分
  message: {
    error: 'Too many API requests',
    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10, // 10リクエスト/分
  message: {
    error: 'Too many requests for this endpoint',
    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
  },
});

// 認証ミドルウェア（簡易版）
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.headers['x-client-id'] as string;
  
  if (!clientId) {
    return res.status(401).json({
      error: 'Client ID required',
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  // リクエストにクライアントIDを付加
  (req as any).clientId = clientId;
  next();
};

// エラーハンドリングミドルウェア
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 全APIエンドポイントにレート制限を適用
router.use(apiLimiter);

// セッション関連エンドポイント
router.get('/sessions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const sessions = sessionManager.getAllClients()
    .filter(client => client.id === (req as any).clientId)
    .map(client => ({
      clientId: client.id,
      connectedAt: client.connectedAt,
      claudeSession: client.claudeSession?.getStatus() || null,
    }));

  res.json({ sessions });
}));

router.post('/sessions', authenticate, strictLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { workspaceDir, projectName } = req.body;
  const clientId = (req as any).clientId;

  if (!workspaceDir) {
    return res.status(400).json({
      error: 'Workspace directory required',
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  // クライアント情報取得
  const client = sessionManager.getClientInfo(clientId);
  if (!client) {
    return res.status(404).json({
      error: 'Client not found',
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
  }

  // セッション開始（WebSocket経由でハンドリング）
  const sessionStartRequest = {
    workspaceDir,
    projectName,
    metadata: req.body.metadata,
  };

  // WebSocketが接続されていない場合のエラー
  if (client.websocket.readyState !== 1) {
    return res.status(400).json({
      error: 'WebSocket connection required for session management',
      code: ERROR_CODES.CONNECTION_FAILED,
    });
  }

  // WebSocket経由でセッション開始をトリガー
  sessionManager.sendToClient(clientId, {
    type: 'session-start-request',
    data: sessionStartRequest,
  });

  res.json({
    message: 'Session start request sent',
    clientId,
    workspaceDir,
  });
}));

// コマンド実行エンドポイント
router.post('/execute', authenticate, strictLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { command, sessionId, options } = req.body;
  const clientId = (req as any).clientId;

  if (!command) {
    return res.status(400).json({
      error: 'Command required',
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!sessionId) {
    return res.status(400).json({
      error: 'Session ID required',
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  // コマンド検証
  try {
    validateCommand(command);
    checkRateLimit(clientId);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid command',
      code: (error as any).code || ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const execution = await claudeService.executeCommand(
      sessionId,
      command,
      clientId,
      options
    );

    res.json({
      executionId: execution.id,
      status: execution.status,
      startTime: execution.startTime,
    });
  } catch (error) {
    const statusCode = (error as any).code === ERROR_CODES.SESSION_NOT_FOUND ? 404 : 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Command execution failed',
      code: (error as any).code || ERROR_CODES.COMMAND_FAILED,
    });
  }
}));

// セッション情報取得
router.get('/sessions/:sessionId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = claudeService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
  }

  res.json(session.getStatus());
}));

// セッション履歴取得
router.get('/sessions/:sessionId/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const session = claudeService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
  }

  const history = session.getCommandHistory();
  const start = parseInt(offset as string, 10);
  const end = start + parseInt(limit as string, 10);

  res.json({
    commands: history.slice(start, end),
    total: history.length,
    offset: start,
    limit: parseInt(limit as string, 10),
  });
}));

// WebRTC関連エンドポイント
router.post('/webrtc/connection', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;
  const { metadata } = req.body;

  const connection = await webrtcService.createPeerConnection(clientId, metadata);

  res.json({
    connectionId: connection.id,
    serverId: connection.serverId,
    status: connection.status,
  });
}));

router.get('/webrtc/signal/:serverId', asyncHandler(async (req: Request, res: Response) => {
  const { serverId } = req.params;
  const { type } = req.query;

  const signals = webrtcService.getSignalData(serverId, type as string);

  res.json({
    serverId,
    signals,
    count: signals.length,
  });
}));

// システム統計
router.get('/stats', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const sessionStats = sessionManager.getStats();
  const webrtcStats = webrtcService.getStats();
  const claudeSessions = claudeService.getAllSessions().length;

  res.json({
    timestamp: new Date().toISOString(),
    sessions: sessionStats,
    webrtc: webrtcStats,
    claude: {
      totalSessions: claudeSessions,
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    },
  });
}));

// プレイリスト関連（将来実装）
router.get('/playlists', asyncHandler(async (req: Request, res: Response) => {
  // GitHub Gist からプレイリスト取得（将来実装）
  res.json({
    message: 'Playlist feature coming soon',
    playlists: [],
  });
}));

// ファイルアップロード（将来実装）
router.post('/upload', authenticate, strictLimiter, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    message: 'File upload feature coming soon',
  });
}));

// サーバー情報
router.get('/info', (req: Request, res: Response) => {
  res.json({
    name: 'Vibe Coder Host Server',
    version: process.env.npm_package_version || '0.1.0',
    nodeVersion: process.version,
    capabilities: [
      'claude-code-integration',
      'webrtc-signaling',
      'session-management',
      'real-time-output',
    ],
    endpoints: {
      websocket: '/ws',
      health: '/health',
      api: '/api',
    },
  });
});

export { router as apiRouter };