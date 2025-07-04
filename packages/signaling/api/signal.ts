import { NextApiRequest, NextApiResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { z } from 'zod';

// レート制限用のキー生成
function getRateLimitKey(ip: string): string {
  return `ratelimit:${ip}`;
}

// IPアドレスの取得
function getClientIP(req: NextApiRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

// シグナリングメッセージのスキーマ
const signalMessageSchema = z.object({
  type: z.enum(['offer', 'answer', 'ice-candidate']),
  serverId: z.string().min(1).max(100),
  data: z.any(),
});

// レート制限の実装
async function checkRateLimit(ip: string): Promise<boolean> {
  const key = getRateLimitKey(ip);
  
  try {
    const requests = await kv.incr(key);
    
    if (requests === 1) {
      // 初回リクエストの場合、TTLを設定
      await kv.expire(key, 60); // 1分間
    }
    
    // 1分間に30リクエストまで
    return requests <= 30;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // エラーの場合は通す
  }
}

// CORS ヘッダーの設定
function setCorsHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// メイン API ハンドラー
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS ヘッダーの設定
  setCorsHeaders(res);
  
  // OPTIONS リクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const clientIP = getClientIP(req);
  
  // レート制限チェック
  const isAllowed = await checkRateLimit(clientIP);
  if (!isAllowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Max 30 requests per minute.',
      retryAfter: 60,
    });
  }
  
  try {
    if (req.method === 'POST') {
      return await handlePost(req, res, clientIP);
    } else if (req.method === 'GET') {
      return await handleGet(req, res, clientIP);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Signal API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process signaling request',
    });
  }
}

// POST リクエストの処理（シグナリングデータの保存）
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  clientIP: string
) {
  // リクエストボディの検証
  const parseResult = signalMessageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.errors,
    });
  }
  
  const { type, serverId, data } = parseResult.data;
  
  // データサイズの制限チェック
  const dataSize = JSON.stringify(data).length;
  if (dataSize > 100000) { // 100KB制限
    return res.status(413).json({
      error: 'Payload too large',
      message: 'Signal data exceeds 100KB limit',
    });
  }
  
  try {
    const key = `${type}:${serverId}`;
    const payload = {
      data,
      timestamp: Date.now(),
      clientIP,
    };
    
    // データを60秒間保存
    await kv.setex(key, 60, JSON.stringify(payload));
    
    // 統計情報の更新
    await updateStats(type, serverId);
    
    console.log(`Signal stored: ${type} for server ${serverId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Signal stored successfully',
      type,
      serverId,
      expiresIn: 60,
    });
    
  } catch (error) {
    console.error('Failed to store signal:', error);
    return res.status(500).json({
      error: 'Storage error',
      message: 'Failed to store signaling data',
    });
  }
}

// GET リクエストの処理（シグナリングデータの取得）
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  clientIP: string
) {
  const { type, serverId } = req.query;
  
  if (!type || !serverId) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Both type and serverId are required',
    });
  }
  
  if (typeof type !== 'string' || typeof serverId !== 'string') {
    return res.status(400).json({
      error: 'Invalid parameters',
      message: 'Parameters must be strings',
    });
  }
  
  try {
    const key = `${type}:${serverId}`;
    const storedData = await kv.get(key);
    
    if (!storedData) {
      return res.status(200).json({
        data: null,
        message: 'No signal data found',
      });
    }
    
    let parsedData;
    try {
      parsedData = typeof storedData === 'string' 
        ? JSON.parse(storedData) 
        : storedData;
    } catch (parseError) {
      console.error('Failed to parse stored data:', parseError);
      return res.status(500).json({
        error: 'Data corruption',
        message: 'Stored data is corrupted',
      });
    }
    
    // 取得後にデータを削除（一度きりの取得）
    await kv.del(key);
    
    console.log(`Signal retrieved: ${type} for server ${serverId}`);
    
    return res.status(200).json({
      data: parsedData.data,
      timestamp: parsedData.timestamp,
      age: Date.now() - parsedData.timestamp,
    });
    
  } catch (error) {
    console.error('Failed to retrieve signal:', error);
    return res.status(500).json({
      error: 'Retrieval error',
      message: 'Failed to retrieve signaling data',
    });
  }
}

// 統計情報の更新
async function updateStats(type: string, serverId: string) {
  try {
    const statsKey = 'signaling:stats';
    const today = new Date().toISOString().split('T')[0];
    
    // 日別統計
    await kv.hincrby(`${statsKey}:daily:${today}`, type, 1);
    await kv.hincrby(`${statsKey}:daily:${today}`, 'total', 1);
    
    // サーバー別統計
    await kv.hincrby(`${statsKey}:servers`, serverId, 1);
    
    // TTLを設定（7日間）
    await kv.expire(`${statsKey}:daily:${today}`, 7 * 24 * 60 * 60);
    
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}