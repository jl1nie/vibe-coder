import { NextRequest, NextResponse } from 'next/server';
import { 
  SignalResponse, 
  WebRTCOffer, 
  WebRTCAnswer,
  WebRTCIceCandidate,
  SignalMessage
} from '@vibe-coder/shared';

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

const sessions = new Map<string, SessionData>();

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

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    cleanupExpiredSessions();

    const body = await req.json();
    // 基本的な型チェック
    if (!body.type || !body.sessionId || !body.hostId) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // 許可されたtypeかチェック
    const validTypes = ['create-session', 'offer', 'answer', 'get-offer', 'get-answer', 'candidate', 'get-candidate'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { type, sessionId, hostId, offer, answer, candidate } = body as SignalMessage;

    switch (type) {
      case 'create-session': {
        // セッション作成
        if (!sessionId || !hostId) {
          return NextResponse.json(
            { success: false, error: 'sessionId and hostId are required' },
            { status: 400 }
          );
        }

        const newSession: SessionData = {
          hostId,
          status: 'waiting',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          connectedClients: 0,
          hostCandidates: [],
          clientCandidates: []
        };

        sessions.set(sessionId, newSession);

        const createResponse: SignalResponse = {
          success: true,
          message: 'Session created successfully'
        };

        return NextResponse.json(createResponse);
      }

      case 'offer': {
        // ホストからのOfferを保存
        if (!offer) {
          return NextResponse.json(
            { success: false, error: 'Offer data required' },
            { status: 400 }
          );
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
            clientCandidates: []
          };
          sessions.set(sessionId, session);
        }

        session.offer = offer;
        session.status = 'connecting';
        session.lastActivity = Date.now();

        const response: SignalResponse = {
          success: true,
          message: 'Offer stored successfully'
        };

        return NextResponse.json(response);
      }

      case 'answer': {
        // クライアントからのAnswerを保存
        if (!answer) {
          return NextResponse.json(
            { success: false, error: 'Answer data required' },
            { status: 400 }
          );
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        session.answer = answer;
        session.status = 'connected';
        session.connectedClients = 1;
        session.lastActivity = Date.now();

        const answerResponse: SignalResponse = {
          success: true,
          message: 'Answer stored successfully'
        };

        return NextResponse.json(answerResponse);
      }

      case 'candidate': {
        if (!candidate) {
          return NextResponse.json(
            { success: false, error: 'Candidate data required' },
            { status: 400 }
          );
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        // ホストからの候補かクライアントからの候補かを判定
        // リクエスト元のhostIdがセッションのhostIdと一致するかで判定
        const isFromHost = hostId === session.hostId;
        
        const candidateData: WebRTCIceCandidate = {
          sessionId,
          candidate: JSON.stringify(candidate),
          timestamp: Date.now()
        };

        if (isFromHost) {
          session.hostCandidates.push(candidateData);
        } else {
          session.clientCandidates.push(candidateData);
        }
        
        session.lastActivity = Date.now();

        const candidateResponse: SignalResponse = {
          success: true,
          message: 'Candidate stored successfully'
        };

        return NextResponse.json(candidateResponse);
      }

      case 'get-offer': {
        // クライアントがOfferを取得
        const offerSession = sessions.get(sessionId);
        if (!offerSession || !offerSession.offer) {
          return NextResponse.json(
            { success: false, error: 'Offer not found' },
            { status: 404 }
          );
        }

        offerSession.lastActivity = Date.now();

        const offerResponse: SignalResponse = {
          success: true,
          offer: offerSession.offer
        };

        return NextResponse.json(offerResponse);
      }

      case 'get-answer': {
        // ホストがAnswerを取得
        const answerSession = sessions.get(sessionId);
        if (!answerSession || !answerSession.answer) {
          return NextResponse.json(
            { success: false, error: 'Answer not found' },
            { status: 404 }
          );
        }

        answerSession.lastActivity = Date.now();

        const getAnswerResponse: SignalResponse = {
          success: true,
          answer: answerSession.answer
        };

        return NextResponse.json(getAnswerResponse);
      }

      case 'get-candidate': {
        const candidateSession = sessions.get(sessionId);
        if (!candidateSession) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
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
          candidates: candidates
        };

        return NextResponse.json(getCandidateResponse);
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown signal type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Signal handling error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}