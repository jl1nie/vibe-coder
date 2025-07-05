import { VercelRequest, VercelResponse } from '@vercel/node';

// ルートエンドポイント
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiInfo = {
    service: 'Vibe Coder Signaling Server',
    version: '1.0.0',
    description: 'WebRTC signaling and playlist discovery service for Vibe Coder',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    endpoints: {
      signaling: {
        post: '/api/signal',
        get: '/api/signal?type={type}&serverId={serverId}',
        description: 'WebRTC signaling relay service',
      },
      playlists: {
        get: '/api/playlists',
        post: '/api/playlists',
        description: 'Playlist discovery and statistics',
        parameters: {
          search: 'Search term for playlist filtering',
          category: 'Category filter',
          author: 'Author filter',
          limit: 'Number of results (max 50)',
          offset: 'Results offset for pagination',
          refresh: 'Set to "true" to bypass cache',
        },
      },
      stats: {
        get: '/api/stats',
        description: 'Service statistics and health information',
        parameters: {
          type: 'Stats type: "health", "ratelimit", or omit for all stats',
        },
      },
    },
    limits: {
      signaling: {
        rateLimit: '30 requests per minute per IP',
        dataSize: '100KB max per request',
        ttl: '60 seconds',
      },
      playlists: {
        cache: '1 hour',
        maxResults: '50 per request',
        githubLimit: '20 playlists from GitHub search',
      },
    },
  };

  return res.status(200).json(apiInfo);
}