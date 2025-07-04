import { Router, Request, Response } from 'express';
import { RouteDependencies } from './index';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error';
import { createLogger } from '../utils/logger';

const logger = createLogger('file-routes');

export function createFileRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const { fileWatcher } = dependencies;

  // 監視中のセッション一覧
  router.get('/watched', asyncHandler(async (req: Request, res: Response) => {
    const watchedSessions = fileWatcher.getWatchedSessions();
    const stats = fileWatcher.getStats();

    res.json({
      sessions: watchedSessions,
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  // 特定セッションのファイル監視情報
  router.get('/watched/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const session = fileWatcher.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`File watcher session not found: ${sessionId}`, 'file-watcher');
    }

    res.json({
      session,
      timestamp: new Date().toISOString(),
    });
  }));

  // ファイル監視の開始
  router.post('/watch', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, workspaceDir } = req.body;

    if (!sessionId) {
      throw new ValidationError('sessionId is required');
    }

    if (!workspaceDir) {
      throw new ValidationError('workspaceDir is required');
    }

    try {
      await fileWatcher.startWatching(sessionId, workspaceDir);

      logger.info('File watching started', { sessionId, workspaceDir });

      res.status(201).json({
        message: 'File watching started successfully',
        sessionId,
        workspaceDir,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to start file watching', { sessionId, workspaceDir, error });
      throw error;
    }
  }));

  // ファイル監視の停止
  router.delete('/watch/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = fileWatcher.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`File watcher session not found: ${sessionId}`, 'file-watcher');
    }

    try {
      await fileWatcher.stopWatching(sessionId);

      logger.info('File watching stopped', { sessionId });

      res.json({
        message: 'File watching stopped successfully',
        sessionId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to stop file watching', { sessionId, error });
      throw error;
    }
  }));

  // ファイル変更統計
  router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const stats = fileWatcher.getStats();

    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  // 特定セッションのファイル変更統計
  router.get('/stats/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const session = fileWatcher.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`File watcher session not found: ${sessionId}`, 'file-watcher');
    }

    const now = Date.now();
    const sessionStats = {
      sessionId,
      workspaceDir: session.workspaceDir,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      fileCount: session.fileCount,
      duration: now - session.createdAt,
      inactiveTime: now - session.lastActivity,
    };

    res.json({
      stats: sessionStats,
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
}