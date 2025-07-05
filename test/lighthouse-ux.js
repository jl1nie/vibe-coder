/**
 * Lighthouse UX Performance Tests
 * Core Web Vitals とユーザーエクスペリエンス指標の測定
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

// テスト対象URL
const TEST_URLS = [
  'http://localhost:4173/',
  'http://localhost:4173/connect',
  'http://localhost:4173/terminal',
  'http://localhost:4173/settings'
];

// Lighthouse設定
const LIGHTHOUSE_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    emulatedFormFactor: 'mobile',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    },
    auditMode: false,
    gatherMode: false,
    disableDeviceEmulation: false,
    disableStorageReset: false,
    locale: 'ja-JP',
    onlyAudits: [
      // Performance
      'first-contentful-paint',
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
      'speed-index',
      'interactive',
      
      // Accessibility
      'color-contrast',
      'focus-visible',
      'keyboard-navigation',
      'aria-labels',
      'heading-order',
      'alt-text',
      'tap-targets',
      
      // Best Practices
      'https-only',
      'no-vulnerable-libraries',
      'csp-xss',
      'errors-in-console',
      
      // SEO
      'meta-description',
      'viewport',
      'document-title',
      'lang',
      
      // PWA
      'installable-manifest',
      'service-worker',
      'offline-start-url',
      'apple-touch-icon',
      'themed-omnibox'
    ]
  }
};

// 品質基準
const QUALITY_THRESHOLDS = {
  performance: {
    'first-contentful-paint': 2000,        // 2秒以内
    'largest-contentful-paint': 2500,      // 2.5秒以内
    'cumulative-layout-shift': 0.1,        // 0.1以下
    'total-blocking-time': 300,            // 300ms以下
    'speed-index': 3000,                   // 3秒以内
    'interactive': 3500                    // 3.5秒以内
  },
  accessibility: {
    'color-contrast': 1.0,                 // 完全準拠
    'focus-visible': 1.0,                  // 完全準拠
    'keyboard-navigation': 1.0,            // 完全準拠
    'aria-labels': 1.0,                    // 完全準拠
    'tap-targets': 1.0                     // 完全準拠
  },
  pwa: {
    'installable-manifest': 1.0,           // 完全準拠
    'service-worker': 1.0,                 // 完全準拠
    'offline-start-url': 1.0              // 完全準拠
  }
};

// デバイス別設定
const DEVICE_CONFIGS = {
  mobile: {
    emulatedFormFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638,
      cpuSlowdownMultiplier: 4
    }
  },
  desktop: {
    emulatedFormFactor: 'desktop',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1
    }
  }
};

async function runLighthouseAudit(url, config) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      ...config
    });
    
    await chrome.kill();
    return result;
  } catch (error) {
    await chrome.kill();
    throw error;
  }
}

async function analyzeResults(results) {
  const analysis = {
    url: results.lhr.finalUrl,
    timestamp: new Date().toISOString(),
    scores: {
      performance: results.lhr.categories.performance.score * 100,
      accessibility: results.lhr.categories.accessibility.score * 100,
      bestPractices: results.lhr.categories['best-practices'].score * 100,
      seo: results.lhr.categories.seo.score * 100,
      pwa: results.lhr.categories.pwa.score * 100
    },
    metrics: {},
    issues: []
  };

  // Core Web Vitals
  const audits = results.lhr.audits;
  
  analysis.metrics.fcp = audits['first-contentful-paint'].numericValue;
  analysis.metrics.lcp = audits['largest-contentful-paint'].numericValue;
  analysis.metrics.cls = audits['cumulative-layout-shift'].numericValue;
  analysis.metrics.tbt = audits['total-blocking-time'].numericValue;
  analysis.metrics.si = audits['speed-index'].numericValue;
  analysis.metrics.tti = audits['interactive'].numericValue;

  // 品質基準チェック
  for (const [category, thresholds] of Object.entries(QUALITY_THRESHOLDS)) {
    for (const [metric, threshold] of Object.entries(thresholds)) {
      const audit = audits[metric];
      if (audit) {
        const value = audit.numericValue || audit.score;
        const passed = category === 'performance' ? value <= threshold : value >= threshold;
        
        if (!passed) {
          analysis.issues.push({
            category,
            metric,
            value,
            threshold,
            severity: 'error'
          });
        }
      }
    }
  }

  // アクセシビリティ問題の詳細
  if (analysis.scores.accessibility < 95) {
    const a11yAudits = [
      'color-contrast',
      'focus-visible',
      'keyboard-navigation',
      'aria-labels',
      'heading-order',
      'alt-text',
      'tap-targets'
    ];
    
    a11yAudits.forEach(auditName => {
      const audit = audits[auditName];
      if (audit && audit.score < 1) {
        analysis.issues.push({
          category: 'accessibility',
          metric: auditName,
          description: audit.description,
          details: audit.details,
          severity: 'warning'
        });
      }
    });
  }

  return analysis;
}

async function generateReport(analysisResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: analysisResults.length,
      passedTests: analysisResults.filter(r => r.issues.length === 0).length,
      totalIssues: analysisResults.reduce((sum, r) => sum + r.issues.length, 0)
    },
    results: analysisResults,
    recommendations: []
  };

  // 共通問題の分析
  const commonIssues = {};
  analysisResults.forEach(result => {
    result.issues.forEach(issue => {
      const key = `${issue.category}-${issue.metric}`;
      if (!commonIssues[key]) {
        commonIssues[key] = { count: 0, issue };
      }
      commonIssues[key].count++;
    });
  });

  // 推奨事項の生成
  Object.entries(commonIssues).forEach(([key, data]) => {
    if (data.count > 1) {
      report.recommendations.push({
        priority: 'high',
        category: data.issue.category,
        issue: data.issue.metric,
        description: `${data.issue.metric} issue found in ${data.count} pages`,
        action: getRecommendedAction(data.issue.category, data.issue.metric)
      });
    }
  });

  return report;
}

function getRecommendedAction(category, metric) {
  const actions = {
    performance: {
      'first-contentful-paint': 'Optimize critical rendering path and reduce server response time',
      'largest-contentful-paint': 'Optimize largest content element loading and reduce render blocking',
      'cumulative-layout-shift': 'Add size attributes to images and avoid inserting content above existing content',
      'total-blocking-time': 'Reduce JavaScript execution time and split long tasks',
      'speed-index': 'Optimize above-the-fold content and reduce render blocking resources',
      'interactive': 'Reduce JavaScript execution time and minimize main thread work'
    },
    accessibility: {
      'color-contrast': 'Ensure sufficient color contrast ratio (4.5:1 for normal text)',
      'focus-visible': 'Ensure all interactive elements have visible focus indicators',
      'keyboard-navigation': 'Ensure all functionality is accessible via keyboard',
      'aria-labels': 'Add proper ARIA labels to all interactive elements',
      'tap-targets': 'Ensure touch targets are at least 44px in size'
    },
    pwa: {
      'installable-manifest': 'Fix manifest.json validation errors',
      'service-worker': 'Ensure service worker is properly registered and functional',
      'offline-start-url': 'Ensure start URL loads when offline'
    }
  };

  return actions[category]?.[metric] || 'Review and fix the identified issue';
}

async function runUXTests() {
  console.log('🚀 Starting UX Performance Tests...');
  
  const allResults = [];
  
  // 各デバイス・URL組み合わせでテスト実行
  for (const [deviceType, deviceConfig] of Object.entries(DEVICE_CONFIGS)) {
    console.log(`\n📱 Testing ${deviceType} device...`);
    
    for (const url of TEST_URLS) {
      console.log(`  🔍 Testing ${url}...`);
      
      const config = {
        ...LIGHTHOUSE_CONFIG,
        settings: {
          ...LIGHTHOUSE_CONFIG.settings,
          ...deviceConfig
        }
      };
      
      try {
        const result = await runLighthouseAudit(url, config);
        const analysis = await analyzeResults(result);
        analysis.device = deviceType;
        allResults.push(analysis);
        
        // 結果の簡易表示
        console.log(`    ✅ Performance: ${analysis.scores.performance.toFixed(1)}`);
        console.log(`    ✅ Accessibility: ${analysis.scores.accessibility.toFixed(1)}`);
        console.log(`    ✅ PWA: ${analysis.scores.pwa.toFixed(1)}`);
        console.log(`    ⚠️  Issues: ${analysis.issues.length}`);
        
      } catch (error) {
        console.error(`    ❌ Error testing ${url}:`, error.message);
      }
    }
  }
  
  // レポート生成
  const report = await generateReport(allResults);
  
  // 結果の保存
  const reportPath = path.join(__dirname, '../lighthouse-results');
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }
  
  const reportFile = path.join(reportPath, `ux-report-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  // サマリーの表示
  console.log('\n📊 UX Test Results Summary:');
  console.log(`  Total Tests: ${report.summary.totalTests}`);
  console.log(`  Passed Tests: ${report.summary.passedTests}`);
  console.log(`  Total Issues: ${report.summary.totalIssues}`);
  console.log(`  Report saved: ${reportFile}`);
  
  // 推奨事項の表示
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.description}`);
      console.log(`     Action: ${rec.action}`);
    });
  }
  
  return report;
}

// メイン実行
if (require.main === module) {
  runUXTests()
    .then(report => {
      const success = report.summary.totalIssues === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ UX Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { runUXTests, analyzeResults, generateReport };