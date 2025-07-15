# Vibe Coder テスト計画書

**作成日**: 2025-07-15  
**対象**: PWA、シグナリングサーバー、ホストサーバー  
**目的**: WEBRTC_PROTOCOL.md仕様準拠の完全テスト計画

## 📋 テスト戦略概要

### 🎯 **テスト目標**
- プロトコル仕様（WEBRTC_PROTOCOL.md）への完全準拠
- WebRTC P2P接続の安定性確保
- JWT認証システムの確実性
- 実機での動作確認

### 📊 **テストピラミッド構成**
- **Unit Tests**: 70% - 高速・多数実行
- **Integration Tests**: 20% - 中程度の実行頻度
- **End-to-End Tests**: 10% - 重要フロー検証

---

## 🔧 Unit Tests（単体テスト）

### 📱 **PWA Unit Tests** (`apps/web/src/`)

#### `websocket-webrtc.ts` テスト
```typescript
describe('WebRTCManager', () => {
  describe('Authentication Flow', () => {
    it('should send connect-to-host message with correct format', () => {
      // プロトコル準拠のメッセージ形式確認
      const expectedMessage = {
        type: 'connect-to-host',
        hostId: '12345678',
        clientId: 'pwa-SESSION_456789',
        timestamp: expect.any(Number)
      };
      
      // テスト実行
      manager.authenticateHost('12345678');
      
      // 検証
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(expectedMessage));
    });
    
    it('should handle totp-required response correctly', () => {
      // TOTP必要レスポンスの正常処理
      const response = {
        type: 'totp-required',
        sessionId: 'SESSION_456789',
        message: 'Host ID verified. Please enter TOTP code.'
      };
      
      // テスト実行
      const result = manager.handleSignalingMessage(response);
      
      // 検証
      expect(result.sessionId).toBe('SESSION_456789');
      expect(result.message).toContain('TOTP code');
    });
  });
  
  describe('JWT Authentication', () => {
    it('should include JWT token in all WebRTC messages', () => {
      // JWT付きWebRTCメッセージ送信確認
      const offer = createMockOffer();
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      
      manager.setAuthToken(jwtToken);
      manager.sendOffer(offer);
      
      const expectedMessage = {
        type: 'webrtc-offer',
        sessionId: 'SESSION_456789',
        jwtToken,
        clientId: 'pwa-SESSION_456789',
        offer,
        timestamp: expect.any(Number)
      };
      
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(expectedMessage));
    });
  });
  
  describe('STUN Configuration', () => {
    it('should always use STUN servers regardless of environment', () => {
      // 環境に関係なくSTUN使用確認
      const config = {
        signalingUrl: 'localhost:5175',
        sessionId: 'SESSION_456789',
        hostId: '12345678'
      };
      
      const manager = new WebRTCManager(config);
      const peerConnection = manager.createPeerConnection();
      
      expect(peerConnection.getConfiguration().iceServers).toEqual([
        { urls: 'stun:stun.l.google.com:19302' }
      ]);
    });
  });
  
  describe('Error Handling', () => {
    it('should not fall back to REST API', () => {
      // REST APIフォールバック削除確認
      const consoleSpy = jest.spyOn(console, 'warn');
      
      manager.connect();
      
      // 30秒後のタイムアウト確認
      jest.advanceTimersByTime(30000);
      
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('falling back to REST API')
      );
    });
  });
});
```

#### `App.tsx` テスト
```typescript
describe('App Component', () => {
  describe('Authentication State', () => {
    it('should manage authentication state correctly', () => {
      // 認証状態管理テスト
      const { getByTestId } = render(<App />);
      
      // 初期状態確認
      expect(getByTestId('auth-status')).toHaveTextContent('not authenticated');
      
      // 認証完了状態
      fireEvent.click(getByTestId('connect-button'));
      
      expect(getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
  });
});
```

### 🔗 **シグナリングサーバー Unit Tests** (`packages/signaling-ws/src/`)

#### `signaling-handler.ts` テスト
```typescript
describe('SignalingHandler', () => {
  describe('JWT Verification', () => {
    it('should verify JWT token for all WebRTC messages', () => {
      // JWT検証テスト
      const validJwt = generateValidJWT();
      const message = {
        type: 'webrtc-offer',
        sessionId: 'SESSION_456789',
        jwtToken: validJwt,
        offer: createMockOffer()
      };
      
      const handler = new SignalingHandler(mockSessionManager, mockConfig);
      handler.handleMessage('client-123', JSON.stringify(message), mockWs);
      
      // JWT検証が呼ばれたことを確認
      expect(mockSessionManager.verifyJWT).toHaveBeenCalledWith(validJwt, 'SESSION_456789');
    });
    
    it('should reject WebRTC messages with invalid JWT', () => {
      // 無効JWT拒否テスト
      const invalidJwt = 'invalid.jwt.token';
      const message = {
        type: 'webrtc-offer',
        sessionId: 'SESSION_456789',
        jwtToken: invalidJwt,
        offer: createMockOffer()
      };
      
      const handler = new SignalingHandler(mockSessionManager, mockConfig);
      handler.handleMessage('client-123', JSON.stringify(message), mockWs);
      
      // エラーメッセージ送信確認
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'error',
        error: 'Invalid or expired authentication token',
        timestamp: expect.any(Number)
      }));
    });
  });
  
  describe('Host Authentication', () => {
    it('should handle connect-to-host message correctly', () => {
      // connect-to-hostメッセージ処理テスト
      const message = {
        type: 'connect-to-host',
        hostId: '12345678',
        clientId: 'pwa-client-xyz',
        timestamp: Date.now()
      };
      
      const handler = new SignalingHandler(mockSessionManager, mockConfig);
      handler.handleMessage('client-123', JSON.stringify(message), mockWs);
      
      // ホスト特定処理確認
      expect(mockSessionManager.findHostByHostId).toHaveBeenCalledWith('12345678');
    });
    
    it('should generate sessionId for authentication', () => {
      // セッションID生成テスト
      const message = {
        type: 'connect-to-host',
        hostId: '12345678',
        clientId: 'pwa-client-xyz',
        timestamp: Date.now()
      };
      
      const handler = new SignalingHandler(mockSessionManager, mockConfig);
      handler.handleMessage('client-123', JSON.stringify(message), mockWs);
      
      // セッションID生成確認
      expect(mockSessionManager.storeAuthSession).toHaveBeenCalledWith(
        expect.stringMatching(/^[A-Z0-9]{8}$/),
        'client-123',
        '12345678'
      );
    });
  });
  
  describe('TOTP Verification', () => {
    it('should forward TOTP to correct host', () => {
      // TOTP転送テスト
      const message = {
        type: 'verify-totp',
        sessionId: 'SESSION_456789',
        totpCode: '123456',
        timestamp: Date.now()
      };
      
      const handler = new SignalingHandler(mockSessionManager, mockConfig);
      handler.handleMessage('client-123', JSON.stringify(message), mockWs);
      
      // ホストへの転送確認
      expect(mockSessionManager.sendToClient).toHaveBeenCalledWith(
        'host-client-id',
        expect.objectContaining({
          type: 'verify-totp',
          sessionId: 'SESSION_456789',
          totpCode: '123456'
        })
      );
    });
  });
});
```

#### `session-manager.ts` テスト
```typescript
describe('SessionManager', () => {
  describe('Authentication Sessions', () => {
    it('should store and retrieve auth sessions', () => {
      const manager = new SessionManager(mockConfig);
      
      manager.storeAuthSession('SESSION_456789', 'client-123', '12345678');
      
      const authSession = manager.getAuthSession('SESSION_456789');
      expect(authSession).toEqual({
        sessionId: 'SESSION_456789',
        clientId: 'client-123',
        hostId: '12345678',
        createdAt: expect.any(Number)
      });
    });
    
    it('should clean up expired auth sessions', () => {
      const manager = new SessionManager(mockConfig);
      
      // 古いセッション作成
      manager.storeAuthSession('OLD_SESSION', 'client-123', '12345678');
      
      // 5分以上経過をシミュレート
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      // クリーンアップ実行
      manager.cleanup();
      
      // 削除確認
      expect(manager.getAuthSession('OLD_SESSION')).toBeUndefined();
    });
  });
});
```

### 🖥️ **ホストサーバー Unit Tests** (`packages/host/src/`)

#### `session-manager.ts` テスト
```typescript
describe('SessionManager', () => {
  describe('JWT Token Management', () => {
    it('should generate valid JWT tokens', () => {
      const manager = new SessionManager();
      const sessionId = 'SESSION_456789';
      
      // 認証済みセッション作成
      manager.createSession();
      manager.verifyTotp(sessionId, '123456');
      
      const token = manager.generateJwtToken(sessionId);
      
      // JWT形式確認
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
      
      // JWT内容確認
      const decoded = jwt.decode(token) as any;
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.hostId).toBe(manager.getHostId());
    });
    
    it('should verify JWT tokens correctly', () => {
      const manager = new SessionManager();
      const sessionId = 'SESSION_456789';
      
      // 認証済みセッション作成
      manager.createSession();
      manager.verifyTotp(sessionId, '123456');
      
      const token = manager.generateJwtToken(sessionId);
      
      // 検証実行
      const result = manager.verifyJwtToken(token);
      
      expect(result).toEqual({
        sessionId,
        hostId: manager.getHostId()
      });
    });
    
    it('should reject invalid JWT tokens', () => {
      const manager = new SessionManager();
      
      const result = manager.verifyJwtToken('invalid.jwt.token');
      
      expect(result).toBeNull();
    });
  });
});
```

#### `webrtc-service.ts` テスト
```typescript
describe('WebRTCService', () => {
  describe('Signaling Message Authentication', () => {
    it('should verify JWT for all WebRTC messages', () => {
      const service = new WebRTCService(mockSessionManager);
      const validJwt = 'valid.jwt.token';
      
      // JWT検証成功モック
      mockSessionManager.verifyJwtToken.mockReturnValue({
        sessionId: 'SESSION_456789',
        hostId: '12345678'
      });
      
      const message = {
        type: 'webrtc-offer-received',
        sessionId: 'SESSION_456789',
        jwtToken: validJwt,
        offer: createMockOffer()
      };
      
      service.handleWebSocketSignalingMessage(message);
      
      // JWT検証確認
      expect(mockSessionManager.verifyJwtToken).toHaveBeenCalledWith(validJwt);
    });
    
    it('should reject unauthenticated WebRTC messages', () => {
      const service = new WebRTCService(mockSessionManager);
      
      // JWT検証失敗モック
      mockSessionManager.verifyJwtToken.mockReturnValue(null);
      
      const message = {
        type: 'webrtc-offer-received',
        sessionId: 'SESSION_456789',
        jwtToken: 'invalid.jwt.token',
        offer: createMockOffer()
      };
      
      service.handleWebSocketSignalingMessage(message);
      
      // 処理拒否確認（offerが処理されない）
      expect(service.handleSignalingOffer).not.toHaveBeenCalled();
    });
  });
});
```

---

## 🔗 Integration Tests（統合テスト）

### 🚀 **認証フロー統合テスト**

#### 完全認証フロー
```typescript
describe('Authentication Flow Integration', () => {
  it('should complete full authentication flow', async () => {
    // 1. PWA → シグナリング: connect-to-host
    const pwaClient = new WebRTCManager({
      signalingUrl: 'localhost:5175',
      sessionId: 'SESSION_456789',
      hostId: '12345678'
    });
    
    const authPromise = pwaClient.authenticateHost('12345678');
    
    // 2. シグナリング → ホスト: auth-request
    await waitFor(() => {
      expect(mockHostWs.send).toHaveBeenCalledWith(
        expect.stringContaining('auth-request')
      );
    });
    
    // 3. ホスト → シグナリング: totp-required
    mockHostWs.emit('message', JSON.stringify({
      type: 'totp-required',
      sessionId: 'SESSION_456789',
      message: 'Host ID verified. Please enter TOTP code.'
    }));
    
    // 4. PWA → シグナリング: verify-totp
    const authResult = await authPromise;
    expect(authResult.sessionId).toBe('SESSION_456789');
    
    const totpPromise = pwaClient.verifyTotp('SESSION_456789', '123456');
    
    // 5. シグナリング → ホスト: verify-totp
    await waitFor(() => {
      expect(mockHostWs.send).toHaveBeenCalledWith(
        expect.stringContaining('verify-totp')
      );
    });
    
    // 6. ホスト → シグナリング: auth-success (JWT付き)
    mockHostWs.emit('message', JSON.stringify({
      type: 'auth-success',
      sessionId: 'SESSION_456789',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      webrtcReady: true
    }));
    
    // 7. シグナリング → PWA: host-authenticated
    const totpResult = await totpPromise;
    expect(totpResult.token).toBeDefined();
    expect(totpResult.message).toContain('Authentication successful');
  });
});
```

### 🔗 **WebRTC P2P接続統合テスト**

#### 完全接続フロー
```typescript
describe('WebRTC P2P Connection Integration', () => {
  it('should establish P2P connection with authentication', async () => {
    // 認証完了済みの状態から開始
    const pwaClient = new WebRTCManager({
      signalingUrl: 'localhost:5175',
      sessionId: 'SESSION_456789',
      hostId: '12345678'
    });
    
    const hostService = new WebRTCService(mockSessionManager);
    
    // JWT設定
    pwaClient.setAuthToken('valid.jwt.token');
    
    // 1. PWA → シグナリング: webrtc-offer (JWT付き)
    const connectPromise = pwaClient.connect();
    
    // 2. シグナリング → ホスト: webrtc-offer-received (JWT付き)
    await waitFor(() => {
      expect(mockHostWs.send).toHaveBeenCalledWith(
        expect.stringContaining('webrtc-offer-received')
      );
    });
    
    // 3. ホスト → シグナリング: webrtc-answer (JWT付き)
    mockHostWs.emit('message', JSON.stringify({
      type: 'webrtc-answer',
      sessionId: 'SESSION_456789',
      jwtToken: 'valid.jwt.token',
      answer: createMockAnswer()
    }));
    
    // 4. ICE候補交換 (JWT付き)
    const icePromise = new Promise(resolve => {
      pwaClient.onIceCandidate = (candidate) => {
        expect(candidate).toBeDefined();
        resolve(candidate);
      };
    });
    
    // 5. DataChannel確立
    const connectionResult = await connectPromise;
    expect(connectionResult).toBe(true);
    
    // 6. P2P通信テスト
    const message = { type: 'ping', timestamp: Date.now() };
    pwaClient.sendMessage(JSON.stringify(message));
    
    // 7. ホスト側でメッセージ受信確認
    await waitFor(() => {
      expect(mockHostService.handleDataChannelMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ping' })
      );
    });
  });
});
```

### 🔐 **セキュリティ統合テスト**

#### JWT認証セキュリティ
```typescript
describe('JWT Authentication Security', () => {
  it('should reject expired JWT tokens', async () => {
    const expiredJwt = generateExpiredJWT();
    
    const pwaClient = new WebRTCManager({
      signalingUrl: 'localhost:5175',
      sessionId: 'SESSION_456789',
      hostId: '12345678'
    });
    
    pwaClient.setAuthToken(expiredJwt);
    
    // WebRTCメッセージ送信
    const offer = createMockOffer();
    pwaClient.sendOffer(offer);
    
    // エラーレスポンス確認
    await waitFor(() => {
      expect(mockPwaWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Invalid or expired authentication token')
      );
    });
  });
  
  it('should reject WebRTC messages without JWT', async () => {
    const pwaClient = new WebRTCManager({
      signalingUrl: 'localhost:5175',
      sessionId: 'SESSION_456789',
      hostId: '12345678'
    });
    
    // JWT設定なしでWebRTCメッセージ送信
    const offer = createMockOffer();
    pwaClient.sendOffer(offer);
    
    // エラーレスポンス確認
    await waitFor(() => {
      expect(mockPwaWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Authentication required')
      );
    });
  });
});
```

---

## 🎯 End-to-End Tests（E2Eテスト）

### 🔄 **完全ユーザーフロー**

#### 実機接続テスト
```typescript
describe('Full User Flow E2E', () => {
  it('should complete mobile to host connection', async () => {
    // 1. ホストサーバー起動
    const hostProcess = spawn('npm', ['run', 'start:host']);
    await waitForHostReady();
    
    // 2. PWA起動
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.vibe-coder.space');
    
    // 3. Host ID入力
    await page.fill('[data-testid="host-id-input"]', '12345678');
    await page.click('[data-testid="connect-button"]');
    
    // 4. TOTP入力
    await page.waitForSelector('[data-testid="totp-input"]');
    await page.fill('[data-testid="totp-input"]', '123456');
    await page.click('[data-testid="verify-button"]');
    
    // 5. 接続確立確認
    await page.waitForSelector('[data-testid="connected-status"]');
    const status = await page.textContent('[data-testid="connected-status"]');
    expect(status).toContain('Connected');
    
    // 6. Claude Code実行
    await page.click('[data-testid="claude-command-button"]');
    await page.waitForSelector('[data-testid="claude-output"]');
    
    const output = await page.textContent('[data-testid="claude-output"]');
    expect(output).toContain('Claude Code');
    
    // 7. クリーンアップ
    await browser.close();
    hostProcess.kill();
  });
});
```

### 📱 **モバイルデバイステスト**

#### Android/iPhone実機テスト
```typescript
describe('Mobile Device E2E', () => {
  it('should work on Android device', async () => {
    const browser = await playwright.chromium.launch({
      channel: 'chrome',
      args: ['--use-fake-ui-for-media-stream']
    });
    
    const context = await browser.newContext({
      ...playwright.devices['Pixel 5'],
      permissions: ['microphone']
    });
    
    const page = await context.newPage();
    await page.goto('https://www.vibe-coder.space');
    
    // タッチ操作テスト
    await page.tap('[data-testid="host-id-input"]');
    await page.fill('[data-testid="host-id-input"]', '12345678');
    await page.tap('[data-testid="connect-button"]');
    
    // 音声認識テスト
    await page.tap('[data-testid="voice-button"]');
    await page.waitForSelector('[data-testid="voice-recording"]');
    
    // WebRTC接続テスト
    await page.waitForSelector('[data-testid="webrtc-connected"]');
    
    await context.close();
    await browser.close();
  });
});
```

### 🌐 **ネットワーク環境テスト**

#### NAT Traversal テスト
```typescript
describe('Network Environment E2E', () => {
  it('should work across NAT/Firewall', async () => {
    // 異なるネットワーク環境での接続テスト
    const config = {
      pwaNetwork: 'wifi',
      hostNetwork: 'ethernet',
      stunServer: 'stun:stun.l.google.com:19302'
    };
    
    const pwaClient = new WebRTCManager({
      signalingUrl: 'wss://signaling.vibe-coder.space',
      sessionId: 'SESSION_456789',
      hostId: '12345678'
    });
    
    // STUN経由での接続確立
    const connected = await pwaClient.connect();
    expect(connected).toBe(true);
    
    // ICE候補の確認
    const candidates = await pwaClient.getIceCandidates();
    expect(candidates).toContain('typ srflx'); // STUN candidate
  });
});
```

---

## 📊 テスト実行・監視

### 🔄 **継続的テスト**

#### GitHub Actions設定
```yaml
name: Test Matrix
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [web, signaling-ws, host]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:${{ matrix.package }}
  
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:integration
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:e2e
```

### 📈 **テストカバレッジ**

#### カバレッジ目標
- **PWA**: 90%以上
- **シグナリングサーバー**: 95%以上
- **ホストサーバー**: 90%以上

#### 重要な測定ポイント
- JWT認証ロジック: 100%
- WebRTC接続処理: 95%
- エラーハンドリング: 90%
- セッション管理: 95%

### 🚨 **テスト失敗時の対応**

#### 自動修正フロー
1. **テスト失敗検出**: CI/CDでの自動検出
2. **エラー分析**: ログ分析・原因特定
3. **自動修正**: 可能な場合は自動修正
4. **手動確認**: 修正内容の手動確認
5. **再テスト**: 修正後の再テスト実行

---

## 📋 テスト実行チェックリスト

### Unit Tests
- [ ] PWA WebRTCManager テスト
- [ ] PWA 認証フロー テスト
- [ ] シグナリングサーバー JWT検証 テスト
- [ ] シグナリングサーバー メッセージ処理 テスト
- [ ] ホストサーバー セッション管理 テスト
- [ ] ホストサーバー WebRTC統合 テスト

### Integration Tests
- [ ] 完全認証フロー統合テスト
- [ ] WebRTC P2P接続統合テスト
- [ ] セキュリティ統合テスト
- [ ] エラーハンドリング統合テスト
- [ ] 再接続ロジック統合テスト

### E2E Tests
- [ ] 完全ユーザーフロー テスト
- [ ] モバイルデバイス テスト
- [ ] ネットワーク環境 テスト
- [ ] 長時間接続 テスト
- [ ] パフォーマンス テスト

### テスト環境
- [ ] 開発環境テスト
- [ ] ステージング環境テスト
- [ ] プロダクション環境テスト
- [ ] Docker環境テスト
- [ ] CI/CD環境テスト

---

## 💡 テスト時の注意点

### 1. **JWT認証の厳密性**
- 有効期限の正確な検証
- 改ざん検出の確認
- セッション管理の整合性

### 2. **WebRTC接続の安定性**
- ICE候補の適切な処理
- STUN サーバーの正常動作
- NAT Traversal の確実性

### 3. **エラーハンドリングの完全性**
- 予期しないエラーの適切な処理
- ユーザーフレンドリーなエラーメッセージ
- 再接続の自動実行

### 4. **セキュリティの強化**
- 不正アクセスの検出・防止
- セッション乗っ取りの防止
- 認証情報の適切な保護

---

**📝 このテスト計画書は、WEBRTC_PROTOCOL.md仕様書に基づいて作成されています。テスト実行時は必ず仕様書を参照し、プロトコル準拠を確認してください。**

**🚀 すべてのテストが成功した場合のみ、プロダクション環境への配布を許可します。**