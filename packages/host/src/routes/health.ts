import { Router } from 'express';
import { ClaudeService } from '../services/claude-service';
import { SessionManager } from '../services/session-manager';
import { HealthStatus } from '../types';
import { asyncHandler } from '../middleware/error';

export function createHealthRouter(
  claudeService: ClaudeService,
  sessionManager: SessionManager
): Router {
  const router = Router();

  router.get('/health', asyncHandler(async (_req, res) => {
    const startTime = Date.now();
    
    // Check Claude Code availability
    const claudeAvailable = await claudeService.healthCheck();
    
    // Get system information
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Get session information
    const activeSessions = sessionManager.getActiveSessions();
    const totalSessions = sessionManager.getTotalSessions();
    
    const health: HealthStatus = {
      status: claudeAvailable ? 'healthy' : 'degraded',
      timestamp: new Date(),
      uptime,
      sessions: {
        active: activeSessions.length,
        total: totalSessions,
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      claude: {
        available: claudeAvailable,
        lastCheck: new Date(),
      },
    };

    const responseTime = Date.now() - startTime;
    
    res.status(health.status === 'healthy' ? 200 : 503).json({
      ...health,
      responseTime,
    });
  }));

  router.get('/health/live', (_req, res) => {
    // Simple liveness probe
    res.status(200).json({
      status: 'alive',
      timestamp: new Date(),
    });
  });

  router.get('/health/ready', asyncHandler(async (_req, res) => {
    // Readiness probe - check if service can handle requests
    const claudeAvailable = await claudeService.healthCheck();
    const memUsage = process.memoryUsage();
    const memoryPressure = (memUsage.heapUsed / memUsage.heapTotal) > 0.9;
    
    const ready = claudeAvailable && !memoryPressure;
    
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not-ready',
      checks: {
        claude: claudeAvailable,
        memory: !memoryPressure,
      },
      timestamp: new Date(),
    });
  }));

  return router;
}