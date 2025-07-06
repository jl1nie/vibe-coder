import { Router } from 'express';
import { ClaudeService } from '../services/claude-service';
import { SessionManager } from '../services/session-manager';
import { createAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

export function createClaudeRouter(
  claudeService: ClaudeService,
  sessionManager: SessionManager
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(sessionManager);

  // Execute Claude Code command
  router.post('/execute',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { command } = req.body;
      const sessionId = req.sessionId!;

      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      // Check if another command is already running for this session
      if (claudeService.isCommandRunning(sessionId)) {
        return res.status(409).json({ 
          error: 'Another command is already running for this session' 
        });
      }

      logger.info('Executing command', { sessionId, command });

      const result = await claudeService.executeCommand(sessionId, command);
      
      res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        timestamp: new Date(),
      });
    })
  );

  // Cancel running command
  router.post('/cancel',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const sessionId = req.sessionId!;
      
      const cancelled = claudeService.cancelCommand(sessionId);
      
      if (cancelled) {
        res.json({
          success: true,
          message: 'Command cancelled successfully',
        });
      } else {
        res.status(404).json({
          error: 'No running command found for this session',
        });
      }
    })
  );

  // Get command execution status
  router.get('/status',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const sessionId = req.sessionId!;
      
      const isRunning = claudeService.isCommandRunning(sessionId);
      
      res.json({
        sessionId,
        isRunning,
        timestamp: new Date(),
      });
    })
  );

  // Get Claude Code health status
  router.get('/health',
    authMiddleware,
    asyncHandler(async (_req, res) => {
      const isHealthy = await claudeService.healthCheck();
      
      res.json({
        available: isHealthy,
        runningCommands: claudeService.getRunningCommandsCount(),
        timestamp: new Date(),
      });
    })
  );

  return router;
}