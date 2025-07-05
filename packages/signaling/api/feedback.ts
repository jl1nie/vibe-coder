/**
 * Feedback Collection API
 * Collects and processes user feedback for UX improvements
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface FeedbackData {
  sessionId: string;
  type: 'bug' | 'feature' | 'improvement' | 'other';
  message: string;
  rating?: number;
  metadata?: {
    userAgent?: string;
    url?: string;
    timestamp?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const feedback: FeedbackData = req.body;

    // Validate feedback data
    if (!feedback.message || !feedback.type || !feedback.sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store feedback in KV with TTL of 90 days
    const feedbackId = `feedback:${Date.now()}:${feedback.sessionId}`;
    await kv.setex(feedbackId, 90 * 24 * 60 * 60, JSON.stringify(feedback));

    // Update analytics counter
    const today = new Date().toISOString().split('T')[0];
    await kv.incr(`feedback:count:${today}`);
    await kv.incr(`feedback:type:${feedback.type}:${today}`);

    return res.status(200).json({ 
      success: true, 
      feedbackId: feedbackId.split(':')[1]
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return res.status(500).json({ error: 'Failed to store feedback' });
  }
}