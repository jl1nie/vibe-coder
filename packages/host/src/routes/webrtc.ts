import { Router, Request, Response } from 'express';
import { RouteDependencies } from './index';
import { asyncHandler, ValidationError } from '../middleware/error';
import { createLogger } from '../utils/logger';

const logger = createLogger('webrtc-routes');

export function createWebRTCRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const { webrtcService } = dependencies;

  // サーバー情報の取得
  router.get('/server', asyncHandler(async (req: Request, res: Response) => {
    const serverId = webrtcService.getServerId();
    const iceServers = webrtcService.getIceServers();
    const stats = webrtcService.getStats();

    res.json({
      serverId,
      iceServers,
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  // ピアの登録
  router.post('/peers', asyncHandler(async (req: Request, res: Response) => {
    const { peerId, metadata } = req.body;

    if (!peerId) {
      throw new ValidationError('peerId is required');
    }

    try {
      const connection = webrtcService.registerPeer(peerId, {
        ...metadata,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
      });

      logger.info('Peer registered via HTTP', {
        peerId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({
        message: 'Peer registered successfully',
        connection,
        serverId: webrtcService.getServerId(),
        iceServers: webrtcService.getIceServers(),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to register peer', { peerId, error });
      throw error;
    }
  }));

  // シグナリングメッセージの送信
  router.post('/signal', asyncHandler(async (req: Request, res: Response) => {
    const { type, data, from, to } = req.body;

    if (!type || !data || !from) {
      throw new ValidationError('type, data, and from are required');
    }

    try {
      await webrtcService.handleSignalingMessage({
        type,
        data,
        from,
        to,
      });

      logger.debug('Signaling message processed', {
        type,
        from,
        to,
        ipAddress: req.ip,
      });

      res.json({
        message: 'Signaling message processed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to process signaling message', {
        type,
        from,
        to,
        error,
      });
      throw error;
    }
  }));

  // 接続されたピア一覧
  router.get('/peers', asyncHandler(async (req: Request, res: Response) => {
    const connectedPeers = webrtcService.getConnectedPeers();

    res.json({
      peers: connectedPeers,
      count: connectedPeers.length,
      timestamp: new Date().toISOString(),
    });
  }));

  // 特定ピアの情報取得
  router.get('/peers/:peerId', asyncHandler(async (req: Request, res: Response) => {
    const { peerId } = req.params;
    
    const peer = webrtcService.getPeer(peerId);
    if (!peer) {
      return res.status(404).json({
        error: 'Peer not found',
        peerId,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      peer,
      timestamp: new Date().toISOString(),
    });
  }));

  // ピアの削除
  router.delete('/peers/:peerId', asyncHandler(async (req: Request, res: Response) => {
    const { peerId } = req.params;

    webrtcService.unregisterPeer(peerId);

    logger.info('Peer unregistered via HTTP', { peerId });

    res.json({
      message: 'Peer unregistered successfully',
      peerId,
      timestamp: new Date().toISOString(),
    });
  }));

  // WebRTC統計情報
  router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const stats = webrtcService.getStats();

    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
}