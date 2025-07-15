import { Router } from 'express';
import { WebRTCService } from '../services/webrtc-service';
import { SessionManager } from '../services/session-manager';
import { authenticateSession } from '../middleware/auth';
import logger from '../utils/logger';

export function createWebRTCRouter(
  webrtcService: WebRTCService,
  sessionManager: SessionManager
): Router {
  const router = Router();

  /**
   * WebRTC接続の開始
   */
  router.post('/start', authenticateSession(sessionManager), async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
      }

      // セッションの存在確認
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      // WebRTC接続を開始
      const connection = await webrtcService.createConnection(sessionId);
      
      logger.info('WebRTC connection started', {
        sessionId,
        connectionId: connection.id,
        hostId: sessionManager.getHostId()
      });

      res.json({
        success: true,
        connectionId: connection.id,
        message: 'WebRTC connection started successfully'
      });
    } catch (error) {
      logger.error('Failed to start WebRTC connection', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to start WebRTC connection'
      });
    }
  });

  /**
   * WebRTC接続の状態確認
   */
  router.get('/status/:sessionId', authenticateSession(sessionManager), async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const connection = webrtcService.getConnectionBySessionId(sessionId);
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found'
        });
      }

      res.json({
        success: true,
        connection: {
          id: connection.id,
          sessionId: connection.sessionId,
          isConnected: connection.isConnected,
          createdAt: connection.createdAt,
          lastActivity: connection.lastActivity
        }
      });
    } catch (error) {
      logger.error('Failed to get WebRTC connection status', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get connection status'
      });
    }
  });

  /**
   * WebRTC接続の終了
   */
  router.post('/stop', authenticateSession(sessionManager), async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
      }

      const connection = webrtcService.getConnectionBySessionId(sessionId);
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found'
        });
      }

      webrtcService.removeConnection(connection.id);
      
      logger.info('WebRTC connection stopped', {
        sessionId,
        connectionId: connection.id,
        hostId: sessionManager.getHostId()
      });

      res.json({
        success: true,
        message: 'WebRTC connection stopped successfully'
      });
    } catch (error) {
      logger.error('Failed to stop WebRTC connection', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to stop WebRTC connection'
      });
    }
  });

  /**
   * 全てのWebRTC接続の一覧
   */
  router.get('/connections', authenticateSession(sessionManager), async (_req, res) => {
    try {
      const connections = webrtcService.getConnections();
      
      res.json({
        success: true,
        connections: connections.map(conn => ({
          id: conn.id,
          sessionId: conn.sessionId,
          isConnected: conn.isConnected,
          createdAt: conn.createdAt,
          lastActivity: conn.lastActivity
        }))
      });
    } catch (error) {
      logger.error('Failed to get WebRTC connections', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get connections'
      });
    }
  });

  // Note: WebRTC signaling endpoints (answer, ice-candidate, signal) have been 
  // removed as they are now handled through WebSocket signaling for better 
  // real-time performance and simplified architecture.

  return router;
}