/**
 * Accessibility Audit Script
 * WCAG 2.1 AA準拠の包括的アクセシビリティテスト
 */

const { chromium } = require('playwright');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');

// テスト対象URL
const TEST_URLS = [
  'http://localhost:4173/',
  'http://localhost:4173/connect',
  'http://localhost:4173/terminal',
  'http://localhost:4173/settings'
];

// アクセシビリティルール設定
const AXE_CONFIG = {
  rules: {
    // WCAG 2.1 AA準拠
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: true },
    'focus-visible': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'aria-labels': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-properties': { enabled: true },
    'aria-states': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-roles': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'skip-link': { enabled: true },
    'tabindex': { enabled: true },
    'alt-text': { enabled: true },
    'form-labels': { enabled: true },
    'input-image-alt': { enabled: true },
    'label-content-name-mismatch': { enabled: true },
    'link-name': { enabled: true },
    'button-name': { enabled: true },
    'duplicate-id': { enabled: true },
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'meta-refresh': { enabled: true },
    'meta-viewport': { enabled: true },
    'document-title': { enabled: true },
    'frame-title': { enabled: true },
    'image-alt': { enabled: true },
    'input-button-name': { enabled: true },
    'select-name': { enabled: true },
    'textarea-name': { enabled: true },
    'th-has-data-cells': { enabled: true },
    'valid-lang': { enabled: true },
    'video-captions': { enabled: true },
    'audio-captions': { enabled: true }
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
};

// 重要度別の分類
const SEVERITY_LEVELS = {
  critical: ['color-contrast', 'keyboard-navigation', 'focus-visible'],
  serious: ['aria-labels', 'heading-order', 'alt-text', 'form-labels'],
  moderate: ['landmark-roles', 'region', 'tabindex'],
  minor: ['meta-viewport', 'document-title', 'html-has-lang']
};

// デバイス別テスト設定
const DEVICE_CONFIGS = [
  {
    name: 'desktop',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    name: 'tablet',
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  {
    name: 'mobile',
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  }
];

async function runAxeAudit(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  
  // axe-coreを注入
  await page.evaluate(axeCore.source);
  
  // アクセシビリティ監査実行
  const results = await page.evaluate(async (config) => {
    return await axe.run(document, config);
  }, AXE_CONFIG);
  
  return results;
}

async function performKeyboardNavigation(page) {
  const navigationResults = {
    tabbableElements: [],
    focusTraps: [],
    skipLinks: [],
    keyboardShortcuts: []
  };
  
  // タブナビゲーションのテスト
  await page.keyboard.press('Tab');
  let previousFocus = null;
  let tabCount = 0;
  const maxTabs = 50; // 無限ループ防止
  
  while (tabCount < maxTabs) {
    const currentFocus = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement ? {
        tagName: activeElement.tagName,
        id: activeElement.id,
        className: activeElement.className,
        ariaLabel: activeElement.getAttribute('aria-label'),
        role: activeElement.getAttribute('role'),
        tabIndex: activeElement.tabIndex,
        boundingRect: activeElement.getBoundingClientRect(),
        visible: activeElement.offsetParent !== null
      } : null;
    });
    
    if (!currentFocus) break;
    
    // 同じ要素に戻った場合は終了
    if (previousFocus && 
        currentFocus.tagName === previousFocus.tagName &&
        currentFocus.id === previousFocus.id &&
        currentFocus.className === previousFocus.className) {
      break;
    }
    
    navigationResults.tabbableElements.push(currentFocus);
    previousFocus = currentFocus;
    tabCount++;
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
  }
  
  // スキップリンクのテスト
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  
  const skipLink = await page.evaluate(() => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.textContent.toLowerCase().includes('skip')) {
      return {
        text: activeElement.textContent,
        href: activeElement.href,
        visible: activeElement.offsetParent !== null
      };
    }
    return null;
  });
  
  if (skipLink) {
    navigationResults.skipLinks.push(skipLink);
  }
  
  // キーボードショートカットのテスト
  const shortcuts = [
    { key: 'Control+k', description: 'Command palette' },
    { key: 'Escape', description: 'Close modal' },
    { key: 'Enter', description: 'Submit form' },
    { key: 'Space', description: 'Activate button' }
  ];
  
  for (const shortcut of shortcuts) {
    await page.keyboard.press(shortcut.key);
    await page.waitForTimeout(500);
    
    const result = await page.evaluate(() => {
      return {
        modalOpen: document.querySelector('[role="dialog"]') !== null,
        commandPaletteOpen: document.querySelector('[data-testid="command-palette"]') !== null,
        focusedElement: document.activeElement ? document.activeElement.tagName : null
      };
    });
    
    navigationResults.keyboardShortcuts.push({
      ...shortcut,
      result
    });
  }
  
  return navigationResults;
}

async function testColorContrast(page) {
  const contrastResults = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const results = [];
    
    elements.forEach(element => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      const fontSize = parseFloat(styles.fontSize);
      
      if (color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        // 簡易的なコントラスト比計算
        const colorLuminance = getLuminance(color);
        const bgLuminance = getLuminance(backgroundColor);
        const contrastRatio = (Math.max(colorLuminance, bgLuminance) + 0.05) / 
                             (Math.min(colorLuminance, bgLuminance) + 0.05);
        
        const isLargeText = fontSize >= 18 || 
                           (fontSize >= 14 && styles.fontWeight === 'bold');
        const requiredRatio = isLargeText ? 3.0 : 4.5;
        
        if (contrastRatio < requiredRatio) {
          results.push({
            element: element.tagName + (element.id ? `#${element.id}` : ''),
            color,
            backgroundColor,
            fontSize,
            contrastRatio: contrastRatio.toFixed(2),
            required: requiredRatio,
            passes: false
          });
        }
      }
    });
    
    return results;
  });
  
  return contrastResults;
}

function getLuminance(color) {
  // RGB値の抽出と正規化
  const rgb = color.match(/\d+/g);
  if (!rgb) return 0;
  
  const [r, g, b] = rgb.map(c => {
    c = parseInt(c) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function testScreenReader(page) {
  const screenReaderResults = await page.evaluate(() => {
    const results = {
      headingStructure: [],
      landmarks: [],
      ariaLabels: [],
      altTexts: [],
      formLabels: []
    };
    
    // 見出し構造の確認
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      results.headingStructure.push({
        level: heading.tagName,
        text: heading.textContent.trim(),
        hasId: !!heading.id
      });
    });
    
    // ランドマークの確認
    const landmarks = document.querySelectorAll('[role], main, nav, header, footer, aside, section');
    landmarks.forEach(landmark => {
      results.landmarks.push({
        tagName: landmark.tagName,
        role: landmark.getAttribute('role') || landmark.tagName.toLowerCase(),
        ariaLabel: landmark.getAttribute('aria-label'),
        ariaLabelledBy: landmark.getAttribute('aria-labelledby')
      });
    });
    
    // ARIA ラベルの確認
    const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
    ariaElements.forEach(element => {
      results.ariaLabels.push({
        tagName: element.tagName,
        ariaLabel: element.getAttribute('aria-label'),
        ariaLabelledBy: element.getAttribute('aria-labelledby'),
        ariaDescribedBy: element.getAttribute('aria-describedby')
      });
    });
    
    // 画像のalt属性確認
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      results.altTexts.push({
        src: img.src,
        alt: img.alt,
        hasAlt: img.hasAttribute('alt'),
        decorative: img.getAttribute('role') === 'presentation'
      });
    });
    
    // フォームラベルの確認
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      const label = document.querySelector(`label[for="${input.id}"]`);
      results.formLabels.push({
        type: input.type,
        id: input.id,
        hasLabel: !!label,
        labelText: label ? label.textContent : null,
        ariaLabel: input.getAttribute('aria-label'),
        placeholder: input.placeholder
      });
    });
    
    return results;
  });
  
  return screenReaderResults;
}

async function generateAccessibilityReport(allResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPages: allResults.length,
      totalViolations: 0,
      violationsByLevel: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      wcagCompliance: { aa: true, aaa: true }
    },
    results: allResults,
    recommendations: []
  };
  
  // 結果の集計
  allResults.forEach(result => {
    result.axeResults.violations.forEach(violation => {
      report.summary.totalViolations++;
      
      const level = getSeverityLevel(violation.id);
      report.summary.violationsByLevel[level]++;
      
      if (level === 'critical' || level === 'serious') {
        report.summary.wcagCompliance.aa = false;
      }
    });
  });
  
  // 推奨事項の生成
  const commonViolations = getCommonViolations(allResults);
  commonViolations.forEach(violation => {
    report.recommendations.push({
      rule: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      frequency: violation.frequency,
      pages: violation.pages
    });
  });
  
  return report;
}

function getSeverityLevel(ruleId) {
  for (const [level, rules] of Object.entries(SEVERITY_LEVELS)) {
    if (rules.includes(ruleId)) {
      return level;
    }
  }
  return 'moderate';
}

function getCommonViolations(results) {
  const violationCounts = {};
  
  results.forEach(result => {
    result.axeResults.violations.forEach(violation => {
      if (!violationCounts[violation.id]) {
        violationCounts[violation.id] = {
          ...violation,
          frequency: 0,
          pages: []
        };
      }
      
      violationCounts[violation.id].frequency++;
      violationCounts[violation.id].pages.push(result.url);
    });
  });
  
  return Object.values(violationCounts)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10); // 上位10件
}

async function runAccessibilityAudit() {
  console.log('🔍 Starting Accessibility Audit...');
  
  const browser = await chromium.launch({ headless: true });
  const allResults = [];
  
  try {
    for (const device of DEVICE_CONFIGS) {
      console.log(`\n📱 Testing ${device.name} device...`);
      
      const context = await browser.newContext({
        viewport: device.viewport,
        userAgent: device.userAgent
      });
      
      for (const url of TEST_URLS) {
        console.log(`  🔍 Testing ${url}...`);
        
        const page = await context.newPage();
        
        try {
          // Axe監査
          const axeResults = await runAxeAudit(page, url);
          
          // キーボードナビゲーションテスト
          const keyboardResults = await performKeyboardNavigation(page);
          
          // カラーコントラストテスト
          const contrastResults = await testColorContrast(page);
          
          // スクリーンリーダーテスト
          const screenReaderResults = await testScreenReader(page);
          
          const result = {
            url,
            device: device.name,
            timestamp: new Date().toISOString(),
            axeResults,
            keyboardResults,
            contrastResults,
            screenReaderResults,
            summary: {
              violations: axeResults.violations.length,
              passes: axeResults.passes.length,
              incomplete: axeResults.incomplete.length,
              inapplicable: axeResults.inapplicable.length,
              contrastIssues: contrastResults.length,
              tabbableElements: keyboardResults.tabbableElements.length
            }
          };
          
          allResults.push(result);
          
          console.log(`    ✅ Violations: ${result.summary.violations}`);
          console.log(`    ✅ Passes: ${result.summary.passes}`);
          console.log(`    ✅ Contrast Issues: ${result.summary.contrastIssues}`);
          console.log(`    ✅ Tabbable Elements: ${result.summary.tabbableElements}`);
          
        } catch (error) {
          console.error(`    ❌ Error testing ${url}:`, error.message);
        } finally {
          await page.close();
        }
      }
      
      await context.close();
    }
    
    // レポート生成
    const report = await generateAccessibilityReport(allResults);
    
    // 結果の保存
    const reportPath = path.join(__dirname, '../accessibility-results');
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }
    
    const reportFile = path.join(reportPath, `accessibility-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // サマリーの表示
    console.log('\n📊 Accessibility Audit Results:');
    console.log(`  Total Pages Tested: ${report.summary.totalPages}`);
    console.log(`  Total Violations: ${report.summary.totalViolations}`);
    console.log(`  WCAG AA Compliance: ${report.summary.wcagCompliance.aa ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Report saved: ${reportFile}`);
    
    // 重要な問題の表示
    if (report.recommendations.length > 0) {
      console.log('\n🚨 Critical Issues to Fix:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.rule} (${rec.frequency} pages)`);
        console.log(`     ${rec.description}`);
        console.log(`     Help: ${rec.helpUrl}`);
      });
    }
    
    return report;
    
  } finally {
    await browser.close();
  }
}

// メイン実行
if (require.main === module) {
  runAccessibilityAudit()
    .then(report => {
      const success = report.summary.wcagCompliance.aa;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Accessibility Audit failed:', error);
      process.exit(1);
    });
}

module.exports = { runAccessibilityAudit, generateAccessibilityReport };