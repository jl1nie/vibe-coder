import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './hooks/useApp';
import { HomePage } from './pages/HomePage';
import { ConnectPage } from './pages/ConnectPage';
import { TerminalPage } from './pages/TerminalPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlaylistsPage } from './pages/PlaylistsPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="app-container min-h-screen bg-gray-50 dark:bg-gray-900">
          <Routes>
            {/* メインページ */}
            <Route path="/" element={<HomePage />} />
            
            {/* 接続ページ */}
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/connect/:serverId" element={<ConnectPage />} />
            
            {/* ターミナルページ */}
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/terminal/:sessionId" element={<TerminalPage />} />
            
            {/* プレイリストページ */}
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:playlistId" element={<PlaylistsPage />} />
            
            {/* 設定ページ */}
            <Route path="/settings" element={<SettingsPage />} />
            
            {/* アバウトページ */}
            <Route path="/about" element={<AboutPage />} />
            
            {/* 404ページ */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}