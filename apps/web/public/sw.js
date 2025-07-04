// Vibe Coder Service Worker
// モバイル最適化PWA機能とオフライン対応

const CACHE_NAME = 'vibe-coder-v1';
const STATIC_CACHE = 'vibe-coder-static-v1';
const DYNAMIC_CACHE = 'vibe-coder-dynamic-v1';

// キャッシュするリソース
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  // アイコン
  '/pwa-64x64.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-icon-512x512.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
];

// キャッシュしないURLパターン
const EXCLUDE_PATTERNS = [
  /\/api\//,
  /\/auth\//,
  /chrome-extension/,
  /extension\//,
];

// インストール時の処理
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// アクティベート時の処理
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // 古いキャッシュを削除
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 即座にコントロールを取得
      self.clients.claim()
    ])
  );
});

// フェッチ時の処理
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 除外パターンをチェック
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return;
  }

  // POSTリクエストは処理しない
  if (request.method !== 'GET') {
    return;
  }

  // オンライン時の処理
  if (navigator.onLine) {
    event.respondWith(
      handleOnlineRequest(request)
    );
  } else {
    // オフライン時の処理
    event.respondWith(
      handleOfflineRequest(request)
    );
  }
});

// オンライン時のリクエスト処理
async function handleOnlineRequest(request) {
  const url = new URL(request.url);
  
  try {
    // 静的アセットの場合はキャッシュファーストで
    if (isStaticAsset(url)) {
      return await cacheFirst(request);
    }
    
    // HTMLページの場合はネットワークファーストで
    if (isHTMLPage(request)) {
      return await networkFirst(request);
    }
    
    // その他のリソースは通常通りフェッチ
    return await fetch(request);
    
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    return await handleOfflineRequest(request);
  }
}

// オフライン時のリクエスト処理
async function handleOfflineRequest(request) {
  const url = new URL(request.url);
  
  try {
    // キャッシュから検索
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // HTMLページの場合はオフラインページを返す
    if (isHTMLPage(request)) {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // フォールバック応答
    return new Response(
      JSON.stringify({ error: 'Offline - No cached version available' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[SW] Offline handling failed:', error);
    return new Response('Network error', { status: 503 });
  }
}

// キャッシュファースト戦略
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  
  // 成功したレスポンスをキャッシュ
  if (networkResponse.status === 200) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

// ネットワークファースト戦略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // 成功したレスポンスをキャッシュ
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // ネットワークエラー時はキャッシュから返す
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// 静的アセットかどうかを判定
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// HTMLページかどうかを判定
function isHTMLPage(request) {
  return request.destination === 'document' || 
         request.headers.get('accept')?.includes('text/html');
}

// プッシュ通知の処理
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Vibe Coderからの通知',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag || 'vibe-coder-notification',
      data: data.data || {},
      actions: data.actions || [],
      vibrate: [200, 100, 200],
      requireInteraction: false,
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Vibe Coder', options)
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

// 通知クリック時の処理
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 既存のウィンドウがある場合はフォーカス
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        
        // 新しいウィンドウを開く
        let url = '/';
        if (action === 'open-terminal') {
          url = '/terminal';
        } else if (action === 'open-connect') {
          url = '/connect';
        } else if (data?.url) {
          url = data.url;
        }
        
        return clients.openWindow(url);
      })
  );
});

// バックグラウンド同期
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// バックグラウンド同期の実行
async function doBackgroundSync() {
  try {
    // 未送信のデータがあれば送信を試行
    const pendingData = await getPendingData();
    if (pendingData.length > 0) {
      for (const data of pendingData) {
        await syncData(data);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// 未送信データの取得（IndexedDB等から）
async function getPendingData() {
  // 実装は将来的に追加
  return [];
}

// データの同期
async function syncData(data) {
  // 実装は将来的に追加
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      // 成功時の処理
      await removePendingData(data.id);
    }
  } catch (error) {
    console.error('[SW] Sync data failed:', error);
  }
}

// 未送信データの削除
async function removePendingData(id) {
  // 実装は将来的に追加
}

// メッセージ処理
self.addEventListener('message', event => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        version: CACHE_NAME,
        type: 'VERSION_RESPONSE'
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({
          success: true,
          type: 'CACHE_CLEARED'
        });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// 全キャッシュのクリア
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

console.log('[SW] Service worker script loaded');