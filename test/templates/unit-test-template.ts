/**
 * Unit Test Template for Vibe Coder
 * Test Pyramid Level: Unit (90%+ coverage target)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// === Component Test Template ===
describe('ComponentName', () => {
  // Setup & Teardown
  beforeEach(() => {
    // Reset mocks, clear localStorage, etc.
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  // === Basic Functionality ===
  describe('基本機能', () => {
    it('正常な初期化ができる', () => {
      // Arrange (準備)
      const mockProps = {};
      
      // Act (実行)
      const result = functionUnderTest(mockProps);
      
      // Assert (検証)
      expect(result).toBeDefined();
    });

    it('正常な入力で期待される出力を返す', () => {
      // Arrange
      const input = { validInput: true };
      const expectedOutput = { success: true };
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });

  // === Error Handling ===
  describe('エラーハンドリング', () => {
    it('無効な入力でエラーをスローする', () => {
      // Arrange
      const invalidInput = null;
      
      // Act & Assert
      expect(() => functionUnderTest(invalidInput))
        .toThrow('Invalid input');
    });

    it('ネットワークエラー時に適切にハンドリングする', async () => {
      // Arrange
      const networkError = new Error('Network failed');
      vi.mocked(fetchMock).mockRejectedValue(networkError);
      
      // Act
      const result = await asyncFunctionUnderTest();
      
      // Assert
      expect(result.error).toBe('Network failed');
    });
  });

  // === Edge Cases ===
  describe('エッジケース', () => {
    it('空の配列を処理できる', () => {
      // Arrange
      const emptyArray = [];
      
      // Act
      const result = processArray(emptyArray);
      
      // Assert
      expect(result).toEqual([]);
    });

    it('大量のデータを処理できる', () => {
      // Arrange
      const largeDataset = new Array(10000).fill({ data: 'test' });
      
      // Act
      const startTime = performance.now();
      const result = processLargeData(largeDataset);
      const endTime = performance.now();
      
      // Assert
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });
  });

  // === Performance ===
  describe('パフォーマンス', () => {
    it('処理時間が許容範囲内である', () => {
      // Arrange
      const testData = generateTestData(1000);
      
      // Act
      const start = performance.now();
      const result = performanceFunction(testData);
      const duration = performance.now() - start;
      
      // Assert
      expect(duration).toBeLessThan(100); // 100ms以内
      expect(result).toBeDefined();
    });
  });

  // === Integration Points ===
  describe('統合ポイント', () => {
    it('外部APIとの統合が正常に動作する', async () => {
      // Arrange
      const mockApiResponse = { status: 'success', data: {} };
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse);
      
      // Act
      const result = await integrateWithExternalAPI();
      
      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/api/endpoint');
      expect(result).toEqual(mockApiResponse.data);
    });
  });
});

// === Utility Functions for Tests ===
function generateTestData(size: number): any[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `Test Item ${i}`,
    value: Math.random() * 100,
  }));
}

function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: T
): vi.MockedFunction<T> {
  return vi.fn(implementation) as vi.MockedFunction<T>;
}

// === React Component Test Template ===
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ReactComponent', () => {
  const defaultProps = {
    title: 'Test Title',
    onAction: vi.fn(),
  };

  it('正しくレンダリングされる', () => {
    // Arrange & Act
    render(<ComponentUnderTest {...defaultProps} />);
    
    // Assert
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('ユーザー操作に正しく反応する', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockOnAction = vi.fn();
    render(<ComponentUnderTest {...defaultProps} onAction={mockOnAction} />);
    
    // Act
    await user.click(screen.getByRole('button', { name: /action/i }));
    
    // Assert
    expect(mockOnAction).toHaveBeenCalledTimes(1);
  });

  it('アクセシビリティ要件を満たす', () => {
    // Arrange & Act
    render(<ComponentUnderTest {...defaultProps} />);
    
    // Assert
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
    expect(button).toHaveAttribute('tabIndex', '0');
  });

  it('キーボードナビゲーションが動作する', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ComponentUnderTest {...defaultProps} />);
    
    // Act
    await user.tab();
    await user.keyboard('{Enter}');
    
    // Assert
    expect(defaultProps.onAction).toHaveBeenCalled();
  });
});

// === API Test Template ===
describe('API Function', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('成功レスポンスを正しく処理する', async () => {
    // Arrange
    const mockResponse = { success: true, data: { id: 1 } };
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
    
    // Act
    const result = await apiFunction('/api/test');
    
    // Assert
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    expect(result).toEqual(mockResponse);
  });

  it('エラーレスポンスを適切にハンドリングする', async () => {
    // Arrange
    fetchMock.mockRejectOnce(new Error('API Error'));
    
    // Act & Assert
    await expect(apiFunction('/api/test')).rejects.toThrow('API Error');
  });

  it('レート制限に適切に対応する', async () => {
    // Arrange
    fetchMock.mockResponseOnce('', { status: 429 });
    
    // Act
    const result = await apiFunction('/api/test');
    
    // Assert
    expect(result.error).toBe('Rate limit exceeded');
  });
});

// === Service Test Template ===
describe('Service Class', () => {
  let service: ServiceClass;

  beforeEach(() => {
    service = new ServiceClass({
      apiUrl: 'http://test.example.com',
      timeout: 5000,
    });
  });

  describe('初期化', () => {
    it('正しい設定で初期化される', () => {
      expect(service).toBeInstanceOf(ServiceClass);
      expect(service.config.apiUrl).toBe('http://test.example.com');
    });
  });

  describe('メソッド', () => {
    it('データを正しく取得する', async () => {
      // Arrange
      const mockData = { items: [1, 2, 3] };
      vi.spyOn(service, 'fetchData').mockResolvedValue(mockData);
      
      // Act
      const result = await service.getData();
      
      // Assert
      expect(result).toEqual(mockData);
      expect(service.fetchData).toHaveBeenCalledTimes(1);
    });
  });
});

export { generateTestData, createMockFunction };