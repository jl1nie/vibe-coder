# Security Policy

## セキュリティ脆弱性の報告

Vibe Coderプロジェクトのセキュリティ脆弱性を発見した場合は、以下の手順で報告してください。

### 報告手順

1. **公開せずに報告**: GitHubの[Security Advisories](https://github.com/vibecoder/vibe-coder/security/advisories)を使用して非公開で報告してください。
2. **詳細な情報提供**: 脆弱性の詳細、再現手順、影響範囲を含めてください。
3. **連絡先**: security@vibe-coder.com（緊急時のみ）

### 対応時間

- **Critical**: 24時間以内
- **High**: 72時間以内
- **Medium**: 1週間以内
- **Low**: 2週間以内

## セキュリティ要件

### 1. 認証・認可

- Claude APIキーの安全な管理
- WebRTC接続の暗号化（DTLS/SRTP）
- セッション管理の適切な実装

### 2. 入力検証

- コマンドインジェクション対策
- XSS対策
- CSRF対策
- レート制限

### 3. 通信セキュリティ

- HTTPS/WSS必須
- CSP（Content Security Policy）設定
- CORS設定の適切な管理

### 4. インフラセキュリティ

- Docker設定の最小権限原則
- 非rootユーザーでの実行
- セキュリティヘッダーの設定

## 危険なコマンドパターン

以下のパターンは自動的にブロックされます：

```regex
/rm\s+-rf?\s*[\/\*]/          # 危険な削除コマンド
/sudo\s+(?!claude-code)/      # 不正な管理者権限
/eval\s*\(/                   # 動的コード実行
/exec\s*\(/                   # システムコマンド実行
/system\s*\(/                 # システムコール
/curl.*\|\s*sh/               # 危険なダウンロード実行
/wget.*\|\s*sh/               # 危険なダウンロード実行
```

## セキュリティ設定

### CSP設定

```javascript
"default-src 'self'; 
 script-src 'self' 'unsafe-inline'; 
 style-src 'self' 'unsafe-inline'; 
 img-src 'self' data:; 
 connect-src 'self' ws: wss:; 
 font-src 'self';"
```

### レート制限

- API: 10req/s
- WebSocket: 5req/s
- ファイルアップロード: 10MB制限

### 暗号化

- WebRTC: DTLS 1.2以上
- WebSocket: TLS 1.3推奨
- 保存データ: AES-256-GCM

## 監査ログ

全てのセキュリティ関連イベントはログに記録されます：

- 認証試行
- 権限エラー
- コマンド実行
- ファイルアクセス
- ネットワーク接続

## 定期的なセキュリティ評価

- 依存関係の脆弱性スキャン（週次）
- セキュリティ監査（月次）
- 侵入テスト（四半期）
- セキュリティトレーニング（年次）

## 緊急時対応

セキュリティインシデント発生時：

1. **即座の対応**: 影響を最小限に抑制
2. **調査**: 根本原因の特定
3. **修復**: 脆弱性の修正
4. **報告**: 影響を受けたユーザーへの通知
5. **予防**: 再発防止策の実装

## 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [WebRTC Security Best Practices](https://webrtcsecurity.github.io/)