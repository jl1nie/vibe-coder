import { Router, Request, Response } from 'express';
import { RouteDependencies } from './index';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error';
import { createLogger } from '../utils/logger';

const logger = createLogger('session-routes');

export function createSessionRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const { claudeService, sessionManager, fileWatcher } = dependencies;

  // セッション一覧の取得
  router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const activeSessions = claudeService.getActiveSessions();
    const sessionStats = sessionManager.getStats();

    res.json({
      sessions: activeSessions,
      stats: sessionStats,
      timestamp: new Date().toISOString(),
    });
  }));

  // セッションの作成
  router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, workspaceDir } = req.body;

    if (!sessionId) {
      throw new ValidationError('sessionId is required');
    }

    try {
      // Claude セッションの作成
      const session = await claudeService.createSession(sessionId, workspaceDir);
      
      // ファイル監視の開始
      await fileWatcher.startWatching(sessionId, session.workspaceDir);

      logger.info('Session created successfully', {
        sessionId,
        workspaceDir: session.workspaceDir,
      });

      res.status(201).json({
        message: 'Session created successfully',
        session,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to create session', {
        sessionId,
        workspaceDir,
        error,
      });
      throw error;
    }
  }));

  // 特定セッションの取得
  router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const session = claudeService.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
    }

    const watcherSession = fileWatcher.getSession(sessionId);

    res.json({
      session,
      fileWatcher: watcherSession,
      timestamp: new Date().toISOString(),
    });
  }));

  // コマンドの実行
  router.post('/:sessionId/execute', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { command } = req.body;

    if (!command) {
      throw new ValidationError('command is required');
    }

    const session = claudeService.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
    }

    try {
      const result = await claudeService.executeCommand(sessionId, command);

      logger.info('Command executed successfully', {
        sessionId,
        command: command.substring(0, 100),
        exitCode: result.exitCode,
        duration: result.duration,
      });

      res.json({
        message: 'Command executed successfully',
        result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to execute command', {
        sessionId,
        command: command.substring(0, 100),
        error,
      });
      throw error;
    }
  }));

  // セッションの終了
  router.delete('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = claudeService.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
    }

    try {
      // ファイル監視の停止
      await fileWatcher.stopWatching(sessionId);
      
      // Claude セッションの終了
      await claudeService.terminateSession(sessionId);

      logger.info('Session terminated successfully', { sessionId });

      res.json({
        message: 'Session terminated successfully',
        sessionId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to terminate session', { sessionId, error });
      throw error;
    }
  }));

  // セッションの統計情報
  router.get('/:sessionId/stats', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = claudeService.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
    }

    const fileWatcherSession = fileWatcher.getSession(sessionId);
    const now = Date.now();

    const stats = {
      sessionId,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      duration: now - session.createdAt,
      workspaceDir: session.workspaceDir,
      fileWatcher: fileWatcherSession ? {
        fileCount: fileWatcherSession.fileCount,
        lastActivity: fileWatcherSession.lastActivity,
        isActive: fileWatcherSession.isActive,
      } : null,
    };

    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
}