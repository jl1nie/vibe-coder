import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// 統計情報の取得
async function getSignalingStats(): Promise<any> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 今日の統計
    const todayStats = await kv.hgetall(`signaling:stats:daily:${today}`) || {};
    
    // 昨日の統計
    const yesterdayStats = await kv.hgetall(`signaling:stats:daily:${yesterday}`) || {};
    
    // サーバー別統計
    const serverStats = await kv.hgetall('signaling:stats:servers') || {};
    
    // プレイリスト統計
    const playlistLastUpdated = await kv.get('playlists:last_updated');
    
    return {
      signaling: {
        today: {
          total: parseInt((todayStats as any)?.total || '0'),
          offer: parseInt((todayStats as any)?.offer || '0'),
          answer: parseInt((todayStats as any)?.answer || '0'),
          'ice-candidate': parseInt((todayStats as any)?.['ice-candidate'] || '0'),
        },
        yesterday: {
          total: parseInt((yesterdayStats as any)?.total || '0'),
          offer: parseInt((yesterdayStats as any)?.offer || '0'),
          answer: parseInt((yesterdayStats as any)?.answer || '0'),
          'ice-candidate': parseInt((yesterdayStats as any)?.['ice-candidate'] || '0'),
        },
        servers: Object.entries(serverStats).map(([serverId, count]) => ({
          serverId,
          requests: parseInt(count as string),
        })),
      },
      playlists: {
        lastUpdated: playlistLastUpdated || null,
        cacheAge: playlistLastUpdated ? Date.now() - (playlistLastUpdated as number) : null,
      },
      system: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    };
  } catch (error) {
    console.error('Failed to get stats:', error);
    throw error;
  }
}

// レート制限統計の取得
async function getRateLimitStats(): Promise<any> {
  try {
    // 現在アクティブなレート制限の数を取得（概算）
    const keys = await kv.keys('ratelimit:*');
    
    const activeLimits = keys.length;
    
    return {
      activeLimits,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get rate limit stats:', error);
    return {
      activeLimits: 0,
      error: 'Failed to retrieve rate limit stats',
    };
  }
}

// ヘルスチェック情報
function getHealthInfo(): any {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}

// メインハンドラー
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

  const { type } = req.query;

  try {
    switch (type) {
      case 'health':
        return res.status(200).json(getHealthInfo());
        
      case 'ratelimit':
        const rateLimitStats = await getRateLimitStats();
        return res.status(200).json(rateLimitStats);
        
      default:
        // 全統計情報
        const stats = await getSignalingStats();
        return res.status(200).json(stats);
    }
  } catch (error) {
    console.error('Stats API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve statistics',
      timestamp: new Date().toISOString(),
    });
  }
}