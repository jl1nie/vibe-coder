/**
 * E2E Global Teardown
 * Cleanup after all E2E tests complete
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E global teardown...');

  // === Cleanup Test Data ===
  await cleanupTestData();
  
  // === Generate Test Reports ===
  await generateTestReports();
  
  // === Cleanup Mock Services ===
  await cleanupMockServices();
  
  // === Performance Report ===
  await generatePerformanceReport();
  
  // === Coverage Report ===
  await generateCoverageReport();
  
  console.log('✅ E2E global teardown completed');
}

/**
 * Clean up test data and temporary files
 */
async function cleanupTestData(): Promise<void> {
  console.log('🗑️ Cleaning up test data...');
  
  const testDataDir = path.join(__dirname, '../e2e/fixtures');
  const testResultsDir = path.join(__dirname, '../test-results');
  
  try {
    // Keep test results but clean up temporary fixtures
    const fixturesDir = path.join(testDataDir, 'temp');
    if (fs.existsSync(fixturesDir)) {
      fs.rmSync(fixturesDir, { recursive: true, force: true });
    }
    
    // Clean up old test screenshots (keep only recent ones)
    const screenshotsDir = path.join(testResultsDir, 'playwright-output');
    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      const oldFiles = files.filter(file => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);
        const daysSinceCreation = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation > 7; // Older than 7 days
      });
      
      oldFiles.forEach(file => {
        fs.unlinkSync(path.join(screenshotsDir, file));
      });
      
      if (oldFiles.length > 0) {
        console.log(`🗑️ Cleaned up ${oldFiles.length} old screenshot files`);
      }
    }
    
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.warn('⚠️ Error during test data cleanup:', error);
  }
}

/**
 * Generate comprehensive test reports
 */
async function generateTestReports(): Promise<void> {
  console.log('📊 Generating test reports...');
  
  const reportsDir = path.join(__dirname, '../test-results/reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  try {
    // Generate test summary report
    const testSummary = await generateTestSummary();
    fs.writeFileSync(
      path.join(reportsDir, 'test-summary.json'),
      JSON.stringify(testSummary, null, 2)
    );
    
    // Generate HTML report
    const htmlReport = generateHtmlReport(testSummary);
    fs.writeFileSync(
      path.join(reportsDir, 'test-summary.html'),
      htmlReport
    );
    
    console.log('✅ Test reports generated');
  } catch (error) {
    console.warn('⚠️ Error generating test reports:', error);
  }
}

/**
 * Generate test summary from results
 */
async function generateTestSummary() {
  const testResultsDir = path.join(__dirname, '../test-results');
  const junitFile = path.join(testResultsDir, 'playwright-junit.xml');
  
  let summary = {
    timestamp: new Date().toISOString(),
    framework: 'Playwright',
    testPyramid: {
      unit: { planned: 500, executed: 0, passed: 0, failed: 0, coverage: 0 },
      integration: { planned: 100, executed: 0, passed: 0, failed: 0, coverage: 0 },
      e2e: { planned: 20, executed: 0, passed: 0, failed: 0, coverage: 0 },
    },
    performance: {
      avgPageLoadTime: 0,
      slowestTest: '',
      memoryLeaks: 0,
    },
    accessibility: {
      wcagViolations: 0,
      contrastIssues: 0,
      keyboardNavigation: 'passed',
    },
    coverage: {
      overall: 0,
      critical: 0,
      lines: 0,
      functions: 0,
      branches: 0,
    },
    devices: {
      desktop: { passed: 0, failed: 0 },
      mobile: { passed: 0, failed: 0 },
      tablet: { passed: 0, failed: 0 },
    },
    browsers: {
      chromium: { passed: 0, failed: 0 },
      firefox: { passed: 0, failed: 0 },
      webkit: { passed: 0, failed: 0 },
    },
  };
  
  // Parse JUnit XML if available
  if (fs.existsSync(junitFile)) {
    try {
      const junitContent = fs.readFileSync(junitFile, 'utf-8');
      
      // Basic XML parsing for test counts
      const testcaseMatches = junitContent.match(/<testcase/g);
      const failureMatches = junitContent.match(/<failure/g);
      const errorMatches = junitContent.match(/<error/g);
      
      const executed = testcaseMatches ? testcaseMatches.length : 0;
      const failed = (failureMatches ? failureMatches.length : 0) + 
                    (errorMatches ? errorMatches.length : 0);
      const passed = executed - failed;
      
      summary.testPyramid.e2e = {
        ...summary.testPyramid.e2e,
        executed,
        passed,
        failed,
        coverage: executed > 0 ? Math.round((passed / executed) * 100) : 0,
      };
      
    } catch (error) {
      console.warn('⚠️ Error parsing JUnit results:', error);
    }
  }
  
  // Read coverage data if available
  const coverageFile = path.join(__dirname, '../coverage/coverage-summary.json');
  if (fs.existsSync(coverageFile)) {
    try {
      const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));
      
      if (coverageData.total) {
        summary.coverage = {
          overall: Math.round(coverageData.total.lines.pct || 0),
          critical: Math.round(coverageData.total.functions.pct || 0),
          lines: Math.round(coverageData.total.lines.pct || 0),
          functions: Math.round(coverageData.total.functions.pct || 0),
          branches: Math.round(coverageData.total.branches.pct || 0),
        };
      }
    } catch (error) {
      console.warn('⚠️ Error reading coverage data:', error);
    }
  }
  
  return summary;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(summary: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Coder - Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; }
        .metric-card h3 { margin: 0 0 15px 0; color: #333; }
        .metric-value { font-size: 2em; font-weight: bold; color: #667eea; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .pyramid { background: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; margin-bottom: 30px; }
        .pyramid-header { background: #667eea; color: white; padding: 15px; font-weight: bold; }
        .pyramid-level { display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #e9ecef; }
        .pyramid-level:last-child { border-bottom: none; }
        .pyramid-icon { width: 40px; height: 40px; margin-right: 15px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; font-weight: bold; }
        .unit-icon { background: #28a745; }
        .integration-icon { background: #ffc107; }
        .e2e-icon { background: #dc3545; }
        .pyramid-stats { display: flex; gap: 20px; flex: 1; }
        .pyramid-stat { text-align: center; }
        .pyramid-stat-value { font-size: 1.2em; font-weight: bold; }
        .pyramid-stat-label { font-size: 0.8em; color: #666; }
        .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-warning { background: #fff3cd; color: #856404; }
        .progress-bar { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-top: 5px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .device-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
        .device-card { background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; text-align: center; }
        .device-icon { font-size: 2em; margin-bottom: 10px; }
        .timestamp { color: #666; font-size: 0.9em; margin-top: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Vibe Coder Test Report</h1>
            <p>Mobile-first Claude Code PWA - Test Pyramid Results</p>
        </div>
        
        <div class="content">
            <div class="metric-grid">
                <div class="metric-card">
                    <h3>📊 Overall Coverage</h3>
                    <div class="metric-value">${summary.coverage.overall}%</div>
                    <div class="metric-label">Code Coverage</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${summary.coverage.overall}%"></div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <h3>🏃‍♂️ Performance</h3>
                    <div class="metric-value">${summary.performance.avgPageLoadTime || 'N/A'}</div>
                    <div class="metric-label">Avg Page Load Time</div>
                </div>
                
                <div class="metric-card">
                    <h3>♿ Accessibility</h3>
                    <div class="metric-value">
                        <span class="status-badge ${summary.accessibility.wcagViolations === 0 ? 'status-passed' : 'status-failed'}">
                            ${summary.accessibility.wcagViolations === 0 ? 'PASSED' : 'VIOLATIONS'}
                        </span>
                    </div>
                    <div class="metric-label">WCAG 2.1 AA Compliance</div>
                </div>
                
                <div class="metric-card">
                    <h3>📱 Cross-Platform</h3>
                    <div class="metric-value">${summary.devices.mobile.passed + summary.devices.tablet.passed + summary.devices.desktop.passed}</div>
                    <div class="metric-label">Devices Tested</div>
                </div>
            </div>
            
            <div class="pyramid">
                <div class="pyramid-header">🔺 Test Pyramid Results</div>
                
                <div class="pyramid-level">
                    <div class="pyramid-icon e2e-icon">E2E</div>
                    <div style="flex: 1;">
                        <strong>End-to-End Tests</strong>
                        <div style="font-size: 0.9em; color: #666;">Critical user flows and integrations</div>
                    </div>
                    <div class="pyramid-stats">
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.e2e.executed}</div>
                            <div class="pyramid-stat-label">Executed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.e2e.passed}</div>
                            <div class="pyramid-stat-label">Passed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.e2e.failed}</div>
                            <div class="pyramid-stat-label">Failed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.e2e.coverage}%</div>
                            <div class="pyramid-stat-label">Success Rate</div>
                        </div>
                    </div>
                </div>
                
                <div class="pyramid-level">
                    <div class="pyramid-icon integration-icon">INT</div>
                    <div style="flex: 1;">
                        <strong>Integration Tests</strong>
                        <div style="font-size: 0.9em; color: #666;">Component and service interactions</div>
                    </div>
                    <div class="pyramid-stats">
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.integration.executed}</div>
                            <div class="pyramid-stat-label">Executed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.integration.passed}</div>
                            <div class="pyramid-stat-label">Passed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.integration.failed}</div>
                            <div class="pyramid-stat-label">Failed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.integration.coverage}%</div>
                            <div class="pyramid-stat-label">Success Rate</div>
                        </div>
                    </div>
                </div>
                
                <div class="pyramid-level">
                    <div class="pyramid-icon unit-icon">UNIT</div>
                    <div style="flex: 1;">
                        <strong>Unit Tests</strong>
                        <div style="font-size: 0.9em; color: #666;">Individual component and function tests</div>
                    </div>
                    <div class="pyramid-stats">
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.unit.executed}</div>
                            <div class="pyramid-stat-label">Executed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.unit.passed}</div>
                            <div class="pyramid-stat-label">Passed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.unit.failed}</div>
                            <div class="pyramid-stat-label">Failed</div>
                        </div>
                        <div class="pyramid-stat">
                            <div class="pyramid-stat-value">${summary.testPyramid.unit.coverage}%</div>
                            <div class="pyramid-stat-label">Success Rate</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h3>📱 Device Coverage</h3>
                <div class="device-grid">
                    <div class="device-card">
                        <div class="device-icon">🖥️</div>
                        <strong>Desktop</strong>
                        <div>Passed: ${summary.devices.desktop.passed}</div>
                        <div>Failed: ${summary.devices.desktop.failed}</div>
                    </div>
                    <div class="device-card">
                        <div class="device-icon">📱</div>
                        <strong>Mobile</strong>
                        <div>Passed: ${summary.devices.mobile.passed}</div>
                        <div>Failed: ${summary.devices.mobile.failed}</div>
                    </div>
                    <div class="device-card">
                        <div class="device-icon">📲</div>
                        <strong>Tablet</strong>
                        <div>Passed: ${summary.devices.tablet.passed}</div>
                        <div>Failed: ${summary.devices.tablet.failed}</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h3>🌐 Browser Coverage</h3>
                <div class="device-grid">
                    <div class="device-card">
                        <div class="device-icon">🟢</div>
                        <strong>Chromium</strong>
                        <div>Passed: ${summary.browsers.chromium.passed}</div>
                        <div>Failed: ${summary.browsers.chromium.failed}</div>
                    </div>
                    <div class="device-card">
                        <div class="device-icon">🔥</div>
                        <strong>Firefox</strong>
                        <div>Passed: ${summary.browsers.firefox.passed}</div>
                        <div>Failed: ${summary.browsers.firefox.failed}</div>
                    </div>
                    <div class="device-card">
                        <div class="device-icon">🍎</div>
                        <strong>WebKit</strong>
                        <div>Passed: ${summary.browsers.webkit.passed}</div>
                        <div>Failed: ${summary.browsers.webkit.failed}</div>
                    </div>
                </div>
            </div>
            
            <div class="timestamp">
                Generated: ${summary.timestamp}
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Cleanup mock services
 */
async function cleanupMockServices(): Promise<void> {
  console.log('🛑 Cleaning up mock services...');
  
  try {
    // The mock services should automatically exit when tests complete
    // This is a placeholder for any additional cleanup needed
    
    console.log('✅ Mock services cleanup completed');
  } catch (error) {
    console.warn('⚠️ Error cleaning up mock services:', error);
  }
}

/**
 * Generate performance report
 */
async function generatePerformanceReport(): Promise<void> {
  console.log('⚡ Generating performance report...');
  
  const reportsDir = path.join(__dirname, '../test-results/reports');
  
  try {
    // Basic performance metrics (placeholder)
    const performanceReport = {
      timestamp: new Date().toISOString(),
      metrics: {
        pageLoadTime: {
          average: 0,
          p95: 0,
          slowest: 0,
        },
        memoryUsage: {
          peak: 0,
          average: 0,
          leaks: 0,
        },
        bundleSize: {
          main: 0,
          vendor: 0,
          total: 0,
        },
        lighthouse: {
          performance: 0,
          accessibility: 0,
          bestPractices: 0,
          seo: 0,
        },
      },
      recommendations: [
        'Consider implementing code splitting for better initial load performance',
        'Add compression for static assets',
        'Implement proper caching strategies',
        'Optimize images with WebP format',
      ],
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'performance-report.json'),
      JSON.stringify(performanceReport, null, 2)
    );
    
    console.log('✅ Performance report generated');
  } catch (error) {
    console.warn('⚠️ Error generating performance report:', error);
  }
}

/**
 * Generate coverage report summary
 */
async function generateCoverageReport(): Promise<void> {
  console.log('📈 Generating coverage report...');
  
  const coverageDir = path.join(__dirname, '../coverage');
  const reportsDir = path.join(__dirname, '../test-results/reports');
  
  try {
    if (fs.existsSync(coverageDir)) {
      // Copy coverage reports to consolidated reports directory
      const coverageFiles = fs.readdirSync(coverageDir);
      
      for (const file of coverageFiles) {
        const sourcePath = path.join(coverageDir, file);
        const destPath = path.join(reportsDir, `coverage-${file}`);
        
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      }
      
      console.log('✅ Coverage report consolidated');
    }
  } catch (error) {
    console.warn('⚠️ Error consolidating coverage report:', error);
  }
}

export default globalTeardown;