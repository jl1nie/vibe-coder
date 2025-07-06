import { NextRequest, NextResponse } from 'next/server';
import { 
  SignalMessageSchema, 
  SignalResponse, 
  WebRTCOffer, 
  WebRTCAnswer 
} from '@vibe-coder/shared';

// Edge Functions には永続化機能がないため、メモリ内でのみ一時的なセッション管理
const sessions = new Map<string, {
  hostId: string;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  createdAt: number;
  lastActivity: number;
}>();

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
    const result = SignalMessageSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { type, sessionId, hostId, offer, answer } = result.data;

    switch (type) {
      case 'offer': {
        // ホストからのOfferを保存
        if (!offer) {
          return NextResponse.json(
            { success: false, error: 'Offer data required' },
            { status: 400 }
          );
        }

        sessions.set(sessionId, {
          hostId,
          offer,
          createdAt: Date.now(),
          lastActivity: Date.now()
        });

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
        session.lastActivity = Date.now();

        const answerResponse: SignalResponse = {
          success: true,
          message: 'Answer stored successfully'
        };

        return NextResponse.json(answerResponse);
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