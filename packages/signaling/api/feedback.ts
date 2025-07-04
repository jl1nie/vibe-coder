/**
 * Feedback Collection API
 * Collects and processes user feedback for UX improvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  rating: number;
  message: string;
  page: string;
  userAgent: string;
  timestamp: number;
  sessionId: string;
  environment: 'staging' | 'production';
  url: string;
}

interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  feedbackByType: Record<string, number>;
  feedbackByPage: Record<string, number>;
  recentFeedback: FeedbackData[];
  trends: {
    daily: Record<string, number>;
    weekly: Record<string, number>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const feedback: FeedbackData = await request.json();

    // Validate feedback data
    if (!feedback.message || !feedback.type || !feedback.sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Store feedback in KV with TTL of 90 days
    const feedbackId = `feedback:${Date.now()}:${feedback.sessionId}`;
    await kv.setex(feedbackId, 90 * 24 * 60 * 60, JSON.stringify(feedback));

    // Update analytics
    await updateFeedbackAnalytics(feedback);

    // Send to external services if configured
    await Promise.allSettled([
      sendToSlack(feedback),
      sendToSentry(feedback),
      sendToGitHubIssue(feedback),
    ]);

    return NextResponse.json({ 
      success: true, 
      feedbackId: feedbackId.split(':')[1] 
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const environment = searchParams.get('environment') || 'production';

    // Get analytics data
    const analytics = await getFeedbackAnalytics(environment);

    // Filter by type if specified
    let recentFeedback = analytics.recentFeedback;
    if (type) {
      recentFeedback = recentFeedback.filter(f => f.type === type);
    }

    // Limit results
    recentFeedback = recentFeedback.slice(0, limit);

    return NextResponse.json({
      analytics: {
        ...analytics,
        recentFeedback,
      },
    });

  } catch (error) {
    console.error('Feedback analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function updateFeedbackAnalytics(feedback: FeedbackData) {
  const analyticsKey = `analytics:feedback:${feedback.environment}`;
  
  try {
    // Get current analytics
    const current = await kv.get<FeedbackAnalytics>(analyticsKey) || {
      totalFeedback: 0,
      averageRating: 0,
      feedbackByType: {},
      feedbackByPage: {},
      recentFeedback: [],
      trends: { daily: {}, weekly: {} },
    };

    // Update totals
    current.totalFeedback += 1;
    current.averageRating = (current.averageRating * (current.totalFeedback - 1) + feedback.rating) / current.totalFeedback;

    // Update by type
    current.feedbackByType[feedback.type] = (current.feedbackByType[feedback.type] || 0) + 1;

    // Update by page
    current.feedbackByPage[feedback.page] = (current.feedbackByPage[feedback.page] || 0) + 1;

    // Add to recent feedback (keep last 100)
    current.recentFeedback.unshift(feedback);
    current.recentFeedback = current.recentFeedback.slice(0, 100);

    // Update trends
    const today = new Date().toISOString().split('T')[0];
    const thisWeek = getWeekKey(new Date());
    
    current.trends.daily[today] = (current.trends.daily[today] || 0) + 1;
    current.trends.weekly[thisWeek] = (current.trends.weekly[thisWeek] || 0) + 1;

    // Store updated analytics
    await kv.setex(analyticsKey, 30 * 24 * 60 * 60, JSON.stringify(current));

  } catch (error) {
    console.error('Failed to update analytics:', error);
  }
}

async function getFeedbackAnalytics(environment: string): Promise<FeedbackAnalytics> {
  const analyticsKey = `analytics:feedback:${environment}`;
  
  const analytics = await kv.get<FeedbackAnalytics>(analyticsKey);
  
  return analytics || {
    totalFeedback: 0,
    averageRating: 0,
    feedbackByType: {},
    feedbackByPage: {},
    recentFeedback: [],
    trends: { daily: {}, weekly: {} },
  };
}

async function sendToSlack(feedback: FeedbackData) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const color = feedback.type === 'bug' ? 'danger' : 
               feedback.type === 'feature' ? 'good' : 
               'warning';

  const emoji = feedback.type === 'bug' ? '🐛' : 
                feedback.type === 'feature' ? '💡' : 
                feedback.type === 'improvement' ? '⚡' : '💬';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `${emoji} New Feedback - ${feedback.type}`,
          fields: [
            { title: 'Rating', value: '⭐'.repeat(feedback.rating), short: true },
            { title: 'Environment', value: feedback.environment, short: true },
            { title: 'Page', value: feedback.page, short: true },
            { title: 'Session', value: feedback.sessionId.slice(0, 8), short: true },
            { title: 'Message', value: feedback.message, short: false },
          ],
          footer: 'Vibe Coder Feedback',
          ts: Math.floor(feedback.timestamp / 1000),
        }],
      }),
    });
  } catch (error) {
    console.error('Failed to send to Slack:', error);
  }
}

async function sendToSentry(feedback: FeedbackData) {
  if (feedback.type !== 'bug') return;

  try {
    // Send bug reports to Sentry for tracking
    const sentryDsn = feedback.environment === 'staging' 
      ? process.env.STAGING_SENTRY_DSN 
      : process.env.PRODUCTION_SENTRY_DSN;

    if (!sentryDsn) return;

    // Create Sentry event
    const event = {
      message: `User reported bug: ${feedback.message}`,
      level: 'warning',
      tags: {
        source: 'user_feedback',
        environment: feedback.environment,
        page: feedback.page,
      },
      user: {
        id: feedback.sessionId,
      },
      extra: {
        rating: feedback.rating,
        userAgent: feedback.userAgent,
        url: feedback.url,
      },
    };

    // Send to Sentry (simplified - in real implementation use Sentry SDK)
    console.log('Sentry event:', event);

  } catch (error) {
    console.error('Failed to send to Sentry:', error);
  }
}

async function sendToGitHubIssue(feedback: FeedbackData) {
  if (feedback.environment !== 'staging' || feedback.type === 'general') return;

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return;

  try {
    const title = `[${feedback.type.toUpperCase()}] ${feedback.message.slice(0, 50)}...`;
    const body = `
## Feedback Details

**Type**: ${feedback.type}
**Rating**: ${'⭐'.repeat(feedback.rating)}
**Environment**: ${feedback.environment}
**Page**: ${feedback.page}
**Timestamp**: ${new Date(feedback.timestamp).toISOString()}

## User Message

${feedback.message}

## Technical Details

- **Session ID**: ${feedback.sessionId}
- **User Agent**: ${feedback.userAgent}
- **URL**: ${feedback.url}

---

*This issue was automatically created from user feedback collected in the staging environment.*
`;

    const labels = ['feedback', `feedback:${feedback.type}`, 'staging'];
    if (feedback.type === 'bug') {
      labels.push('bug');
    } else if (feedback.type === 'feature') {
      labels.push('enhancement');
    }

    await fetch('https://api.github.com/repos/vibe-coder/vibe-coder/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels,
      }),
    });

  } catch (error) {
    console.error('Failed to create GitHub issue:', error);
  }
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${week.toString().padStart(2, '0')}`;
}