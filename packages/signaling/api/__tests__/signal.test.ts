import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import handler from '../signal';

describe('Signal API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HTTP Method Validation', () => {
    it('should reject non-POST requests', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'GET'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Request Validation', () => {
    it('should reject invalid request format', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request format');
    });

    it('should reject offer without offer data', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'offer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Offer data required');
    });

    it('should reject answer without answer data', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'answer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Answer data required');
    });
  });

  describe('Session Management', () => {
    it('should create session successfully', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'create-session',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session created successfully');
    });
  });

  describe('Offer/Answer Exchange', () => {
    it('should store offer successfully', async () => {
      const offerData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      };

      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'offer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          offer: offerData
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Offer stored successfully');
    });

    it('should retrieve stored offer', async () => {
      // First store an offer
      const offerData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      };

      const storeReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'offer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          offer: offerData
        })
      });

      await handler(storeReq);

      // Then retrieve it
      const getReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get-offer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(getReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.offer).toEqual(offerData);
    });

    it('should store answer successfully', async () => {
      // First store an offer
      const offerData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      };

      const storeOfferReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'offer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          offer: offerData
        })
      });

      await handler(storeOfferReq);

      // Then store an answer
      const answerData = {
        type: 'answer',
        sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      };

      const storeAnswerReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'answer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          answer: answerData
        })
      });

      const response = await handler(storeAnswerReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Answer stored successfully');
    });

    it('should retrieve stored answer', async () => {
      // First store an offer and answer
      const offerData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      };

      const answerData = {
        type: 'answer',
        sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      };

      const storeOfferReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'offer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          offer: offerData
        })
      });

      const storeAnswerReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'answer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          answer: answerData
        })
      });

      await handler(storeOfferReq);
      await handler(storeAnswerReq);

      // Then retrieve the answer
      const getAnswerReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get-answer',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(getAnswerReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.answer).toEqual(answerData);
    });
  });

  describe('ICE Candidate Exchange', () => {
    it('should store and retrieve host candidates', async () => {
      // First create session and offer
      const createReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'create-session',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });
      await handler(createReq);

      // Store host candidate
      const candidateReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'candidate',
          sessionId: 'TEST1234',
          hostId: 'HOST5678',
          candidate: { candidate: 'candidate:1 1 UDP 2122252543 192.168.1.1 54400 typ host' }
        })
      });

      const storeResponse = await handler(candidateReq);
      expect(storeResponse.status).toBe(200);

      // Retrieve candidates from client perspective
      const getReq = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get-candidate',
          sessionId: 'TEST1234',
          hostId: 'CLIENT9999'
        })
      });

      const getResponse = await handler(getReq);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.candidates).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent session offer', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get-offer',
          sessionId: 'NONEXISTENT',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Offer not found');
    });

    it('should return 404 for non-existent session answer', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get-answer',
          sessionId: 'NONEXISTENT',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Answer not found');
    });

    it('should return 404 for answer without existing session', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'answer',
          sessionId: 'NONEXISTENT',
          hostId: 'HOST5678',
          answer: { type: 'answer', sdp: 'test' }
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Session not found');
    });

    it('should return 400 for unknown signal type', async () => {
      const req = new NextRequest('http://localhost/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          type: 'unknown',
          sessionId: 'TEST1234',
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request format');
    });
  });
});