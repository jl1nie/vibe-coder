import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    return res.status(200).json({
      success: true,
      message: 'Session endpoint working'
    });
  } catch (error) {
    console.error('Session handling error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}