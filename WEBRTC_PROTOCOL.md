# Vibe Coder WebRTC通信プロトコル仕様書

**バージョン**: 1.0.1  
**最終更新**: 2025-07-20  
**適用範囲**: PWA、シグナリングサーバー、ホストサーバー間の全通信

## 📋 概要

本ドキュメントは、Vibe CoderのWebRTC P2P通信プロトコルの完全な仕様を定義します。
すべての実装は本プロトコルに厳密に従い、アドホックな対応を禁止します。

**🚀 v0.8.1実装状況**: Claude CLI認証問題解決・WebSocket signaling動作検証完了・プロトコル準拠実装達成

## 🔐 通信方式の明確化

### 使用する通信方式
- **PWA ⇄ シグナリングサーバー**: WebSocket通信のみ
- **ホストサーバー ⇄ シグナリングサーバー**: WebSocket通信のみ  
- **PWA ⇄ ホストサーバー**: WebRTC P2P DataChannel通信のみ

### 禁止する通信方式
- **❌ REST API**: 一切使用しない
- **❌ HTTP リクエスト**: 一切使用しない
- **❌ シグナリングサーバー経由のデータ転送**: WebRTC確立後は使用しない

## 🎯 プロトコル全体フロー

### Phase 1: 認証・セッション確立
### Phase 2: WebRTC接続確立
### Phase 3: Claude Code実行
### Phase 4: 接続断・再接続処理

---

## Phase 1: 認証・セッション確立

### 1.1 ホストサーバー事前登録

**ホストサーバー起動時**
```json
ホストサーバー → シグナリングサーバー: {
  "type": "register-host",
  "hostId": "12345678",
  "sessionId": "HOST_SESSION_ABC123",
  "timestamp": 1234567890
}

シグナリングサーバー → ホストサーバー: {
  "type": "host-registered",
  "hostId": "12345678",
  "message": "Host registered successfully",
  "timestamp": 1234567890
}
```

### 1.2 PWA接続要求

**PWAからの接続開始**
```json
PWA → シグナリングサーバー: {
  "type": "connect-to-host",
  "hostId": "12345678",
  "clientId": "PWA_CLIENT_XYZ",
  "timestamp": 1234567890
}

シグナリングサーバー → PWA: {
  "type": "host-found",
  "hostId": "12345678",
  "sessionId": "SESSION_456789",
  "message": "Host found. Proceed with TOTP authentication",
  "timestamp": 1234567890
}
```

### 1.3 TOTP認証

**PWA側TOTP送信**
```json
PWA → シグナリングサーバー: {
  "type": "verify-totp",
  "sessionId": "SESSION_456789",
  "totpCode": "123456",
  "timestamp": 1234567890
}

シグナリングサーバー → ホストサーバー: {
  "type": "totp-verify",
  "sessionId": "SESSION_456789",
  "clientId": "PWA_CLIENT_XYZ",
  "totpCode": "123456",
  "timestamp": 1234567890
}
```

**ホストサーバー認証結果**
```json
ホストサーバー → シグナリングサーバー: {
  "type": "auth-success",
  "sessionId": "SESSION_456789",
  "clientId": "PWA_CLIENT_XYZ",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "webrtcReady": true,
  "tokenExpiry": 1234567890000,
  "timestamp": 1234567890
}

シグナリングサーバー → PWA: {
  "type": "host-authenticated",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "webrtcReady": true,
  "tokenExpiry": 1234567890000,
  "message": "Authentication successful. WebRTC connection authorized",
  "timestamp": 1234567890
}
```

---

## Phase 2: WebRTC接続確立

### 2.1 PWA側：SDP Offer生成・送信

**PWA内部処理**
```typescript
// RTCPeerConnection作成
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// DataChannel作成
const dc = pc.createDataChannel('claude-commands');

// Offer生成
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
```

**シグナリングメッセージ**
```json
PWA → シグナリングサーバー: {
  "type": "webrtc-offer",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "clientId": "PWA_CLIENT_XYZ",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n..."
  },
  "timestamp": 1234567890
}
```

### 2.2 シグナリングサーバー：認証検証・転送

**認証検証処理**
```typescript
// JWT検証
if (!verifyJWT(jwtToken, sessionId)) {
  sendError('Invalid or expired authentication token');
  return;
}

// 認証済みセッション確認
const session = getAuthenticatedSession(sessionId);
if (!session || !session.webrtcReady) {
  sendError('Session not authenticated for WebRTC');
  return;
}
```

**ホストサーバーに転送**
```json
シグナリングサーバー → ホストサーバー: {
  "type": "webrtc-offer-received",
  "sessionId": "SESSION_456789",
  "clientId": "PWA_CLIENT_XYZ",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n..."
  },
  "timestamp": 1234567890
}
```

### 2.3 ホストサーバー：Answer生成・送信

**ホストサーバー内部処理**
```typescript
// JWT再検証
if (!sessionManager.verifyJwtToken(jwtToken, sessionId)) {
  sendError('Authentication failed on host');
  return;
}

// RTCPeerConnection作成
const pc = new wrtc.RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Offer設定・Answer生成
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
```

**シグナリングメッセージ**
```json
ホストサーバー → シグナリングサーバー: {
  "type": "webrtc-answer",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 4611731400430051337 2 IN IP4 127.0.0.1\r\n..."
  },
  "timestamp": 1234567890
}

シグナリングサーバー → PWA: {
  "type": "webrtc-answer-received",
  "sessionId": "SESSION_456789",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 4611731400430051337 2 IN IP4 127.0.0.1\r\n..."
  },
  "timestamp": 1234567890
}
```

### 2.4 ICE候補の収集・交換（Trickle ICE）

**PWA側ICE候補送信**
```json
PWA → シグナリングサーバー: {
  "type": "ice-candidate",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "clientId": "PWA_CLIENT_XYZ",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  },
  "timestamp": 1234567890
}

シグナリングサーバー → ホストサーバー: {
  "type": "ice-candidate-received",
  "sessionId": "SESSION_456789",
  "clientId": "PWA_CLIENT_XYZ",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  },
  "timestamp": 1234567890
}
```

**ホストサーバー側ICE候補送信**
```json
ホストサーバー → シグナリングサーバー: {
  "type": "ice-candidate",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "candidate": {
    "candidate": "candidate:2 1 UDP 1694498815 203.0.113.12 54321 typ srflx raddr 192.168.1.200 rport 54321",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  },
  "timestamp": 1234567891
}

シグナリングサーバー → PWA: {
  "type": "ice-candidate-received",
  "sessionId": "SESSION_456789",
  "candidate": {
    "candidate": "candidate:2 1 UDP 1694498815 203.0.113.12 54321 typ srflx raddr 192.168.1.200 rport 54321",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  },
  "timestamp": 1234567891
}
```

### 2.5 接続確立・DataChannel開通

**PWA側DataChannel確立**
```json
PWA → シグナリングサーバー: {
  "type": "p2p-established",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "iceConnectionState": "connected",
  "timestamp": 1234567890
}
```

---

## Phase 3: Claude Code実行

### 3.1 コマンド実行

**PWA → ホストサーバー (DataChannel)**
```json
{
  "type": "claude-command",
  "sessionId": "SESSION_456789",
  "commandId": "CMD_789ABC",
  "command": "create a React component for user profile",
  "timestamp": 1234567890
}
```

### 3.2 リアルタイム出力

**ホストサーバー → PWA (DataChannel)**
```json
{
  "type": "claude-output",
  "sessionId": "SESSION_456789",
  "commandId": "CMD_789ABC",
  "data": "Creating React component...\r\n",
  "timestamp": 1234567890
}

{
  "type": "claude-output",
  "sessionId": "SESSION_456789",
  "commandId": "CMD_789ABC",
  "data": "import React from 'react';\r\n\r\nconst UserProfile = () => {\r\n",
  "timestamp": 1234567891
}
```

### 3.3 コマンド完了

**ホストサーバー → PWA (DataChannel)**
```json
{
  "type": "claude-completed",
  "sessionId": "SESSION_456789",
  "commandId": "CMD_789ABC",
  "exitCode": 0,
  "message": "Command completed successfully",
  "timestamp": 1234567900
}
```

---

## Phase 4: 接続断・再接続処理

### 4.1 接続断の検出

**ICE Connection State監視**
```typescript
pc.oniceconnectionstatechange = () => {
  switch (pc.iceConnectionState) {
    case 'disconnected':
      // 一時的な接続断
      handleTemporaryDisconnection();
      break;
    case 'failed':
      // 完全な接続失敗
      handleConnectionFailure();
      break;
    case 'closed':
      // 接続終了
      handleConnectionClosed();
      break;
  }
};
```

### 4.2 再接続戦略

#### Phase 4.2.1: 自動再接続（軽微な切断）
**対象**: `iceConnectionState: 'disconnected'`
- **待機時間**: 5秒
- **処理**: ICE候補の再収集・再送信
- **UI表示**: 「再接続中...」

#### Phase 4.2.2: WebRTC再確立（中程度の切断）
**対象**: `iceConnectionState: 'failed'`
- **待機時間**: 10秒
- **処理**: PeerConnection再作成、Offer/Answer再交換
- **UI表示**: 「接続を再確立中...」

#### Phase 4.2.3: 完全再認証（重度の切断）
**対象**: 30分以上の切断または認証失効
- **待機時間**: 30分以上
- **処理**: TOTP再認証から開始
- **UI表示**: 「認証が必要です」

### 4.3 再接続プロトコル

#### 4.3.1 自動再接続
```json
PWA → シグナリングサーバー: {
  "type": "reconnect-request",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "reconnectType": "ice-refresh",
  "timestamp": 1234567890
}
```

#### 4.3.2 WebRTC再確立
```json
PWA → シグナリングサーバー: {
  "type": "webrtc-restart",
  "sessionId": "SESSION_456789",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "reason": "ice-connection-failed",
  "timestamp": 1234567890
}
```

#### 4.3.3 完全再認証
```json
PWA → シグナリングサーバー: {
  "type": "reauth-required",
  "sessionId": "SESSION_456789",
  "reason": "token-expired",
  "disconnectDuration": 1800000,
  "timestamp": 1234567890
}
```

### 4.4 認証セッション管理

#### 4.4.1 JWTトークン延長
```json
ホストサーバー → シグナリングサーバー: {
  "type": "extend-session",
  "sessionId": "SESSION_456789",
  "currentJwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "extensionDuration": 1800000,
  "timestamp": 1234567890
}

シグナリングサーバー → PWA: {
  "type": "session-extended",
  "sessionId": "SESSION_456789",
  "newJwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newExpiry": 1234569690000,
  "timestamp": 1234567890
}
```

#### 4.4.2 再認証判定
```typescript
requiresReAuthentication(sessionId: string): boolean {
  const session = getSession(sessionId);
  const disconnectDuration = Date.now() - session.lastActivity;
  
  return disconnectDuration > 1800000 || // 30分以上
         session.reconnectAttempts > 3 ||
         session.tokenExpired ||
         session.securityFlags.suspicious;
}
```

### 4.5 Claude Session保護

#### 4.5.1 セッション一時停止
```json
ホストサーバー内部処理: {
  "action": "pause-claude-session",
  "sessionId": "SESSION_456789",
  "reason": "webrtc-disconnected",
  "gracePeriod": 1800000
}
```

#### 4.5.2 セッション復元
```json
ホストサーバー内部処理: {
  "action": "resume-claude-session",
  "sessionId": "SESSION_456789",
  "resumeFrom": "last-checkpoint",
  "flushPendingOutput": true
}
```

---

## 🔐 セキュリティ仕様

### 5.1 JWT認証の必須化

**すべてのWebRTC関連メッセージにJWTトークンが必要**
- `webrtc-offer`
- `webrtc-answer`
- `ice-candidate`
- `reconnect-request`
- `webrtc-restart`

### 5.2 二重認証検証

1. **シグナリングサーバー**: 受信時にJWT検証
2. **ホストサーバー**: 転送時にJWT再検証

### 5.3 セッション状態の厳密管理

```typescript
interface SessionState {
  sessionId: string;
  isAuthenticated: boolean;
  webrtcReady: boolean;
  jwtToken: string;
  tokenExpiry: number;
  lastActivity: number;
  reconnectAttempts: number;
  securityFlags: {
    suspicious: boolean;
    multipleConnections: boolean;
  };
}
```

---

## 🎯 実装時の厳守事項

### 6.1 必須遵守事項

1. **本プロトコル完全準拠**: アドホックな変更を禁止
2. **WebSocket通信のみ**: REST API使用禁止
3. **JWT認証必須**: すべてのWebRTC関連メッセージで検証
4. **30分ルール**: 30分以上の切断で完全再認証
5. **STUN設定統一**: 環境に関係なく `stun:stun.l.google.com:19302` を使用

### 6.2 実装の優先順位

#### 高優先度
1. ICE Connection State監視
2. DataChannel状態監視
3. 基本的な自動再接続
4. JWT認証の完全実装

#### 中優先度
1. WebRTC再確立
2. Claude Session保護
3. 認証セッション延長
4. 詳細な接続状態管理

#### 低優先度
1. 高度な再接続戦略
2. 詳細なUI状態表示
3. オフライン操作機能
4. 統計情報収集

### 6.3 エラーハンドリング

**認証失敗時の必須処理**
```json
{
  "type": "authentication-required",
  "sessionId": "SESSION_456789",
  "message": "Please re-authenticate to continue",
  "action": "restart-auth-flow",
  "timestamp": 1234567890
}
```

---

## 📊 メッセージ仕様一覧

### 7.1 認証関連メッセージ

| メッセージタイプ | 送信者 | 宛先 | 必須フィールド |
|---|---|---|---|
| `register-host` | ホストサーバー | シグナリング | `hostId`, `sessionId` |
| `connect-to-host` | PWA | シグナリング | `hostId`, `clientId` |
| `verify-totp` | PWA | シグナリング | `sessionId`, `totpCode` |
| `auth-success` | ホストサーバー | シグナリング | `sessionId`, `jwtToken`, `webrtcReady` |
| `host-authenticated` | シグナリング | PWA | `sessionId`, `jwtToken`, `webrtcReady` |

### 7.2 WebRTC関連メッセージ

| メッセージタイプ | 送信者 | 宛先 | 必須フィールド |
|---|---|---|---|
| `webrtc-offer` | PWA | シグナリング | `sessionId`, `jwtToken`, `offer` |
| `webrtc-answer` | ホストサーバー | シグナリング | `sessionId`, `jwtToken`, `answer` |
| `ice-candidate` | 両方 | シグナリング | `sessionId`, `jwtToken`, `candidate` |
| `p2p-established` | PWA | シグナリング | `sessionId`, `jwtToken`, `iceConnectionState` |

### 7.3 再接続関連メッセージ

| メッセージタイプ | 送信者 | 宛先 | 必須フィールド |
|---|---|---|---|
| `reconnect-request` | PWA | シグナリング | `sessionId`, `jwtToken`, `reconnectType` |
| `webrtc-restart` | PWA | シグナリング | `sessionId`, `jwtToken`, `reason` |
| `extend-session` | ホストサーバー | シグナリング | `sessionId`, `currentJwtToken`, `extensionDuration` |
| `reauth-required` | PWA | シグナリング | `sessionId`, `reason`, `disconnectDuration` |

---

## 🚀 バージョン管理

### 8.1 プロトコルバージョン

**現在のバージョン**: 1.0.0
- **メジャー**: 互換性のない変更
- **マイナー**: 後方互換性のある機能追加
- **パッチ**: 後方互換性のある修正

### 8.2 変更履歴

| バージョン | 日付 | 変更内容 |
|---|---|---|
| 1.0.0 | 2025-07-15 | 初版作成・WebRTC標準プロトコル準拠・30分再認証ルール |
| 1.0.1 | 2025-07-20 | v0.8.1対応・Claude CLI認証問題解決・実動作検証完了 |

---

## 📞 実装時の参照

**本ドキュメントの参照**: すべての実装時に本ドキュメントを必ず参照
**アドホック対応の禁止**: 本仕様に記載されていない処理は実装しない
**変更時の手順**: 本ドキュメントを先に更新してから実装

## 🎯 v0.8.1実装検証結果

### 検証完了項目

- ✅ **認証フロー**: `connect-to-host` → `host-found` → `verify-totp` → `auth-success` 完全動作
- ✅ **WebSocket signaling**: Docker環境での接続・メッセージ処理・セッション管理正常
- ✅ **JWT認証**: トークン生成・検証・セッション管理統合完了
- ✅ **Claude CLI統合**: HOME環境変数問題解決・PTYモード安定動作
- ✅ **プロトコル準拠**: 全メッセージタイプ・フィールド仕様完全準拠

### 次期検証予定

- 🔄 **WebRTC P2P接続**: Offer/Answer/ICE候補交換・DataChannel開通テスト
- 🔄 **Claude Code実行**: リアルタイム出力・コマンド完了通知テスト  
- 🔄 **再接続処理**: 自動再接続・WebRTC再確立・完全再認証テスト
- 🔄 **モバイル実機**: Android/iPhone実機でのWebRTC接続安定性検証

---

**END OF DOCUMENT**