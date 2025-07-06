# 🎯 Vibe Coder

**スマホから Claude Code を直感的に操作できるモバイル最適化リモート開発環境**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

## 🌟 何ができるの？

Vibe Coder を使えば、スマートフォンから Claude Code を実行できます：

- 📱 **どこからでもアクセス**: 出先からスマホで自宅の開発環境にアクセス
- 🗣️ **音声でコマンド**: 「この画面をモバイル対応にして」と音声で指示
- 🔒 **安全な接続**: 8桁キー + Google Authenticator による2段階認証
- ⚡ **ワンタップ実行**: よく使うコマンドをアイコンで瞬時実行
- 🎨 **美しいUI**: Glass Morphism デザインの直感的なインターフェース

## 🎥 実際の使用例

```
👤 ユーザー: 音声で「この画面をモバイル対応にして」
🤖 Claude Code: モバイルレスポンシブ対応のCSSを自動生成
📱 リアルタイム: スマホ画面でコード変更をリアルタイム確認
✨ 完了: そのまま本番デプロイも可能
```

## 🚀 簡単3ステップで開始

### ステップ1: Claude Code の準備

```bash
# Claude Code をインストール
npm install -g @anthropic-ai/claude-code

# ログイン
claude auth login
```

### ステップ2: Vibe Coder の起動

```bash
# リポジトリを取得
git clone https://github.com/your-username/vibe-coder.git
cd vibe-coder

# ワンコマンドで起動
docker compose up -d

# または手動で起動
pnpm install
pnpm start
```

### ステップ3: スマホから接続

1. **ブラウザで PWA にアクセス**: https://vibe-coder.space
2. **8桁キーを入力**: ターミナルに表示された数字（例: 12345678）
3. **2FA認証**: Google Authenticator で6桁コードを入力
4. **完了**: スマホからClaude Codeが使えます！

## 📱 スマホでの使い方

### 🎤 音声コマンド

マイクボタンをタップして話しかけるだけ：

- 「このバグを修正して」
- 「モバイル対応にして」  
- 「テストを書いて」
- 「パフォーマンスを改善して」

### 👆 ワンタップコマンド

プリセットされたコマンドをタップで瞬時実行：

- 🔐 **ログイン機能追加**
- 🐛 **バグ修正**
- 📱 **モバイル対応**
- 🧪 **テスト作成**
- 🎨 **UI改善**

### 📂 カスタムプレイリスト

あなた専用のコマンド集をJSONファイルでアップロード：

```json
{
  "name": "私の開発セット",
  "commands": [
    {"icon": "🚀", "label": "デプロイ", "command": "プロダクションにデプロイして"},
    {"icon": "📊", "label": "分析", "command": "パフォーマンス分析してボトルネックを特定して"}
  ]
}
```

## 🔐 セキュリティ

### 多層認証システム

1. **8桁キー認証**: ホスト起動時に自動生成される一意のキー
2. **TOTP 2FA**: Google Authenticator、Authy等での時間ベース認証
3. **JWT トークン**: 認証成功後の安全なセッション管理

### プライベート接続

- 🌐 **WebRTC P2P**: 完全なピアツーピア通信
- 🔒 **エンドツーエンド**: あなたのコードが外部サーバーを経由しない
- 🏠 **自宅環境**: あなたの開発環境に直接接続

## 💡 よくある使用シーン

### 🚌 通勤中の開発

- 電車で音声コマンドで新機能を実装
- バス停でスマホからバグ修正
- 歩きながらコードレビューとリファクタリング

### 🏠 家事の合間

- 料理しながら音声でテスト作成
- 掃除中にCI/CDパイプライン修正
- 洗濯物を干しながらドキュメント更新

### 🎯 クライアント先

- 打ち合わせ中にリアルタイムでUI修正
- プレゼン後すぐにフィードバック反映
- 移動中に次のタスクを準備

## ⚙️ 設定

基本的に設定は不要です。すべて自動で最適な設定が適用されます：

- ✅ **セッション暗号化**: 自動生成・保存
- ✅ **ポート設定**: 8080（自動）
- ✅ **セキュリティ**: 有効（デフォルト）
- ✅ **Claude 設定**: ~/.claude を自動マウント

## 🐳 Docker での実行

```bash
# 単発実行
docker run -d \
  -p 8080:8080 \
  -v ~/.claude:/app/.claude \
  -v $(pwd):/workspace \
  jl1nie/vibe-coder:latest

# docker-compose での実行
docker compose up -d
```

## 🔧 トラブルシューティング

### よくある問題と解決法

**❓ 8桁キーが表示されない**
```bash
# ログを確認
docker logs vibe-coder-host
```

**❓ 2FA認証が通らない**
- Authenticator アプリの時刻同期を確認
- 6桁コードの入力タイミングを確認

**❓ Claude Code が実行されない**
```bash
# Claude ログイン状態を確認
claude auth status
```

**❓ 接続できない**
- ファイアウォール設定確認（ポート8080）
- Docker コンテナの起動状態確認

## 📞 サポート

- 🐛 **バグ報告**: [GitHub Issues](https://github.com/your-username/vibe-coder/issues)
- 💬 **質問・相談**: [Discussions](https://github.com/your-username/vibe-coder/discussions)
- 📖 **詳細ドキュメント**: [CLAUDE.md](./CLAUDE.md)

## 📄 ライセンス

Apache License 2.0 - 詳細は [LICENSE](./LICENSE) をご覧ください。

---

**🌟 Vibe Coder で、モバイル開発の新時代を体験してください！**