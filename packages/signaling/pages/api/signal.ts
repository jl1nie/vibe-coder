import {
  SignalMessage,
  SignalResponse,
  WebRTCAnswer,
  WebRTCIceCandidate,
  WebRTCOffer,
} from '@vibe-coder/shared';
import { NextApiRequest, NextApiResponse } from 'next';

// 統一セッション管理 - 全WebRTC情報を一箇所で管理
interface SessionData {
  // セッション基本情報
  hostId: string;
  status: 'waiting' | 'connecting' | 'connected' | 'disconnected';
  createdAt: number;
  lastActivity: number;
  connectedClients: number;

  // WebRTC情報
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  hostCandidates: WebRTCIceCandidate[]; // ホスト側のICE Candidates
  clientCandidates: WebRTCIceCandidate[]; // クライアント側のICE Candidates
}

// Edge Function stateless問題への対応: globalに永続化
declare global {
  var vibeCoderSessions: Map<string, SessionData> | undefined;
}

const sessions = globalThis.vibeCoderSessions || new Map<string, SessionData>();
if (!globalThis.vibeCoderSessions) {
  globalThis.vibeCoderSessions = sessions;
}

// 5分後に古いセッションを削除
const SESSION_TIMEOUT = 5 * 60 * 1000;

const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
};

const allowedOrigins = [
  'https://vibe-coder.space',
  'https://vibe-coder.space', // ワイルドカードは手動で判定
  'http://localhost:5173',
  'http://localhost:3000',
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  if (
    origin &&
    (allowedOrigins.includes(origin) || origin.endsWith('.vibe-coder.space'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // テスト環境やDevelopment環境でのoriginが未設定の場合のフォールバック
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    cleanupExpiredSessions();

    const body = req.body;
    // 基本的な型チェック
    if (!body.type || !body.sessionId || !body.hostId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
      });
    }

    // 許可されたtypeかチェック
    const validTypes = [
      'create-session',
      'offer',
      'answer',
      'get-offer',
      'get-answer',
      'candidate',
      'get-candidate',
    ];
    if (!validTypes.includes(body.type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
      });
    }

    const { type, sessionId, hostId, offer, answer, candidate } =
      body as SignalMessage;

    switch (type) {
      case 'create-session': {
        // セッション作成
        if (!sessionId || !hostId) {
          return res.status(400).json({
            success: false,
            error: 'sessionId and hostId are required',
          });
        }

        const newSession: SessionData = {
          hostId,
          status: 'waiting',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          connectedClients: 0,
          hostCandidates: [],
          clientCandidates: [],
        };

        sessions.set(sessionId, newSession);

        const createResponse: SignalResponse = {
          success: true,
          message: 'Session created successfully',
        };

        return res.status(200).json(createResponse);
      }

      case 'offer': {
        // ホストからのOfferを保存
        if (!offer) {
          return res.status(400).json({
            success: false,
            error: 'Offer data required',
          });
        }

        let session = sessions.get(sessionId);
        if (!session) {
          // セッションが存在しない場合は新規作成
          session = {
            hostId,
            status: 'waiting',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            connectedClients: 0,
            hostCandidates: [],
            clientCandidates: [],
          };
          sessions.set(sessionId, session);
        }

        session.offer = offer;
        session.status = 'connecting';
        session.lastActivity = Date.now();

        const response: SignalResponse = {
          success: true,
          message: 'Offer stored successfully',
        };

        return res.status(200).json(response);
      }

      case 'answer': {
        // クライアントからのAnswerを保存
        if (!answer) {
          return res.status(400).json({
            success: false,
            error: 'Answer data required',
          });
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found',
          });
        }

        session.answer = answer;
        session.status = 'connected';
        session.connectedClients = 1;
        session.lastActivity = Date.now();

        const answerResponse: SignalResponse = {
          success: true,
          message: 'Answer stored successfully',
        };

        return res.status(200).json(answerResponse);
      }

      case 'candidate': {
        if (!candidate) {
          return res.status(400).json({
            success: false,
            error: 'Candidate data required',
          });
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found',
          });
        }

        // ホストからの候補かクライアントからの候補かを判定
        // リクエスト元のhostIdがセッションのhostIdと一致するかで判定
        const isFromHost = hostId === session.hostId;

        const candidateData: WebRTCIceCandidate = {
          sessionId,
          candidate: JSON.stringify(candidate),
          timestamp: Date.now(),
        };

        if (isFromHost) {
          session.hostCandidates.push(candidateData);
        } else {
          session.clientCandidates.push(candidateData);
        }

        session.lastActivity = Date.now();

        const candidateResponse: SignalResponse = {
          success: true,
          message: 'Candidate stored successfully',
        };

        return res.status(200).json(candidateResponse);
      }

      case 'get-offer': {
        // クライアントがOfferを取得
        const offerSession = sessions.get(sessionId);
        if (!offerSession || !offerSession.offer) {
          return res.status(404).json({
            success: false,
            error: 'Offer not found',
          });
        }

        offerSession.lastActivity = Date.now();

        const offerResponse: SignalResponse = {
          success: true,
          offer: offerSession.offer,
        };

        return res.status(200).json(offerResponse);
      }

      case 'get-answer': {
        // ホストがAnswerを取得
        const answerSession = sessions.get(sessionId);
        if (!answerSession || !answerSession.answer) {
          return res.status(404).json({
            success: false,
            error: 'Answer not found',
          });
        }

        answerSession.lastActivity = Date.now();

        const getAnswerResponse: SignalResponse = {
          success: true,
          answer: answerSession.answer,
        };

        return res.status(200).json(getAnswerResponse);
      }

      case 'get-candidate': {
        const candidateSession = sessions.get(sessionId);
        if (!candidateSession) {
          return res.status(404).json({
            success: false,
            error: 'Session not found',
          });
        }

        // リクエスト元に応じて適切な候補を返す
        const isFromHost = hostId === candidateSession.hostId;
        let candidates: WebRTCIceCandidate[];

        if (isFromHost) {
          // ホストからのリクエスト → クライアントの候補を返す
          candidates = candidateSession.clientCandidates.splice(0);
        } else {
          // クライアントからのリクエスト → ホストの候補を返す
          candidates = candidateSession.hostCandidates.splice(0);
        }

        candidateSession.lastActivity = Date.now();

        const getCandidateResponse: SignalResponse = {
          success: true,
          candidates: candidates,
        };

        return res.status(200).json(getCandidateResponse);
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown signal type',
        });
    }
  } catch (error) {
    console.error('Signal handling error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
