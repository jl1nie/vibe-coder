# Vibe Coder - 統一WebRTCアーキテクチャテスト戦略

## 🎯 テスト戦略概要

Vibe Coderは統一WebRTCアーキテクチャ（Simple-peer削除・Native WebRTC API統合）により、PWA・Host・Signaling間の完全なP2P通信を実現しています。テスト戦略も統一アーキテクチャに対応した包括的なアプローチを採用しています。

## 🏗️ 統一WebRTCアーキテクチャテスト構成

### WebRTCライブラリ統一テスト対象

- **PWA側**: ブラウザネイティブWebRTC API（RTCPeerConnection直接使用）
- **Host側**: wrtcライブラリ + Native RTCPeerConnection統合
- **Signaling**: Pure WebSocketサーバー（Next.js削除・軽量化）
- **統一API**: RTCPeerConnection・RTCDataChannel・RTCIceCandidate

## 📊 テスト状況サマリー (2025年7月12日現在)

### ✅ 完全通過パッケージ
- **shared**: 40/40テスト通過 (100%) - 共通型・ユーティリティ
- **signaling**: 9/9テスト通過 (100%) - Pure WebSocketシグナリング
- **web (App.test.tsx)**: 18/18テスト通過 (100%) - React PWAコンポーネント
- **host (WebRTC重要部分)**: 5/5テスト通過 (100%) - wrtc + Native API統合

### ⚠️ 統合テスト進行中
- **host (全体)**: 一部テスト（Claude CLI権限・Express mock問題）
- **E2E**: Playwright統合テスト（実装完了・実行調整中）

## 🧪 テストピラミッド構成

### Unit Tests (70%) - 高速・多数

**WebRTC統合テスト（最重要）**
```bash
# WebRTC Native API統合テスト（完全通過: 5/5）
cd packages/host && npx vitest run src/__tests__/webrtc-claude-integration.test.ts

期待結果:
✓ should handle WebRTC claude-command messages [Native API統合]
✓ should handle Claude service errors gracefully [wrtcライブラリ統合]  
✓ should handle ping/pong messages [DataChannel通信]
✓ should handle malformed messages gracefully [メッセージフォーマット統一]
✓ should handle multiple concurrent commands [同時実行サポート]
```

**React PWAテスト**
```bash
# PWA WebRTC Native API テスト（完全通過: 18/18）
cd apps/web && npx vitest run src/__tests__/App.test.tsx

期待結果:
✓ PWA初期認証画面レンダリング
✓ ブラウザネイティブWebRTC API統合
✓ モバイルレスポンシブ対応
✓ 音声認識機能統合
```

**Pure WebSocketシグナリングテスト**
```bash
# シグナリングサーバーテスト（完全通過: 9/9）
cd packages/signaling && npx vitest run tests/websocket-signaling-server.test.ts

期待結果:
✓ WebSocketサーバー起動・接続管理
✓ セッション作成・管理（8桁キー認証）
✓ Offer/Answer交換・ICE候補管理
✓ 自動クリーンアップ・セッション期限管理
```

### Integration Tests (20%) - 中程度

```bash
# 統合テスト（進行中 - 部分的成功）
pnpm test:integration

現在の状況:
- shared・signaling・web: 完全通過
- host: WebRTC重要部分通過・一部Claude CLI権限問題
```

### E2E Tests (10%) - 少数・重要フロー

```bash
# Playwright E2Eテスト
cd apps/web && npx playwright test

テスト対象:
- 認証フロー: 8桁キー + TOTP 2FA
- WebRTC P2P接続確立
- Claude Codeコマンド実行
- 音声認識・プレイリスト機能
```

## 🔧 テスト実行方法

### 最重要WebRTCテスト（日常開発用）

```bash
# WebRTC統合テスト（5/5通過確認済み）
cd packages/host && export HOST_UID=$(id -u) && export HOST_GID=$(id -g) && npx vitest run src/__tests__/webrtc-claude-integration.test.ts

# 全パッケージユニットテスト
pnpm test

# 個別パッケージテスト
pnpm --filter @vibe-coder/shared test        # 40/40通過
pnpm --filter @vibe-coder/signaling test     # 9/9通過
pnpm --filter @vibe-coder/host test          # WebRTC部分 5/5通過
pnpm --filter @vibe-coder/web test           # App.test.tsx 18/18通過
```

### 統合テスト（コミット前）

```bash
# 統合テスト実行
pnpm test:integration

# カバレッジ付きテスト
pnpm test:coverage
```

### E2Eテスト（リリース前）

```bash
# Playwright E2Eテスト
cd apps/web
npm run build && npm run preview &
npx playwright test

# 特定テストファイル実行
npx playwright test src/__tests__/e2e/auth-e2e.spec.ts
npx playwright test src/__tests__/e2e/command-execution-e2e.spec.ts
```

## 🏆 テスト品質基準

### 必須通過基準
- **WebRTC統合テスト**: 5/5テスト通過（必須）
- **ユニットテスト**: 90%以上の通過率
- **E2Eテスト**: 主要ユーザーフロー100%通過

### カバレッジ目標
- **ユニットテスト**: 80%以上
- **統合テスト**: 70%以上
- **E2Eテスト**: 主要フロー100%

## 🔍 トラブルシューティング

### wrtcネイティブモジュール問題
```bash
# wrtcプリビルトバイナリ確認（最重要）
ls -la node_modules/.pnpm/wrtc@0.4.7/node_modules/wrtc/build/Release/wrtc.node
# 17.7MB linux-x64バイナリの存在確認

# wrtcモジュール動作テスト
cd packages/host && node -e "console.log('wrtc loaded:', require('wrtc'))"
```

### Docker権限エラー（解決済み）
```bash
# UID/GID設定確認（テスト実行時必須）
export HOST_UID=$(id -u) && export HOST_GID=$(id -g)

# Hostパッケージテスト実行
cd packages/host && export HOST_UID=$(id -u) && export HOST_GID=$(id -g) && npm test
```

### 統一WebRTCアーキテクチャテスト問題
```bash
# Simple-peer削除後のNative APIテスト
cd packages/host && npx vitest run src/__tests__/webrtc-claude-integration.test.ts

# PWA WebRTC Native APIテスト
cd apps/web && npx vitest run src/__tests__/App.test.tsx
```

## 🚀 統一WebRTCアーキテクチャデバッグ方法

```bash
# 統一WebRTCライブラリ動作確認
# PWA側: ブラウザネイティブWebRTC API
chrome://webrtc-internals/

# Host側: wrtcネイティブモジュール
cd packages/host && node -e "console.log('wrtc module loaded:', require('wrtc'))"

# シグナリング: Pure WebSocketサーバー
cd packages/signaling && npm test -- --verbose

# 統一テスト実行（最重要WebRTC部分）
cd packages/host && npx vitest run src/__tests__/webrtc-claude-integration.test.ts --reporter=verbose

# 詳細ログ出力（統一アーキテクチャ）
DEBUG=vibe-coder:* pnpm start
```

## 📈 継続的改善

### 定期実行テスト
- **毎コミット**: ユニットテスト実行
- **毎PR**: 統合テスト + E2Eテスト
- **毎リリース**: 全テスト + パフォーマンステスト

### 品質監視
- **テスト通過率**: 95%以上維持
- **テスト実行時間**: 5分以内
- **カバレッジ**: 80%以上維持

### WebRTC統一アーキテクチャ監視
- **wrtcモジュール**: Docker環境での安定動作
- **Native WebRTC API**: PWA・Host間の完全互換性
- **Pure WebSocket**: シグナリング軽量化・高速化

---

**Vibe Coder 統一WebRTCアーキテクチャ** - Simple-peer削除・Native API統合による完全P2P通信 🚀