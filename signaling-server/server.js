const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// セキュリティミドルウェア
app.use(helmet());

// CORS設定
app.use(cors({
  origin: [
    'http://localhost:5174',           // PWA開発環境
    'https://www.vibe-coder.space',    // PWA本番環境
    /https:\/\/.*\.quickconnect\.to$/  // NAS QuickConnect
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// WebRTCセッション管理 (メモリ内永続化)
const sessions = new Map();
const hosts = new Map();

// ログ用ヘルパー
const log = (message, data = {}) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
};

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vibe-coder-signaling',
    version: '1.0.0',
    sessions: sessions.size,
    hosts: hosts.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ホスト登録
app.post('/api/hosts/register', (req, res) => {
  const { hostId, capabilities, port } = req.body;
  
  if (!hostId) {
    return res.status(400).json({
      success: false,
      error: 'hostId is required'
    });
  }
  
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  
  hosts.set(hostId, {
    hostId,
    ip: clientIP,
    port: port || 8080,
    capabilities: capabilities || [],
    lastSeen: Date.now(),
    status: 'online'
  });
  
  log(`Host registered: ${hostId}`, { ip: clientIP, port, capabilities });
  
  res.json({
    success: true,
    message: 'Host registered successfully',
    hostId
  });
});

// ホスト一覧取得
app.get('/api/hosts', (req, res) => {
  const now = Date.now();
  const HOST_TIMEOUT = 60000; // 1分
  
  // タイムアウトしたホストを除外
  const activeHosts = Array.from(hosts.values())
    .filter(host => now - host.lastSeen < HOST_TIMEOUT);
  
  res.json({
    success: true,
    hosts: activeHosts,
    count: activeHosts.length
  });
});

// WebRTCシグナリング
app.post('/api/signal', (req, res) => {
  const { type, sessionId, hostId } = req.body;
  
  if (!type || !sessionId || !hostId) {
    return res.status(400).json({
      success: false,
      error: 'type, sessionId, and hostId are required'
    });
  }
  
  log(`Signal: ${type}`, { sessionId, hostId });
  
  switch (type) {
    case 'create-session': {
      sessions.set(sessionId, {
        sessionId,
        hostId,
        candidates: {},
        createdAt: Date.now()
      });
      
      log(`Session created: ${sessionId} for host ${hostId}`);
      
      return res.json({
        success: true,
        message: 'Session created successfully',
        sessionId
      });
    }
    
    case 'offer': {
      const session = sessions.get(sessionId);
      if (session) {
        session.offer = req.body.offer;
        session.lastActivity = Date.now();
        
        log(`Offer stored for session: ${sessionId}`);
        
        return res.json({
          success: true,
          message: 'Offer stored successfully'
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    case 'answer': {
      const session = sessions.get(sessionId);
      if (session) {
        session.answer = req.body.answer;
        session.lastActivity = Date.now();
        
        log(`Answer stored for session: ${sessionId}`);
        
        return res.json({
          success: true,
          message: 'Answer stored successfully'
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    case 'get-offer': {
      const session = sessions.get(sessionId);
      if (session && session.offer) {
        return res.json({
          success: true,
          offer: session.offer
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }
    
    case 'get-answer': {
      const session = sessions.get(sessionId);
      if (session && session.answer) {
        return res.json({
          success: true,
          answer: session.answer
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Answer not found'
      });
    }
    
    case 'candidate': {
      const session = sessions.get(sessionId);
      if (session) {
        if (!session.candidates[hostId]) {
          session.candidates[hostId] = [];
        }
        session.candidates[hostId].push(req.body.candidate);
        session.lastActivity = Date.now();
        
        return res.json({
          success: true,
          message: 'ICE candidate stored successfully'
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    case 'get-candidates': {
      const session = sessions.get(sessionId);
      if (session) {
        // 要求元以外のホストからのCandidateを返す
        const candidates = Object.keys(session.candidates)
          .filter(id => id !== hostId)
          .flatMap(id => session.candidates[id]);
        
        return res.json({
          success: true,
          candidates
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    default:
      return res.status(400).json({
        success: false,
        error: `Invalid signal type: ${type}`
      });
  }
});

// セッション・ホスト自動クリーンアップ
const startCleanupTimer = () => {
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分
  const HOST_TIMEOUT = 5 * 60 * 1000; // 5分
  
  setInterval(() => {
    const now = Date.now();
    
    // セッションクリーンアップ
    for (const [sessionId, session] of sessions) {
      const lastActivity = session.lastActivity || session.createdAt;
      if (now - lastActivity > SESSION_TIMEOUT) {
        sessions.delete(sessionId);
        log(`Session expired and removed: ${sessionId}`);
      }
    }
    
    // ホストクリーンアップ
    for (const [hostId, host] of hosts) {
      if (now - host.lastSeen > HOST_TIMEOUT) {
        hosts.delete(hostId);
        log(`Host expired and removed: ${hostId}`);
      }
    }
    
    log('Cleanup completed', {
      activeSessions: sessions.size,
      activeHosts: hosts.size
    });
  }, CLEANUP_INTERVAL);
};

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  log(`Vibe Coder Signaling Server started`, {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development'
  });
  
  log('Available endpoints:', {
    health: `http://localhost:${PORT}/api/health`,
    hosts: `http://localhost:${PORT}/api/hosts`,
    signal: `http://localhost:${PORT}/api/signal`
  });
  
  // クリーンアップタイマー開始
  startCleanupTimer();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  process.exit(0);
});