/**
 * UX Feedback Collection Widget
 * Collects user feedback for continuous improvement
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  rating: number;
  message: string;
  page: string;
  userAgent: string;
  timestamp: number;
  sessionId: string;
}

interface FeedbackWidgetProps {
  isEnabled?: boolean;
  environment?: 'staging' | 'production';
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ 
  isEnabled = false,
  environment = 'production'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackData['type']>('general');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  // Only show in staging or when explicitly enabled
  const shouldShow = environment === 'staging' || isEnabled;

  useEffect(() => {
    // Auto-show feedback widget after 30 seconds in staging
    if (environment === 'staging') {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [environment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      type: feedbackType,
      rating,
      message,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId,
    };

    try {
      // Send to feedback API
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...feedbackData,
          environment,
          url: window.location.href,
        }),
      });

      // Also send to analytics if available
      if (typeof gtag === 'function') {
        gtag('event', 'feedback_submitted', {
          feedback_type: feedbackType,
          rating,
          environment,
        });
      }

      setIsSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setMessage('');
        setRating(5);
      }, 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* Feedback Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={clsx(
            'fixed bottom-4 right-4 z-50',
            'bg-blue-600 hover:bg-blue-700 text-white',
            'rounded-full p-4 shadow-lg',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            environment === 'staging' && 'bg-orange-600 hover:bg-orange-700'
          )}
          aria-label="フィードバックを送信"
        >
          {environment === 'staging' && (
            <div className="absolute -top-2 -left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              STAGING
            </div>
          )}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {environment === 'staging' ? '🧪 ステージング環境フィードバック' : '📝 フィードバック'}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="閉じる"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="text-green-600 text-4xl mb-4">✅</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  フィードバックありがとうございます！
                </h4>
                <p className="text-gray-600">
                  頂いたご意見は開発チームが確認し、改善に活用させていただきます。
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Feedback Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    フィードバックの種類
                  </label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value as FeedbackData['type'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">一般的なフィードバック</option>
                    <option value="bug">バグ報告</option>
                    <option value="feature">新機能の提案</option>
                    <option value="improvement">改善提案</option>
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    総合評価
                  </label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={clsx(
                          'text-2xl transition-colors',
                          star <= rating ? 'text-yellow-400' : 'text-gray-300'
                        )}
                        aria-label={`${star}星`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    詳細なフィードバック
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      feedbackType === 'bug'
                        ? '問題の詳細と再現手順をお教えください...'
                        : feedbackType === 'feature'
                        ? 'どのような機能があると便利でしょうか？'
                        : 'ご意見やご感想をお聞かせください...'
                    }
                    required
                  />
                </div>

                {environment === 'staging' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <p className="text-sm text-orange-800">
                      🧪 これはテスト環境です。実際の開発中の機能をお試しいただき、
                      使い心地や問題点についてフィードバックをお願いします。
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !message.trim()}
                    className={clsx(
                      'flex-1 px-4 py-2 rounded-md text-white font-medium',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      isSubmitting || !message.trim()
                        ? 'bg-gray-400 cursor-not-allowed'
                        : environment === 'staging'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    )}
                  >
                    {isSubmitting ? '送信中...' : 'フィードバックを送信'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Hook for collecting user behavior analytics
export const useUserBehaviorTracking = (environment: string) => {
  useEffect(() => {
    if (environment !== 'staging') return;

    // Track user interactions for UX analysis
    const trackInteraction = (event: Event) => {
      const target = event.target as HTMLElement;
      const data = {
        type: event.type,
        element: target.tagName,
        className: target.className,
        timestamp: Date.now(),
        page: window.location.pathname,
      };

      // Send to analytics endpoint
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {}); // Fail silently
    };

    // Track clicks on buttons and links
    document.addEventListener('click', trackInteraction);
    
    // Track form submissions
    document.addEventListener('submit', trackInteraction);

    // Track focus events for accessibility analysis
    document.addEventListener('focus', trackInteraction, true);

    return () => {
      document.removeEventListener('click', trackInteraction);
      document.removeEventListener('submit', trackInteraction);
      document.removeEventListener('focus', trackInteraction, true);
    };
  }, [environment]);
};