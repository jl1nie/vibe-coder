import express from 'express';
import cors from 'cors';
import { VercelRequest, VercelResponse } from '@vercel/node';

// WebRTC types for Vercel deployment (standalone)
export interface WebRTCOffer {
  type: 'offer';
  sessionId?: string;
  sdp: string;
  timestamp?: number;
}

export interface WebRTCAnswer {
  type: 'answer';
  sessionId?: string;
  sdp: string;
  timestamp?: number;
}

export interface WebRTCIceCandidate {
  sessionId: string;
  candidate: string;
  timestamp: number;
}

export interface SignalMessage {
  type: 'create-session' | 'offer' | 'answer' | 'candidate' | 'get-offer' | 'get-answer' | 'get-candidate';
  sessionId: string;
  hostId: string;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  candidate?: WebRTCIceCandidate;
}

export interface SignalResponse {
  success: boolean;
  message?: string;
  error?: string;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  candidates?: WebRTCIceCandidate[];
}

// Express app level session management (persistent across requests)
interface SessionData {
  hostId: string;
  status: 'waiting' | 'connecting' | 'connected' | 'disconnected';
  createdAt: number;
  lastActivity: number;
  connectedClients: number;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  hostCandidates: WebRTCIceCandidate[];
  clientCandidates: WebRTCIceCandidate[];
}

// Express app level persistent storage
const sessions = new Map<string, SessionData>();

const app = express();

// CORS configuration
const allowedOrigins = [
  'https://vibe-coder.space',
  'https://signaling-esp66xdyy-jl1nie-projects.vercel.app',
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.vibe-coder.space')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Signal endpoint
app.post('/api/signal', (req, res) => {
  const message: SignalMessage = req.body;
  
  if (!message.type || !message.sessionId || !message.hostId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format'
    });
  }

  const sessionId = message.sessionId;
  const now = Date.now();

  switch (message.type) {
    case 'create-session':
      sessions.set(sessionId, {
        hostId: message.hostId,
        status: 'waiting',
        createdAt: now,
        lastActivity: now,
        connectedClients: 0,
        hostCandidates: [],
        clientCandidates: []
      });
      
      return res.json({
        success: true,
        message: 'Session created successfully'
      });

    case 'offer':
      const sessionForOffer = sessions.get(sessionId);
      if (!sessionForOffer) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      sessionForOffer.offer = message.offer;
      sessionForOffer.lastActivity = now;
      sessionForOffer.status = 'connecting';
      
      return res.json({
        success: true,
        message: 'Offer stored successfully'
      });

    case 'answer':
      const sessionForAnswer = sessions.get(sessionId);
      if (!sessionForAnswer) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      sessionForAnswer.answer = message.answer;
      sessionForAnswer.lastActivity = now;
      sessionForAnswer.status = 'connected';
      
      return res.json({
        success: true,
        message: 'Answer stored successfully'
      });

    case 'candidate':
      const sessionForCandidate = sessions.get(sessionId);
      if (!sessionForCandidate) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      if (message.candidate) {
        // Determine if this is from host or client based on hostId
        if (message.hostId === sessionForCandidate.hostId) {
          sessionForCandidate.hostCandidates.push(message.candidate);
        } else {
          sessionForCandidate.clientCandidates.push(message.candidate);
        }
      }

      sessionForCandidate.lastActivity = now;
      
      return res.json({
        success: true,
        message: 'Candidate stored successfully'
      });

    case 'get-offer':
      const sessionForGetOffer = sessions.get(sessionId);
      if (!sessionForGetOffer || !sessionForGetOffer.offer) {
        return res.status(404).json({
          success: false,
          error: 'Offer not found'
        });
      }

      return res.json({
        success: true,
        offer: sessionForGetOffer.offer
      });

    case 'get-answer':
      const sessionForGetAnswer = sessions.get(sessionId);
      if (!sessionForGetAnswer || !sessionForGetAnswer.answer) {
        return res.status(404).json({
          success: false,
          error: 'Answer not found'
        });
      }

      return res.json({
        success: true,
        answer: sessionForGetAnswer.answer
      });

    case 'get-candidate':
      const sessionForGetCandidate = sessions.get(sessionId);
      if (!sessionForGetCandidate) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      // Return candidates from the opposite side
      const candidatesToReturn = message.hostId === sessionForGetCandidate.hostId
        ? sessionForGetCandidate.clientCandidates
        : sessionForGetCandidate.hostCandidates;

      return res.json({
        success: true,
        candidates: candidatesToReturn
      });

    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid message type'
      });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Signaling server is running',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

// Session management endpoint
app.post('/api/session', (req, res) => {
  res.json({
    success: true,
    message: 'Session endpoint active',
    timestamp: new Date().toISOString()
  });
});

// Serve static PWA files
app.use(express.static('public'));

// Root redirect to PWA
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Export for Vercel
export default app;