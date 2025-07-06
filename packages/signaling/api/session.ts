import { NextRequest, NextResponse } from 'next/server';
import { SessionResponse } from '@vibe-coder/shared';

// メモリ内セッション管理（Edge Functions用）
const sessions = new Map<string, {
  hostId: string;
  status: 'waiting' | 'connected' | 'disconnected';
  createdAt: number;
  lastActivity: number;
  connectedClients: number;
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
  const { method } = req;
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  try {
    cleanupExpiredSessions();

    switch (method) {
      case 'POST': {
        // セッション作成
        const body = await req.json();
        const { hostId } = body;

        if (!hostId || !sessionId) {
          return NextResponse.json(
            { success: false, error: 'hostId and sessionId are required' },
            { status: 400 }
          );
        }

        sessions.set(sessionId, {
          hostId,
          status: 'waiting',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          connectedClients: 0
        });

        const createResponse: SessionResponse = {
          success: true,
          message: 'Session created successfully',
          sessionInfo: {
            sessionId,
            hostId,
            status: 'waiting',
            createdAt: Date.now(),
            connectedClients: 0
          }
        };

        return NextResponse.json(createResponse);
      }

      case 'GET': {
        // セッション情報取得
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'sessionId is required' },
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

        session.lastActivity = Date.now();

        const getResponse: SessionResponse = {
          success: true,
          sessionInfo: {
            sessionId,
            hostId: session.hostId,
            status: session.status,
            createdAt: session.createdAt,
            connectedClients: session.connectedClients
          }
        };

        return NextResponse.json(getResponse);
      }

      case 'PUT': {
        // セッション状態更新
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'sessionId is required' },
            { status: 400 }
          );
        }

        const updateBody = await req.json();
        const { status, connectedClients } = updateBody;

        const updateSession = sessions.get(sessionId);
        if (!updateSession) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        if (status) {
          updateSession.status = status;
        }
        if (typeof connectedClients === 'number') {
          updateSession.connectedClients = connectedClients;
        }
        updateSession.lastActivity = Date.now();

        const updateResponse: SessionResponse = {
          success: true,
          message: 'Session updated successfully',
          sessionInfo: {
            sessionId,
            hostId: updateSession.hostId,
            status: updateSession.status,
            createdAt: updateSession.createdAt,
            connectedClients: updateSession.connectedClients
          }
        };

        return NextResponse.json(updateResponse);
      }

      case 'DELETE': {
        // セッション削除
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'sessionId is required' },
            { status: 400 }
          );
        }

        const deleted = sessions.delete(sessionId);
        if (!deleted) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        const deleteResponse: SessionResponse = {
          success: true,
          message: 'Session deleted successfully'
        };

        return NextResponse.json(deleteResponse);
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Method not allowed' },
          { status: 405 }
        );
    }
  } catch (error) {
    console.error('Session management error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}