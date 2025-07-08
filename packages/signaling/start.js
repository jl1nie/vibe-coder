const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 5174;

// Express app level persistent storage
const sessions = new Map();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Signaling server is running',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

// WebRTC signaling endpoint
app.post('/api/signal', (req, res) => {
  const { sessionId, hostId, type, ...message } = req.body;
  
  if (!sessionId || !hostId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID and Host ID are required'
    });
  }
  
  const now = Date.now();
  
  switch (type) {
    case 'create-session':
      sessions.set(sessionId, {
        hostId,
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
        if (hostId === sessionForCandidate.hostId) {
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
      
      const candidatesToReturn = hostId === sessionForGetCandidate.hostId
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

// Session management endpoint
app.post('/api/session', (req, res) => {
  res.json({
    success: true,
    message: 'Session endpoint active',
    timestamp: new Date().toISOString()
  });
});

// Fallback for PWA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Signaling server running on http://localhost:${port}`);
});