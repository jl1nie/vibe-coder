#!/bin/bash

# End-to-End Authentication Test Script
set -e

echo "🧪 Vibe Coder E2E認証テスト開始"
echo "======================================"

HOST_URL="http://localhost:8080"
PWA_URL="http://localhost:5173"

# 1. ホストサーバーの健康状態確認
echo "📡 1. ホストサーバー状態確認..."
HEALTH=$(curl -s "$HOST_URL/api/health" | jq -r '.status')
echo "   Status: $HEALTH"

# 2. ホストIDの取得
echo "📋 2. Host ID取得..."
HOST_INFO=$(curl -s "$HOST_URL/")
HOST_ID=$(echo "$HOST_INFO" | jq -r '.hostId')
echo "   Host ID: $HOST_ID"

# 3. セッション作成テスト
echo "🔐 3. セッション作成テスト..."
SESSION_RESPONSE=$(curl -s -X POST "$HOST_URL/api/auth/sessions")
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
TOTP_SECRET=$(echo "$SESSION_RESPONSE" | jq -r '.totpSecret')
echo "   Session ID: $SESSION_ID"
echo "   TOTP Secret: ${TOTP_SECRET:0:20}..."

# 4. セッション状態確認
echo "📊 4. セッション状態確認..."
SESSION_STATUS=$(curl -s "$HOST_URL/api/auth/sessions/$SESSION_ID/status")
echo "   Status: $(echo "$SESSION_STATUS" | jq -r '.status')"

# 5. TOTPコード生成（モック）
echo "🔑 5. TOTP認証テスト..."
# 実際のTOTPコードの代わりに、テスト用の無効なコードを使用
MOCK_TOTP="123456"
VERIFY_RESPONSE=$(curl -s -X POST "$HOST_URL/api/auth/sessions/$SESSION_ID/verify" \
  -H "Content-Type: application/json" \
  -d "{\"totpCode\": \"$MOCK_TOTP\"}")
VERIFY_SUCCESS=$(echo "$VERIFY_RESPONSE" | jq -r '.success')
echo "   TOTP認証結果: $VERIFY_SUCCESS (expected: false for mock code)"

# 6. PWAアクセス確認
echo "🌐 6. PWA接続確認..."
PWA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PWA_URL")
echo "   PWA Status Code: $PWA_STATUS"

# 7. WebRTC シグナリングテスト
echo "📡 7. WebRTC シグナリングテスト..."
SIGNAL_TEST=$(curl -s -X POST "$HOST_URL/api/signal" \
  -H "Content-Type: application/json" \
  -d '{"type": "create-session", "sessionId": "test-123", "hostId": "vibe-coder-host"}')
SIGNAL_SUCCESS=$(echo "$SIGNAL_TEST" | jq -r '.success')
echo "   シグナリング結果: $SIGNAL_SUCCESS"

# 8. APIエラーハンドリングテスト
echo "❌ 8. エラーハンドリングテスト..."
INVALID_SESSION=$(curl -s "$HOST_URL/api/auth/sessions/INVALID/status")
ERROR_MESSAGE=$(echo "$INVALID_SESSION" | jq -r '.error // "No error field"')
echo "   無効セッションエラー: $ERROR_MESSAGE"

echo ""
echo "✅ E2E認証テスト完了"
echo "======================================"
echo "📊 テスト結果サマリー:"
echo "   - ホストサーバー: $HEALTH"
echo "   - Host ID: $HOST_ID"
echo "   - セッション作成: $([ "$SESSION_ID" != "null" ] && echo "✅ 成功" || echo "❌ 失敗")"
echo "   - TOTP検証: $([ "$VERIFY_SUCCESS" = "false" ] && echo "✅ 正常（無効コード拒否）" || echo "❌ 異常")"
echo "   - PWA接続: $([ "$PWA_STATUS" = "200" ] && echo "✅ 成功" || echo "❌ 失敗")"
echo "   - WebRTCシグナリング: $([ "$SIGNAL_SUCCESS" = "true" ] && echo "✅ 成功" || echo "❌ 失敗")"
echo ""

# 9. 統合テスト実行状況表示
echo "🔄 9. 実行中プロセス確認..."
echo "   PWA Dev Server: $(pgrep -f 'vite.*5173' > /dev/null && echo "✅ Running" || echo "❌ Not running")"
echo "   Host Server: $(pgrep -f 'node.*8080' > /dev/null && echo "✅ Running" || echo "❌ Not running")"

echo ""
echo "🎯 次のステップ:"
echo "   1. ブラウザで http://localhost:5173 にアクセス"
echo "   2. Host ID「$HOST_ID」を入力"
echo "   3. TOTPアプリで秘密鍵を登録してコードを入力"
echo "   4. 認証完了後にターミナル画面が表示されることを確認"