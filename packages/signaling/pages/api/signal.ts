import { NextApiRequest, NextApiResponse } from 'next';

interface Session {
  sessionId: string;
  hostId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidates: { [hostId: string]: RTCIceCandidateInit[] };
}

// In-memory storage for sessions (Edge Function stateless fix)
const sessions: Map<string, Session> = new Map();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('vibe-coder.space'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const { type, sessionId, hostId } = req.body;

  if (!type || !sessionId || !hostId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format',
    });
  }

  switch (type) {
    case 'create-session':
      sessions.set(sessionId, {
        sessionId,
        hostId,
        candidates: {},
      });
      return res.status(200).json({
        success: true,
        message: 'Session created successfully',
      });

    case 'offer': {
      const session = sessions.get(sessionId);
      if (session) {
        session.offer = req.body.offer;
        return res.status(200).json({
          success: true,
          message: 'Offer stored successfully',
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    case 'answer': {
      const answerSession = sessions.get(sessionId);
      if (answerSession) {
        answerSession.answer = req.body.answer;
        return res.status(200).json({
          success: true,
          message: 'Answer stored successfully',
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    case 'get-offer': {
      const offerSession = sessions.get(sessionId);
      if (offerSession && offerSession.offer) {
        return res.status(200).json({
          success: true,
          offer: offerSession.offer,
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Offer not found',
      });
    }

    case 'get-answer': {
      const getAnswerSession = sessions.get(sessionId);
      if (getAnswerSession && getAnswerSession.answer) {
        return res.status(200).json({
          success: true,
          answer: getAnswerSession.answer,
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Answer not found',
      });
    }

    case 'candidate': {
      const candidateSession = sessions.get(sessionId);
      if (candidateSession) {
        if (!candidateSession.candidates[hostId]) {
          candidateSession.candidates[hostId] = [];
        }
        candidateSession.candidates[hostId].push(req.body.candidate);
        return res.status(200).json({
          success: true,
          message: 'ICE candidate stored successfully',
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    case 'get-candidate': {
      const getCandidateSession = sessions.get(sessionId);
      if (getCandidateSession) {
        // Return candidates from other hosts (not the requesting host)
        const candidates = Object.keys(getCandidateSession.candidates)
          .filter(id => id !== hostId)
          .flatMap(id => getCandidateSession.candidates[id]);
        
        return res.status(200).json({
          success: true,
          candidates,
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
      });
  }
}