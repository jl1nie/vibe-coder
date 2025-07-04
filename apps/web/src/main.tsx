import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { PWAManager } from './services/pwa';
import './index.css';

// PWA管理の初期化
const pwaManager = new PWAManager();
pwaManager.initialize();

// React Strict Mode（開発時のみ）
const isDevelopment = import.meta.env.DEV;

const AppWrapper = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

if (isDevelopment) {
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  );
} else {
  root.render(<AppWrapper />);
}

// Development tools (開発時のみ)
if (isDevelopment) {
  // React Developer Tools
  if (typeof window !== 'undefined') {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
  }

  // パフォーマンス測定
  const measurePerformance = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    console.group('🚀 Performance Metrics');
    console.log('📊 Navigation Timing:', {
      'DNS Lookup': `${Math.round(navigation.domainLookupEnd - navigation.domainLookupStart)}ms`,
      'TCP Connect': `${Math.round(navigation.connectEnd - navigation.connectStart)}ms`,
      'Request': `${Math.round(navigation.responseStart - navigation.requestStart)}ms`,
      'Response': `${Math.round(navigation.responseEnd - navigation.responseStart)}ms`,
      'DOM Load': `${Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart)}ms`,
      'Page Load': `${Math.round(navigation.loadEventEnd - navigation.navigationStart)}ms`,
    });
    
    if (paint.length > 0) {
      console.log('🎨 Paint Timing:', {
        'First Paint': `${Math.round(paint[0].startTime)}ms`,
        'First Contentful Paint': paint[1] ? `${Math.round(paint[1].startTime)}ms` : 'N/A',
      });
    }
    console.groupEnd();
  };

  // ページロード完了後にパフォーマンス測定
  if (document.readyState === 'complete') {
    setTimeout(measurePerformance, 0);
  } else {
    window.addEventListener('load', () => {
      setTimeout(measurePerformance, 0);
    });
  }
}

// エラーハンドリング
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // エラートラッキングサービス（将来実装）
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // エラートラッキングサービス（将来実装）
});

// PWA インストールプロンプト
window.addEventListener('beforeinstallprompt', (event) => {
  // デフォルトのインストールプロンプトを防ぐ
  event.preventDefault();
  
  // PWAManagerにイベントを渡す
  pwaManager.handleInstallPrompt(event as any);
});

// PWA状態変更の監視
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Service Workerが更新された場合
    console.log('Service Worker updated');
  });
}