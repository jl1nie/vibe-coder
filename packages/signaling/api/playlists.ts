import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { z } from 'zod';

// プレイリストスキーマの定義
const playlistSchema = z.object({
  schema: z.literal('vibe-coder-playlist-v1'),
  metadata: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    author: z.string().min(1).max(50),
    version: z.string().default('1.0.0'),
    tags: z.array(z.string()).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
  commands: z.array(z.object({
    icon: z.string().min(1).max(10),
    label: z.string().min(1).max(50),
    command: z.string().min(1).max(1000),
    description: z.string().max(200).optional(),
    category: z.string().max(50).optional(),
  })).min(1).max(20),
  stats: z.object({
    downloads: z.number().default(0),
    likes: z.number().default(0),
    views: z.number().default(0),
  }).optional(),
});

type Playlist = z.infer<typeof playlistSchema>;

// GitHub API からプレイリストを検索
async function searchGitHubPlaylists(): Promise<any[]> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    console.warn('GitHub token not configured, skipping GitHub search');
    return [];
  }

  try {
    const searchQuery = 'filename:vibe-coder-playlist.json';
    const response = await fetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=50`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'vibe-coder-signaling',
        },
      }
    );

    if (!response.ok) {
      console.error('GitHub API error:', response.status, response.statusText);
      return [];
    }

    const searchResults = await response.json() as any;
    const playlists: any[] = [];

    // 各ファイルの内容を取得
    for (const item of searchResults.items.slice(0, 20)) { // 最大20件
      try {
        const fileResponse = await fetch(item.url, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!fileResponse.ok) continue;

        const fileData = await fileResponse.json() as any;
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const playlistData = JSON.parse(content);

        // スキーマ検証
        const validationResult = playlistSchema.safeParse(playlistData);
        if (!validationResult.success) {
          console.warn(`Invalid playlist schema in ${item.html_url}:`, validationResult.error);
          continue;
        }

        const playlist = validationResult.data;
        
        playlists.push({
          ...playlist,
          source: {
            type: 'github',
            url: item.html_url,
            repository: item.repository?.full_name,
            author: item.repository?.owner?.login,
            updatedAt: item.repository?.updated_at,
          },
        });

      } catch (error) {
        console.warn(`Failed to process playlist from ${item.html_url}:`, error);
      }
    }

    return playlists;

  } catch (error) {
    console.error('GitHub search failed:', error);
    return [];
  }
}

// キャッシュされたプレイリストの取得
async function getCachedPlaylists(): Promise<any[]> {
  try {
    const cached = await kv.get('playlists:cached');
    return cached ? (Array.isArray(cached) ? cached : []) : [];
  } catch (error) {
    console.error('Failed to get cached playlists:', error);
    return [];
  }
}

// プレイリストをキャッシュに保存
async function setCachedPlaylists(playlists: any[]): Promise<void> {
  try {
    // 1時間キャッシュ
    await kv.setex('playlists:cached', 3600, JSON.stringify(playlists));
    await kv.set('playlists:last_updated', Date.now());
  } catch (error) {
    console.error('Failed to cache playlists:', error);
  }
}

// プレイリストの統計更新
async function updatePlaylistStats(playlistId: string, action: 'view' | 'download' | 'like'): Promise<void> {
  try {
    const key = `playlist:stats:${playlistId}`;
    await kv.hincrby(key, action + 's', 1);
    await kv.expire(key, 30 * 24 * 60 * 60); // 30日間保持
  } catch (error) {
    console.error('Failed to update playlist stats:', error);
  }
}

// メインハンドラー
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    } else if (req.method === 'POST') {
      return await handlePost(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Playlists API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process playlist request',
    });
  }
}

// GET リクエストの処理
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { refresh, search, category, author } = req.query;

  try {
    let playlists: any[] = [];
    let fromCache = false;

    // キャッシュの確認
    if (refresh !== 'true') {
      const cached = await getCachedPlaylists();
      if (cached.length > 0) {
        playlists = cached;
        fromCache = true;
      }
    }

    // キャッシュがない場合またはリフレッシュが要求された場合
    if (playlists.length === 0) {
      const githubPlaylists = await searchGitHubPlaylists();
      
      // プレイリストにIDを追加
      playlists = githubPlaylists.map((playlist, index) => ({
        ...playlist,
        id: `playlist_${Date.now()}_${index}`,
      }));

      // キャッシュに保存
      if (playlists.length > 0) {
        await setCachedPlaylists(playlists);
      }
    }

    // フィルタリング
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      playlists = playlists.filter(p => 
        p.metadata.name.toLowerCase().includes(searchLower) ||
        p.metadata.description?.toLowerCase().includes(searchLower) ||
        p.metadata.author.toLowerCase().includes(searchLower)
      );
    }

    if (category && typeof category === 'string') {
      playlists = playlists.filter(p => 
        p.metadata.tags?.includes(category)
      );
    }

    if (author && typeof author === 'string') {
      playlists = playlists.filter(p => 
        p.metadata.author.toLowerCase() === author.toLowerCase()
      );
    }

    // 人気順でソート
    playlists.sort((a, b) => {
      const aPopularity = (a.stats?.downloads || 0) + (a.stats?.likes || 0);
      const bPopularity = (b.stats?.downloads || 0) + (b.stats?.likes || 0);
      return bPopularity - aPopularity;
    });

    // 結果を制限
    const limit = parseInt((req.query.limit as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');
    const paginatedPlaylists = playlists.slice(offset, offset + limit);

    // 統計情報の更新（閲覧数）
    for (const playlist of paginatedPlaylists) {
      if (playlist.id) {
        await updatePlaylistStats(playlist.id, 'view');
      }
    }

    return res.status(200).json({
      playlists: paginatedPlaylists,
      total: playlists.length,
      offset,
      limit,
      fromCache,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to get playlists:', error);
    return res.status(500).json({
      error: 'Failed to retrieve playlists',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST リクエストの処理（統計更新など）
async function handlePost(req: VercelRequest, res: VercelResponse) {
  const { action, playlistId } = req.body;

  if (!action || !playlistId) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'action and playlistId are required',
    });
  }

  if (!['view', 'download', 'like'].includes(action)) {
    return res.status(400).json({
      error: 'Invalid action',
      message: 'action must be one of: view, download, like',
    });
  }

  try {
    await updatePlaylistStats(playlistId, action);

    return res.status(200).json({
      success: true,
      message: `${action} recorded successfully`,
      playlistId,
    });

  } catch (error) {
    console.error('Failed to update playlist stats:', error);
    return res.status(500).json({
      error: 'Failed to update stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}