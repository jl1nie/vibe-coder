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

  /**
   * WebRTC Answer処理（シグナリングサーバーからの通知）
   */
  router.post('/answer', authenticateSession(sessionManager), async (req, res) => {
    try {
      const { sessionId, answer } = req.body;
      
      if (!sessionId || !answer) {
        return res.status(400).json({
          success: false,
          error: 'Session ID and answer are required'
        });
      }

      await webrtcService.handleAnswer(sessionId, answer);
      
      logger.info('WebRTC answer processed', { sessionId });

      res.json({
        success: true,
        message: 'Answer processed successfully'
      });
    } catch (error) {
      logger.error('Failed to process WebRTC answer', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to process answer'
      });
    }
  });

  /**
   * WebRTC ICE Candidate処理
   */
  router.post('/ice-candidate', authenticateSession(sessionManager), async (req, res) => {
    try {
      const { sessionId, candidate } = req.body;
      
      if (!sessionId || !candidate) {
        return res.status(400).json({
          success: false,
          error: 'Session ID and candidate are required'
        });
      }

      await webrtcService.handleIceCandidate(sessionId, candidate);
      
      logger.info('WebRTC ICE candidate processed', { sessionId });

      res.json({
        success: true,
        message: 'ICE candidate processed successfully'
      });
    } catch (error) {
      logger.error('Failed to process WebRTC ICE candidate', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to process ICE candidate'
      });
    }
  });

  /**
   * WebRTC シグナリング統合エンドポイント（PWAクライアント用）
   */
  router.post('/signal', async (req, res) => {
    try {
      const { type, sessionId, hostId, offer, candidate } = req.body;
      
      logger.info('WebRTC signaling request', { type, sessionId, hostId });
      
      switch (type) {
        case 'create-session':
          // WebRTCセッション作成
          try {
            const connection = await webrtcService.createConnection(sessionId);
            logger.info('WebRTC session created', { sessionId, connectionId: connection.id });
            
            res.json({
              success: true,
              message: 'WebRTC session created',
              sessionId: sessionId,
              connectionId: connection.id
            });
          } catch (error) {
            logger.error('Failed to create WebRTC session', {
              sessionId,
              error: (error as Error).message
            });
            
            res.status(500).json({
              success: false,
              error: 'Failed to create WebRTC session'
            });
          }
          break;
          
        case 'offer':
          // オファー受信 - ホスト側でアンサーを生成
          if (!offer) {
            return res.status(400).json({
              success: false,
              error: 'Offer is required'
            });
          }
          
          try {
            const connection = webrtcService.getConnectionBySessionId(sessionId);
            if (!connection) {
              return res.status(404).json({
                success: false,
                error: 'WebRTC session not found'
              });
            }
            
            // Simple-peerでのsignal処理（PWAからのofferを受信）
            connection.peer.signal(offer);
            
            res.json({
              success: true,
              message: 'Offer received and processed',
              sessionId: sessionId
            });
          } catch (error) {
            logger.error('Failed to process offer', {
              sessionId,
              error: (error as Error).message
            });
            
            res.status(500).json({
              success: false,
              error: 'Failed to process offer'
            });
          }
          break;
          
        case 'get-answer':
          // アンサー取得 - 現在の実装では未対応（Simple-peerが自動的に処理）
          res.json({
            success: true,
            answer: null,
            message: 'Answer handling via Simple-peer signaling'
          });
          break;
          
        case 'candidate':
          // ICE候補受信
          if (!candidate) {
            return res.status(400).json({
              success: false,
              error: 'Candidate is required'
            });
          }
          
          try {
            const connection = webrtcService.getConnectionBySessionId(sessionId);
            if (!connection) {
              return res.status(404).json({
                success: false,
                error: 'WebRTC session not found'
              });
            }
            
            // ICE candidateをSimple-peerに送信
            connection.peer.signal(candidate);
            
            res.json({
              success: true,
              message: 'ICE candidate received and processed'
            });
          } catch (error) {
            logger.error('Failed to process ICE candidate', {
              sessionId,
              error: (error as Error).message
            });
            
            res.status(500).json({
              success: false,
              error: 'Failed to process ICE candidate'
            });
          }
          break;
          
        case 'get-candidate':
          // ICE候補取得 - Simple-peerが自動的に処理するため未対応
          res.json({
            success: true,
            candidates: [],
            message: 'ICE candidates handled via Simple-peer signaling'
          });
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Unknown signal type'
          });
      }
    } catch (error) {
      logger.error('WebRTC signaling error', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        success: false,
        error: 'WebRTC signaling failed'
      });
    }
  });

  return router;
}