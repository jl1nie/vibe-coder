import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { createLogger } from '../utils/logger';
import { validateWebSocketOrigin } from '../middleware/security';
import { websocketLogger } from '../middleware/logging';
import { websocketErrorHandler } from '../middleware/error';
import { Environment } from '../utils/env';
import { SessionManager } from '../services/session-manager';
import { WebRTCSignalingService } from '../services/webrtc-signaling';

const logger = createLogger('websocket-handler');

export interface WebSocketHandlerDependencies {
  env: Environment;
  sessionManager: SessionManager;
  webrtcService: WebRTCSignalingService;
}

export function setupWebSocketHandler(
  wsServer: WebSocketServer,
  dependencies: WebSocketHandlerDependencies
): void {
  const { env, sessionManager, webrtcService } = dependencies;

  wsServer.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    handleWebSocketConnection(ws, request, dependencies);
  });

  wsServer.on('error', (error) => {
    logger.error('WebSocket server error', { error });
  });

  logger.info('WebSocket handler setup completed');
}

function handleWebSocketConnection(
  ws: WebSocket,
  request: IncomingMessage,
  dependencies: WebSocketHandlerDependencies
): void {
  const { env, sessionManager, webrtcService } = dependencies;

  // Origin検証
  const origin = request.headers.origin;
  if (origin && !validateWebSocketOrigin(origin, env)) {
    logger.warn('WebSocket connection rejected - invalid origin', { origin });
    ws.close(1008, 'Invalid origin');
    return;
  }

  // ログ設定
  websocketLogger(ws, request);

  try {
    // セッションマネージャーで接続を処理
    sessionManager.handleConnection(ws, request);

    // WebRTCピアの登録
    const peerId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    webrtcService.registerPeer(peerId, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.socket.remoteAddress,
      connectionType: 'websocket',
    });

    // WebRTCシグナリングメッセージの処理
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'webrtc-signal') {
          await webrtcService.handleSignalingMessage({
            type: message.payload.signalType,
            data: message.payload.data,
            from: peerId,
            to: message.payload.to,
          });
        }
      } catch (error) {
        logger.error('Failed to process WebSocket message', {
          peerId,
          error,
        });
      }
    });

    // 接続終了時のクリーンアップ
    ws.on('close', () => {
      webrtcService.unregisterPeer(peerId);
      logger.debug('WebSocket connection closed and peer unregistered', { peerId });
    });

    logger.info('WebSocket connection established', {
      peerId,
      origin,
      userAgent: request.headers['user-agent'],
      ipAddress: request.socket.remoteAddress,
    });

  } catch (error) {
    logger.error('Failed to handle WebSocket connection', {
      error,
      origin,
      userAgent: request.headers['user-agent'],
    });
    
    websocketErrorHandler(ws, error as Error);
    ws.close(1011, 'Internal server error');
  }
}