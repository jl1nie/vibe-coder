import { useRef, useCallback, useEffect } from 'react';

export interface SwipeGestureConfig {
  threshold?: number; // スワイプ検出のしきい値（px）
  velocity?: number;  // 速度のしきい値（px/ms）
  restraint?: number; // 垂直方向の制約（px）
  allowedTime?: number; // 最大スワイプ時間（ms）
}

export interface SwipeGestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeStart?: (startX: number, startY: number) => void;
  onSwipeMove?: (deltaX: number, deltaY: number, currentX: number, currentY: number) => void;
  onSwipeEnd?: () => void;
}

interface TouchData {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isActive: boolean;
}

export function useSwipeGesture(
  handlers: SwipeGestureHandlers,
  config: SwipeGestureConfig = {}
) {
  const {
    threshold = 50,
    velocity = 0.3,
    restraint = 100,
    allowedTime = 300,
  } = config;

  const touchDataRef = useRef<TouchData>({
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    isActive: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    const touchData = touchDataRef.current;
    touchData.startX = touch.clientX;
    touchData.startY = touch.clientY;
    touchData.currentX = touch.clientX;
    touchData.currentY = touch.clientY;
    touchData.startTime = Date.now();
    touchData.isActive = true;

    handlers.onSwipeStart?.(touchData.startX, touchData.startY);
  }, [handlers.onSwipeStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchDataRef.current.isActive) return;

    const touch = e.touches[0];
    if (!touch) return;

    const touchData = touchDataRef.current;
    touchData.currentX = touch.clientX;
    touchData.currentY = touch.clientY;

    const deltaX = touchData.currentX - touchData.startX;
    const deltaY = touchData.currentY - touchData.startY;

    handlers.onSwipeMove?.(deltaX, deltaY, touchData.currentX, touchData.currentY);
  }, [handlers.onSwipeMove]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touchData = touchDataRef.current;
    if (!touchData.isActive) return;

    touchData.isActive = false;

    const deltaX = touchData.currentX - touchData.startX;
    const deltaY = touchData.currentY - touchData.startY;
    const deltaTime = Date.now() - touchData.startTime;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 速度計算
    const velocityX = absX / deltaTime;
    const velocityY = absY / deltaTime;

    // スワイプ判定
    if (deltaTime <= allowedTime) {
      // 水平スワイプ
      if (absX >= threshold && absY <= restraint && velocityX >= velocity) {
        if (deltaX < 0) {
          handlers.onSwipeLeft?.();
        } else {
          handlers.onSwipeRight?.();
        }
      }
      // 垂直スワイプ
      else if (absY >= threshold && absX <= restraint && velocityY >= velocity) {
        if (deltaY < 0) {
          handlers.onSwipeUp?.();
        } else {
          handlers.onSwipeDown?.();
        }
      }
    }

    handlers.onSwipeEnd?.();
  }, [handlers, threshold, velocity, restraint, allowedTime]);

  const elementRef = useRef<HTMLElement | null>(null);

  const attachToElement = useCallback((element: HTMLElement | null) => {
    if (elementRef.current) {
      elementRef.current.removeEventListener('touchstart', handleTouchStart);
      elementRef.current.removeEventListener('touchmove', handleTouchMove);
      elementRef.current.removeEventListener('touchend', handleTouchEnd);
    }

    elementRef.current = element;

    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: false });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd, { passive: false });
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    return () => {
      if (elementRef.current) {
        elementRef.current.removeEventListener('touchstart', handleTouchStart);
        elementRef.current.removeEventListener('touchmove', handleTouchMove);
        elementRef.current.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    attachToElement,
    touchData: touchDataRef.current,
  };
}