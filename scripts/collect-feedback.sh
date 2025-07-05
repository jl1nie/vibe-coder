#!/bin/bash

# 📝 Vibe Coder User Feedback Collector
# ユーザーテストのフィードバック収集

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FEEDBACK_DIR="$PROJECT_ROOT/user-feedback"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FEEDBACK_FILE="$FEEDBACK_DIR/feedback_$TIMESTAMP.md"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_title() {
    echo -e "${PURPLE}📝 $1${NC}"
}

# Create feedback directory
create_feedback_dir() {
    if [[ ! -d "$FEEDBACK_DIR" ]]; then
        mkdir -p "$FEEDBACK_DIR"
        log_success "Created feedback directory: $FEEDBACK_DIR"
    fi
}

# Collect user information
collect_user_info() {
    echo
    log_title "ユーザー情報の収集"
    echo
    
    read -p "👤 お名前 (ニックネーム可): " user_name
    read -p "📱 使用デバイス (例: iPhone 14, Android, PC): " device
    read -p "🌐 ブラウザ (例: Chrome, Safari, Firefox): " browser
    read -p "💼 職業・役割 (例: 開発者, デザイナー, PM): " role
    read -p "⭐ プログラミング経験 (1-5, 1=初心者, 5=エキスパート): " experience
    
    echo
}

# Collect functionality feedback
collect_functionality_feedback() {
    log_title "機能別フィードバック"
    echo
    
    # Connection experience
    echo "🔌 接続体験について"
    read -p "接続は簡単でしたか？ (1-5, 5=とても簡単): " connection_ease
    read -p "接続時間は満足できましたか？ (1-5, 5=とても満足): " connection_speed
    read -p "接続で困ったことがあれば詳しく: " connection_issues
    echo
    
    # Voice commands
    echo "🎤 音声コマンドについて"
    read -p "音声認識の精度はどうでしたか？ (1-5, 5=完璧): " voice_accuracy
    read -p "音声コマンドは直感的でしたか？ (1-5, 5=とても直感的): " voice_intuitive
    read -p "音声機能で改善してほしい点: " voice_improvements
    echo
    
    # Quick commands
    echo "⚡ クイックコマンドについて"
    read -p "アイコンは分かりやすかったですか？ (1-5, 5=とても分かりやすい): " icons_clarity
    read -p "ワンタップ実行は便利でしたか？ (1-5, 5=とても便利): " quick_convenience
    read -p "追加してほしいクイックコマンド: " quick_requests
    echo
    
    # Mobile experience
    echo "📱 モバイル体験について"
    read -p "スマホでの操作性はどうでしたか？ (1-5, 5=完璧): " mobile_usability
    read -p "画面サイズは適切でしたか？ (1-5, 5=完璧): " mobile_layout
    read -p "タッチ操作で困ったことは?: " mobile_issues
    echo
    
    # Performance
    echo "⚡ パフォーマンスについて"
    read -p "レスポンス速度はどうでしたか？ (1-5, 5=とても速い): " response_speed
    read -p "Claude Code の実行時間は？ (1-5, 5=とても速い): " execution_speed
    read -p "パフォーマンスで気になった点: " performance_issues
    echo
}

# Collect overall feedback
collect_overall_feedback() {
    log_title "総合的なフィードバック"
    echo
    
    read -p "⭐ 総合的な満足度 (1-5, 5=とても満足): " overall_satisfaction
    read -p "🎯 最も気に入った機能: " favorite_feature
    read -p "😞 最も困った・不満だった点: " biggest_issue
    read -p "💡 改善提案やアイデア: " improvement_suggestions
    read -p "🚀 他の人に推薦しますか？ (1-5, 5=強く推薦): " recommendation_score
    read -p "💬 その他コメント: " additional_comments
    echo
}

# Collect usage scenarios
collect_usage_scenarios() {
    log_title "利用シナリオ"
    echo
    
    echo "以下のシナリオで実際に試していただけましたか？"
    echo
    
    read -p "🔐 認証機能の追加 (y/n): " scenario_auth
    if [[ "$scenario_auth" == "y" ]]; then
        read -p "  評価 (1-5): " auth_rating
        read -p "  コメント: " auth_comment
    fi
    echo
    
    read -p "🐛 バグ修正の依頼 (y/n): " scenario_bug
    if [[ "$scenario_bug" == "y" ]]; then
        read -p "  評価 (1-5): " bug_rating
        read -p "  コメント: " bug_comment
    fi
    echo
    
    read -p "📄 ファイル作成・編集 (y/n): " scenario_file
    if [[ "$scenario_file" == "y" ]]; then
        read -p "  評価 (1-5): " file_rating
        read -p "  コメント: " file_comment
    fi
    echo
    
    read -p "🎨 UI改善の依頼 (y/n): " scenario_ui
    if [[ "$scenario_ui" == "y" ]]; then
        read -p "  評価 (1-5): " ui_rating
        read -p "  コメント: " ui_comment
    fi
    echo
}

# Generate feedback report
generate_feedback_report() {
    log_info "フィードバックレポートを生成中..."
    
    cat > "$FEEDBACK_FILE" << EOF
# Vibe Coder ユーザーフィードバック

**収集日時**: $(date '+%Y年%m月%d日 %H:%M:%S')

## 👤 ユーザー情報

- **名前**: $user_name
- **デバイス**: $device
- **ブラウザ**: $browser
- **職業・役割**: $role
- **プログラミング経験**: $experience/5

## 🔌 接続体験

- **接続の簡単さ**: $connection_ease/5
- **接続速度**: $connection_speed/5
- **接続時の問題**: $connection_issues

## 🎤 音声コマンド

- **音声認識精度**: $voice_accuracy/5
- **直感性**: $voice_intuitive/5
- **改善提案**: $voice_improvements

## ⚡ クイックコマンド

- **アイコンの分かりやすさ**: $icons_clarity/5
- **ワンタップの便利さ**: $quick_convenience/5
- **追加希望コマンド**: $quick_requests

## 📱 モバイル体験

- **操作性**: $mobile_usability/5
- **画面レイアウト**: $mobile_layout/5
- **問題点**: $mobile_issues

## ⚡ パフォーマンス

- **レスポンス速度**: $response_speed/5
- **実行速度**: $execution_speed/5
- **パフォーマンス問題**: $performance_issues

## 🎯 利用シナリオ評価

EOF

    if [[ "$scenario_auth" == "y" ]]; then
        cat >> "$FEEDBACK_FILE" << EOF
### 🔐 認証機能追加
- **評価**: $auth_rating/5
- **コメント**: $auth_comment

EOF
    fi

    if [[ "$scenario_bug" == "y" ]]; then
        cat >> "$FEEDBACK_FILE" << EOF
### 🐛 バグ修正
- **評価**: $bug_rating/5
- **コメント**: $bug_comment

EOF
    fi

    if [[ "$scenario_file" == "y" ]]; then
        cat >> "$FEEDBACK_FILE" << EOF
### 📄 ファイル操作
- **評価**: $file_rating/5
- **コメント**: $file_comment

EOF
    fi

    if [[ "$scenario_ui" == "y" ]]; then
        cat >> "$FEEDBACK_FILE" << EOF
### 🎨 UI改善
- **評価**: $ui_rating/5
- **コメント**: $ui_comment

EOF
    fi

    cat >> "$FEEDBACK_FILE" << EOF
## 📊 総合評価

- **総合満足度**: $overall_satisfaction/5
- **最も気に入った機能**: $favorite_feature
- **最も困った点**: $biggest_issue
- **改善提案**: $improvement_suggestions
- **推薦度**: $recommendation_score/5
- **その他コメント**: $additional_comments

## 📈 定量データ

| 項目 | 評価 |
|------|------|
| 接続の簡単さ | $connection_ease/5 |
| 音声認識精度 | $voice_accuracy/5 |
| モバイル操作性 | $mobile_usability/5 |
| レスポンス速度 | $response_speed/5 |
| 総合満足度 | $overall_satisfaction/5 |
| 推薦度 | $recommendation_score/5 |

---

*このフィードバックは Vibe Coder の改善に活用されます。ご協力ありがとうございました！*
EOF

    log_success "フィードバックレポートを保存しました: $FEEDBACK_FILE"
}

# Show feedback summary
show_feedback_summary() {
    echo
    log_title "📊 フィードバック収集完了"
    echo
    
    log_info "収集したフィードバック:"
    log_success "ユーザー: $user_name"
    log_success "デバイス: $device ($browser)"
    log_success "総合満足度: $overall_satisfaction/5"
    log_success "推薦度: $recommendation_score/5"
    echo
    
    log_info "保存場所: $FEEDBACK_FILE"
    echo
    
    # Calculate average scores
    local total=0
    local count=0
    
    for score in $connection_ease $voice_accuracy $mobile_usability $response_speed $overall_satisfaction $recommendation_score; do
        if [[ "$score" =~ ^[1-5]$ ]]; then
            total=$((total + score))
            count=$((count + 1))
        fi
    done
    
    if [[ $count -gt 0 ]]; then
        local average=$(echo "scale=1; $total / $count" | bc 2>/dev/null || echo "N/A")
        log_success "平均評価: $average/5"
    fi
    
    echo
    log_info "次のステップ:"
    echo "  1. フィードバックレポートを確認"
    echo "  2. 改善点の優先順位を決定"
    echo "  3. 必要に応じて追加テストを実施"
    echo
}

# Main function
main() {
    clear
    log_title "Vibe Coder ユーザーフィードバック収集"
    echo
    
    log_info "このツールでは、Vibe Coder のユーザーテスト後のフィードバックを収集します。"
    log_info "約5-10分程度お時間をいただきます。"
    echo
    
    read -p "フィードバック収集を開始しますか？ (y/n): " start_feedback
    if [[ "$start_feedback" != "y" ]]; then
        log_info "フィードバック収集をキャンセルしました"
        exit 0
    fi
    
    # Create feedback directory
    create_feedback_dir
    
    # Collect all feedback
    collect_user_info
    collect_functionality_feedback
    collect_usage_scenarios
    collect_overall_feedback
    
    # Generate report
    generate_feedback_report
    
    # Show summary
    show_feedback_summary
    
    # Ask about opening file
    read -p "フィードバックファイルを開きますか？ (y/n): " open_file
    if [[ "$open_file" == "y" ]]; then
        if command -v code &> /dev/null; then
            code "$FEEDBACK_FILE"
        elif command -v nano &> /dev/null; then
            nano "$FEEDBACK_FILE"
        else
            log_info "ファイルの場所: $FEEDBACK_FILE"
        fi
    fi
}

# Run main function
main "$@"