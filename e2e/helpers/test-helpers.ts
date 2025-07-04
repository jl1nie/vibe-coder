/**
 * E2E Test Helper Functions
 * Common utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test';

/**
 * 테스트 서버에 연결하는 헬퍼 함수
 */
export async function connectToTestServer(page: Page, serverId: string = 'TEST-SERVER-123'): Promise<void> {
  // 연결 페이지로 이동
  await page.getByRole('button', { name: /connect/i }).click();
  
  // 서버 ID 입력
  const serverIdInput = page.getByPlaceholder(/server id/i);
  await serverIdInput.fill(serverId);
  
  // 연결 버튼 클릭
  await page.getByRole('button', { name: /connect/i }).click();
  
  // 연결 완료 대기
  await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 15000 });
}

/**
 * 명령어 실행 헬퍼 함수
 */
export async function executeCommand(page: Page, command: string): Promise<void> {
  const commandInput = page.getByPlaceholder(/enter command/i);
  await commandInput.fill(command);
  await page.keyboard.press('Enter');
  
  // 명령어 실행 시작 확인
  await expect(page.getByText(/executing/i)).toBeVisible({ timeout: 2000 });
}

/**
 * 음성 입력 시뮬레이션 헬퍼 함수
 */
export async function simulateVoiceInput(page: Page, text: string): Promise<void> {
  // 실제 테스트에서는 Web Speech API와 상호작용
  // 여기서는 커스텀 이벤트로 시뮬레이션
  await page.evaluate((text) => {
    const event = new CustomEvent('speechresult', { 
      detail: { text, confidence: 0.95 } 
    });
    window.dispatchEvent(event);
  }, text);
  
  // 음성 인식 결과가 표시될 때까지 대기
  await page.waitForTimeout(500);
}

/**
 * 테스트 파일 생성 헬퍼 함수
 */
export async function createTestFile(page: Page, filename: string = 'test-file.js'): Promise<void> {
  await executeCommand(page, `create a test file called ${filename}`);
  await expect(page.getByText(new RegExp(`${filename}.*created`, 'i'))).toBeVisible({ timeout: 15000 });
}

/**
 * 터미널에 대량의 콘텐츠 생성
 */
export async function fillTerminalWithContent(page: Page, lines: number = 50): Promise<void> {
  for (let i = 0; i < lines; i++) {
    await executeCommand(page, `echo "Terminal content line ${i + 1}"`);
  }
  // 모든 콘텐츠가 렌더링될 때까지 대기
  await page.waitForTimeout(1000);
}

/**
 * 플레이리스트 검색 및 선택
 */
export async function searchAndSelectPlaylist(page: Page, searchTerm: string, playlistName: string): Promise<void> {
  // 플레이리스트 페이지로 이동
  await page.getByRole('button', { name: /menu/i }).click();
  await page.getByRole('menuitem', { name: /playlists/i }).click();
  
  // 검색
  const searchInput = page.getByPlaceholder(/search playlists/i);
  await searchInput.fill(searchTerm);
  await page.keyboard.press('Enter');
  
  // 결과 대기
  await expect(page.getByText(new RegExp(playlistName, 'i'))).toBeVisible({ timeout: 5000 });
}

/**
 * 에러 상태 확인
 */
export async function expectErrorState(page: Page, errorMessage: string): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText(new RegExp(errorMessage, 'i'))).toBeVisible();
}

/**
 * 로딩 상태 확인
 */
export async function expectLoadingState(page: Page, loadingText: string = 'loading'): Promise<void> {
  await expect(page.getByText(new RegExp(loadingText, 'i'))).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
}

/**
 * 성공 상태 확인
 */
export async function expectSuccessState(page: Page, successMessage: string): Promise<void> {
  await expect(page.getByText(new RegExp(successMessage, 'i'))).toBeVisible();
  
  // 성공 아이콘 확인
  const successIcon = page.getByTestId('success-icon');
  if (await successIcon.isVisible()) {
    await expect(successIcon).toBeVisible();
  }
}

/**
 * 네트워크 지연 시뮬레이션
 */
export async function simulateNetworkDelay(page: Page, delayMs: number = 100): Promise<void> {
  await page.route('**/*', async route => {
    await page.waitForTimeout(delayMs);
    await route.continue();
  });
}

/**
 * 네트워크 장애 시뮬레이션
 */
export async function simulateNetworkFailure(page: Page): Promise<void> {
  await page.route('**/*', route => route.abort('internetdisconnected'));
}

/**
 * 네트워크 복구
 */
export async function restoreNetwork(page: Page): Promise<void> {
  await page.unroute('**/*');
}

/**
 * 모바일 뷰포트 설정
 */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 667 });
}

/**
 * 태블릿 뷰포트 설정
 */
export async function setTabletViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 768, height: 1024 });
}

/**
 * 데스크톱 뷰포트 설정
 */
export async function setDesktopViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
}

/**
 * 터치 이벤트 시뮬레이션
 */
export async function simulateTouch(page: Page, selector: string, action: 'tap' | 'longpress' = 'tap'): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });
  
  if (action === 'tap') {
    await element.tap();
  } else if (action === 'longpress') {
    await element.hover();
    await page.mouse.down();
    await page.waitForTimeout(800); // 장압 시간
    await page.mouse.up();
  }
}

/**
 * 스와이프 제스처 시뮬레이션
 */
export async function simulateSwipe(
  page: Page, 
  startX: number, 
  startY: number, 
  endX: number, 
  endY: number
): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

/**
 * PWA 설치 프롬프트 확인
 */
export async function checkPWAInstallPrompt(page: Page): Promise<void> {
  // PWA 설치 가능 상태 확인
  const installButton = page.getByRole('button', { name: /install/i });
  
  if (await installButton.isVisible()) {
    await expect(installButton).toBeVisible();
  }
}

/**
 * Service Worker 등록 확인
 */
export async function checkServiceWorkerRegistration(page: Page): Promise<void> {
  const swRegistered = await page.evaluate(() => {
    return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
  });
  
  expect(swRegistered).toBeTruthy();
}

/**
 * 오프라인 상태 시뮬레이션
 */
export async function simulateOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
  await expect(page.getByText(/offline/i)).toBeVisible({ timeout: 5000 });
}

/**
 * 온라인 상태 복구
 */
export async function restoreOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  await expect(page.getByText(/online/i)).toBeVisible({ timeout: 5000 });
}

/**
 * 성능 측정 헬퍼
 */
export async function measurePageLoadTime(page: Page, url: string): Promise<number> {
  const startTime = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const endTime = Date.now();
  
  return endTime - startTime;
}

/**
 * 메모리 사용량 확인
 */
export async function checkMemoryUsage(page: Page): Promise<number> {
  const memoryInfo = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize || 0;
  });
  
  return memoryInfo;
}

/**
 * 접근성 검사
 */
export async function checkAccessibility(page: Page): Promise<void> {
  // 기본 접근성 체크
  await expect(page.getByRole('main')).toBeVisible();
  
  // 키보드 네비게이션 체크
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(focusedElement).toBeTruthy();
}

/**
 * 다크 모드 토글
 */
export async function toggleDarkMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: /dark mode/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
}

/**
 * 테스트 데이터 정리
 */
export async function cleanupTestData(page: Page): Promise<void> {
  // 로컬 스토리지 정리
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // 쿠키 정리
  await page.context().clearCookies();
}

/**
 * 테스트 환경 설정
 */
export async function setupTestEnvironment(page: Page): Promise<void> {
  // 테스트용 환경 변수 설정
  await page.addInitScript(() => {
    window.TEST_MODE = true;
    window.MOCK_SPEECH_RECOGNITION = true;
    window.MOCK_WEBRTC = true;
  });
}

/**
 * 콘솔 에러 수집
 */
export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  return errors;
}

/**
 * 스크린샷 비교
 */
export async function compareScreenshot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`);
}

/**
 * 반응형 테스트 헬퍼
 */
export async function testResponsiveDesign(page: Page): Promise<void> {
  const viewports = [
    { width: 320, height: 568 },  // iPhone SE
    { width: 375, height: 667 },  // iPhone 8
    { width: 768, height: 1024 }, // iPad
    { width: 1920, height: 1080 } // Desktop
  ];
  
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    
    // 각 뷰포트에서 기본 요소들이 표시되는지 확인
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  }
}