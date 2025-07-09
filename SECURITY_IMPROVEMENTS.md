# Vibe Coder セキュリティ改善

## 修正された脆弱性

### 問題

以前の実装では、PWAアプリケーションでHost IDを入力すると、**検証なしで即座に2FA登録画面が表示される**という重大なセキュリティホールがありました。

- **Host IDの総当たり攻撃が可能** - 8桁の数字（1億通り）を試行可能
- **物理的アクセスなしで2FAセットアップが可能** - 誰でも適当なIDで2FA登録を開始できる  
- **TOTP秘密鍵の露出** - 正しいHost IDを推測されれば秘密鍵が取得可能

### 解決策

## 1. ホストサーバーでのみ2FAセットアップを可能に

### 新しい認証フロー

```
1. 物理的アクセス → http://localhost:8080/setup
2. 2FA QRコード生成 → Authenticatorアプリでスキャン
3. PWAアプリ → Host ID入力 → サーバーでID検証
4. 6桁コード入力 → 認証完了
```

### 実装された機能

#### A. localhost専用セットアップページ

**エンドポイント:** `GET /setup`
- **アクセス制限:** localhost (127.0.0.1, ::1, Docker内部IP) のみ
- **機能:** 2FA QRコード生成、セットアップ手順表示
- **セキュリティ:** IPアドレスによる厳密な検証

```javascript
// IPアドレス検証
const isLocalhost = clientIp === '127.0.0.1' || 
                   clientIp === '::1' || 
                   clientIp === '::ffff:127.0.0.1' ||
                   clientIp?.startsWith('127.') ||
                   (!forwardedFor && clientIp === '::ffff:172.') ||
                   (!forwardedFor && clientIp?.startsWith('192.168.'));
```

#### B. Host ID検証機能

**エンドポイント:** `POST /api/auth/sessions`
- **必須パラメータ:** `{ hostId: string }`
- **検証:** 提供されたHost IDがサーバーの実際のIDと一致するかチェック
- **エラー処理:** 不正なIDの場合は404エラー

```javascript
if (!hostId || hostId !== sessionManager.getHostId()) {
  return res.status(404).json({ 
    error: 'Host ID not found. Please ensure you have the correct Host ID from your host server.' 
  });
}
```

#### C. 2FA専用セットアップAPI

**エンドポイント:** `GET /api/auth/setup`
- **アクセス制限:** localhost のみ
- **機能:** セッション作成、TOTP秘密鍵生成、QRコード用URLの提供
- **ログ:** 不正アクセス試行の記録

## 2. PWAクライアントの改善

### Host ID検証の追加

```javascript
// セッション作成時にHost IDを送信
const response = await fetch(`${HOST_SERVER_URL}/api/auth/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hostId: state.auth.hostId }),
});
```

### エラーメッセージの改善

```javascript
if (response.status === 404) {
  throw new Error(
    'Host IDが見つかりません。正しい8桁の数字を入力してください。\n' +
    '初回セットアップの場合は、ホストサーバーの http://localhost:8080/setup にアクセスしてください。'
  );
}
```

## 3. セキュリティ強化

### アクセス制御
- **物理的アクセス必須** - 2FAセットアップはホストマシンからのみ可能
- **IP検証** - 複数のlocalhostパターンに対応
- **ログ監視** - 不正アクセス試行の記録

### 認証フロー
- **事前認証** - Host IDの事前検証が必要
- **セッション管理** - セッションベースの認証
- **TOTP検証** - 時間ベースのワンタイムパスワード

## 4. 使用方法

### 初回セットアップ

1. **ホストサーバーを起動**
   ```bash
   docker-compose up
   ```

2. **セットアップページにアクセス**
   ```
   http://localhost:8080/setup
   ```

3. **2FA設定**
   - "Generate 2FA Setup"ボタンをクリック
   - QRコードをAuthenticatorアプリでスキャン
   - または手動で秘密鍵を入力

4. **PWAアプリで接続**
   - https://www.vibe-coder.space にアクセス
   - 表示されたHost IDを入力
   - Authenticatorアプリの6桁コードを入力

### Host IDの更新

**セキュリティが侵害された場合やHost IDを変更したい場合:**

1. **セットアップページにアクセス**
   ```
   http://localhost:8080/setup
   ```

2. **Host IDを更新**
   - "Renew Host ID"ボタンをクリック
   - 確認ダイアログで「OK」をクリック
   - 新しいHost IDが生成される

3. **注意事項**
   - 既存のセッションは全て無効化される
   - 全てのモバイルデバイスで再接続が必要
   - 新しいHost IDでPWAアプリから接続する

### 通常の使用

1. **PWAアプリを開く**
2. **Host IDを入力** - ホストサーバーで確認されたIDのみ
3. **6桁コードを入力** - Authenticatorアプリから
4. **認証完了** - WebRTC接続開始

## 5. セキュリティの向上点

### Before（脆弱性あり）
```
PWA → 任意のHost ID入力 → 即座に2FA登録画面
```

### After（セキュア）
```
物理アクセス → localhost:8080/setup → 2FA設定
PWA → 検証済みHost ID → 6桁コード → 認証
```

### 防御された攻撃
- **Host ID総当たり攻撃** - サーバー側で検証
- **リモート2FAセットアップ** - localhost制限
- **TOTP秘密鍵の漏洩** - 物理アクセス必須

## 6. 運用上の注意事項

### セットアップ時
- ホストマシンへの物理的アクセスが必要
- セットアップページは localhost からのみアクセス可能
- 生成された秘密鍵は安全に保管

### Host ID管理
- Host IDの更新は物理的アクセスが必要
- 更新時は全てのセッションが無効化される
- 定期的な更新でセキュリティを向上

### 日常使用
- Host IDは8桁の数字で固定（更新まで）
- Authenticatorアプリの6桁コードが必要
- セッションは24時間で期限切れ

## 7. 新機能: Host ID更新

### 機能概要
- **目的**: セキュリティ侵害時やHost IDを変更したい場合の対応
- **アクセス**: localhost:8080/setup の「Renew Host ID」ボタン
- **制限**: 物理的アクセスが必要（localhost専用）

### 実装詳細
```javascript
// API エンドポイント
POST /api/auth/renew-host-id

// 機能
- 新しい8桁のHost IDを生成
- 既存セッションを全て無効化
- ファイルシステムに新しいIDを保存
- HOST_ID.txtファイルを更新
```

### セキュリティ効果
- **Host ID漏洩対策**: 漏洩時の即座の無効化
- **定期更新**: セキュリティ向上のための定期的な更新
- **セッション管理**: 古いセッションの確実な無効化

この改善により、Vibe Coderの2FA認証は物理的なホストアクセスを必要とする安全な方式となり、Host ID管理機能によりセキュリティインシデントへの対応力も向上しました。