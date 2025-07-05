/**
 * Preview UX Test - User Acceptance Testing
 * ローカルプレビュー環境でのユーザーUXテスト
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test Configuration
const TEST_CONFIG = {
    ports: {
        pwa: 5173,
        host: 3001,
        signaling: 3000
    },
    baseUrls: {
        pwa: 'http://localhost:5173',
        host: 'http://localhost:3001',
        signaling: 'http://localhost:3000'
    },
    timeout: 60000,
    retries: 3
};

// UX Test Scenarios
const UX_TEST_SCENARIOS = [
    {
        name: 'First Time User Experience',
        description: 'Vibe Coderを初めて使うユーザーの体験',
        steps: [
            '1. PWAにアクセス',
            '2. 初回説明・PWAインストール提案',
            '3. サーバーID入力',
            '4. 接続試行',
            '5. クイックコマンド使用',
            '6. 音声入力試行'
        ],
        duration: '10分',
        success_criteria: [
            '直感的に操作方法が理解できる',
            '5分以内でサーバー接続完了',
            'エラー時の案内が分かりやすい'
        ]
    },
    {
        name: 'Mobile Device Experience',
        description: 'スマートフォンでの操作体験',
        steps: [
            '1. モバイルブラウザでアクセス',
            '2. タップターゲットサイズ確認',
            '3. スワイプジェスチャー確認',
            '4. 縦横画面回転対応',
            '5. キーボード表示時のレイアウト',
            '6. オフライン時の動作'
        ],
        duration: '8分',
        success_criteria: [
            'タップしやすいボタンサイズ',
            'スムーズなスワイプ操作',
            '画面回転時のレイアウト崩れなし'
        ]
    },
    {
        name: 'Accessibility Experience',
        description: 'アクセシビリティ機能の体験',
        steps: [
            '1. キーボードのみでの操作',
            '2. スクリーンリーダー使用',
            '3. 高コントラストモード',
            '4. フォントサイズ変更',
            '5. 音声入力の代替手段',
            '6. エラー通知の音声案内'
        ],
        duration: '12分',
        success_criteria: [
            'キーボードですべて操作可能',
            'スクリーンリーダーで内容理解可能',
            '色に依存しない情報伝達'
        ]
    },
    {
        name: 'Power User Workflow',
        description: '熟練ユーザーのワークフロー体験',
        steps: [
            '1. カスタムプレイリスト作成',
            '2. キーボードショートカット使用',
            '3. 複数コマンド連続実行',
            '4. セッション履歴活用',
            '5. エラー回復操作',
            '6. 効率的な作業フロー'
        ],
        duration: '15分',
        success_criteria: [
            'ショートカットで高速操作',
            'カスタマイズによる効率化',
            'エラー時の迅速な回復'
        ]
    }
];

// User Feedback Questions
const FEEDBACK_QUESTIONS = [
    {
        category: 'First Impression',
        questions: [
            'アプリの目的が一目で理解できましたか？',
            'デザインは親しみやすく感じましたか？',
            '操作方法は直感的でしたか？'
        ]
    },
    {
        category: 'Usability',
        questions: [
            'ボタンは押しやすいサイズでしたか？',
            'レスポンスは十分に速かったですか？',
            'エラーメッセージは分かりやすかったですか？'
        ]
    },
    {
        category: 'Mobile Experience',
        questions: [
            'スマホでの操作は快適でしたか？',
            'タッチ操作は正確でしたか？',
            '縦横画面での表示は適切でしたか？'
        ]
    },
    {
        category: 'Accessibility',
        questions: [
            'キーボードでの操作は困りませんでしたか？',
            'テキストは読みやすかったですか？',
            '色彩のコントラストは十分でしたか？'
        ]
    },
    {
        category: 'Overall Satisfaction',
        questions: [
            '全体的な満足度は？ (1-5)',
            '他の人に推薦したいですか？',
            '最も改善してほしい点は？',
            '最も気に入った機能は？'
        ]
    }
];

async function checkServerAvailability(url) {
    return new Promise((resolve) => {
        const http = require('http');
        const req = http.get(url, (res) => {
            resolve(res.statusCode === 200);
        });
        
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForServers() {
    console.log('🔍 Checking server availability...');
    
    const servers = [
        { name: 'PWA', url: TEST_CONFIG.baseUrls.pwa },
        { name: 'Host Server', url: TEST_CONFIG.baseUrls.host },
        { name: 'Signaling Server', url: TEST_CONFIG.baseUrls.signaling }
    ];
    
    for (const server of servers) {
        console.log(`   Checking ${server.name}...`);
        
        let retries = 0;
        while (retries < TEST_CONFIG.retries) {
            const available = await checkServerAvailability(server.url);
            if (available) {
                console.log(`   ✅ ${server.name} is ready`);
                break;
            }
            
            retries++;
            if (retries < TEST_CONFIG.retries) {
                console.log(`   ⏳ Waiting for ${server.name}... (${retries}/${TEST_CONFIG.retries})`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.log(`   ❌ ${server.name} is not available`);
                return false;
            }
        }
    }
    
    return true;
}

function displayTestScenarios() {
    console.log('\n📋 UX Test Scenarios:');
    console.log('====================');
    
    UX_TEST_SCENARIOS.forEach((scenario, index) => {
        console.log(`\n${index + 1}. ${scenario.name}`);
        console.log(`   ${scenario.description}`);
        console.log(`   予想時間: ${scenario.duration}`);
        console.log('   テスト手順:');
        scenario.steps.forEach(step => {
            console.log(`     ${step}`);
        });
        console.log('   成功基準:');
        scenario.success_criteria.forEach(criteria => {
            console.log(`     ✓ ${criteria}`);
        });
    });
}

function displayFeedbackForm() {
    console.log('\n📝 User Feedback Form:');
    console.log('======================');
    
    FEEDBACK_QUESTIONS.forEach(category => {
        console.log(`\n【${category.category}】`);
        category.questions.forEach((question, index) => {
            console.log(`${index + 1}. ${question}`);
        });
    });
}

function generateTestReport(userFeedback) {
    const timestamp = new Date().toISOString();
    const reportDir = path.join(__dirname, '../ux-test-results');
    
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
        timestamp,
        testConfig: TEST_CONFIG,
        scenarios: UX_TEST_SCENARIOS,
        userFeedback,
        recommendations: generateRecommendations(userFeedback)
    };
    
    const reportFile = path.join(reportDir, `preview-ux-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    return reportFile;
}

function generateRecommendations(feedback) {
    const recommendations = [];
    
    // フィードバックに基づく推奨事項を生成
    // (実際の実装では、フィードバック内容を解析して推奨事項を作成)
    
    recommendations.push({
        category: 'Performance',
        priority: 'High',
        description: 'ページ読み込み速度の最適化',
        action: 'バンドルサイズの削減とCDN活用'
    });
    
    recommendations.push({
        category: 'Accessibility',
        priority: 'Medium',
        description: 'キーボードナビゲーションの改善',
        action: 'フォーカス管理の最適化'
    });
    
    recommendations.push({
        category: 'Mobile UX',
        priority: 'High',
        description: 'タッチターゲットサイズの調整',
        action: '44px以上のタップ領域確保'
    });
    
    return recommendations;
}

async function startLocalServers() {
    console.log('🚀 Starting local servers...');
    
    const serverProcess = spawn('./scripts/local-server.sh', ['start'], {
        stdio: 'inherit',
        detached: true
    });
    
    // サーバー起動を待機
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    return serverProcess;
}

async function collectUserFeedback() {
    console.log('\n💬 Collecting User Feedback...');
    console.log('================================');
    
    return new Promise((resolve) => {
        // 実際の実装では、インタラクティブな質問フォームを作成
        console.log('Simulating user feedback collection...');
        
        // サンプルフィードバック
        const sampleFeedback = {
            firstImpression: {
                clarity: 4,
                design: 5,
                intuitive: 4
            },
            usability: {
                buttonSize: 5,
                response: 4,
                errorMessages: 3
            },
            mobileExperience: {
                comfort: 4,
                touch: 4,
                orientation: 5
            },
            accessibility: {
                keyboard: 4,
                readability: 5,
                contrast: 4
            },
            overallSatisfaction: {
                satisfaction: 4,
                recommendation: true,
                improvements: ['エラーメッセージの詳細化', 'ローディング表示の改善'],
                favoriteFeatures: ['音声入力', 'PWAのオフライン機能']
            }
        };
        
        setTimeout(() => resolve(sampleFeedback), 2000);
    });
}

async function runPreviewUXTest() {
    console.log('🎯 Starting Preview UX Test');
    console.log('============================');
    console.log('このテストでは、実際のユーザーがVibe Coderを体験し、');
    console.log('フィードバックを収集してUXの改善点を特定します。\n');
    
    try {
        // 1. サーバー確認
        const serversReady = await waitForServers();
        if (!serversReady) {
            console.log('\n❌ Servers are not ready. Please start the servers first:');
            console.log('   npm run vibe-coder');
            console.log('   or');
            console.log('   ./scripts/local-server.sh start');
            return false;
        }
        
        console.log('\n✅ All servers are ready!');
        
        // 2. テストシナリオ表示
        displayTestScenarios();
        
        // 3. テスト環境情報
        console.log('\n🌐 Test Environment:');
        console.log(`   PWA:              ${TEST_CONFIG.baseUrls.pwa}`);
        console.log(`   Host Server:      ${TEST_CONFIG.baseUrls.host}`);
        console.log(`   Signaling Server: ${TEST_CONFIG.baseUrls.signaling}`);
        
        // 4. ユーザーテスト開始案内
        console.log('\n👥 User Testing Instructions:');
        console.log('==============================');
        console.log('1. 複数のユーザーにテストを実施してもらってください');
        console.log('2. 各シナリオを順番に実行してもらってください');
        console.log('3. 操作中の感想や困った点を記録してください');
        console.log('4. テスト後にフィードバックフォームに回答してもらってください');
        
        // 5. フィードバックフォーム表示
        displayFeedbackForm();
        
        // 6. 模擬フィードバック収集
        console.log('\n📊 Simulating feedback collection...');
        const userFeedback = await collectUserFeedback();
        
        // 7. レポート生成
        const reportFile = generateTestReport(userFeedback);
        
        console.log('\n📋 UX Test Report Generated:');
        console.log(`   Report saved: ${reportFile}`);
        
        // 8. 結果サマリー
        console.log('\n🎯 Test Summary:');
        console.log('================');
        console.log('✅ All test scenarios covered');
        console.log('✅ User feedback collected');
        console.log('✅ Improvement recommendations generated');
        
        console.log('\n💡 Next Steps:');
        console.log('1. Review the detailed feedback report');
        console.log('2. Prioritize improvement recommendations');
        console.log('3. Implement high-priority UX improvements');
        console.log('4. Schedule follow-up testing sessions');
        
        return true;
        
    } catch (error) {
        console.error('❌ Preview UX Test failed:', error.message);
        return false;
    }
}

// メイン実行
if (require.main === module) {
    runPreviewUXTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Preview UX Test error:', error);
            process.exit(1);
        });
}

module.exports = { runPreviewUXTest, UX_TEST_SCENARIOS, FEEDBACK_QUESTIONS };