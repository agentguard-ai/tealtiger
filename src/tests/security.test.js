/**
 * Security API Tests
 */

const request = require('supertest');
const app = require('../app');

describe('Security API', () => {
  const validApiKey = 'test-api-key-12345';
  
  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('AI Agent Security Platform');
    });
  });

  describe('Security Evaluation', () => {
    test('POST /api/security/evaluate should require API key', async () => {
      const response = await request(app)
        .post('/api/security/evaluate')
        .send({
          agentId: 'test-agent',
          toolName: 'web-search',
          parameters: { query: 'test' }
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_API_KEY');
    });

    test('POST /api/security/evaluate should validate request body', async () => {
      const response = await request(app)
        .post('/api/security/evaluate')
        .set('X-API-Key', validApiKey)
        .send({
          // Missing required fields
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/security/evaluate should allow safe operations', async () => {
      const response = await request(app)
        .post('/api/security/evaluate')
        .set('X-API-Key', validApiKey)
        .send({
          agentId: 'test-agent',
          toolName: 'web-search',
          parameters: { query: 'AI security best practices' }
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.decision.action).toBe('allow');
      expect(response.body.decision.agentId).toBe('test-agent');
    });

    test('POST /api/security/evaluate should deny critical operations', async () => {
      const response = await request(app)
        .post('/api/security/evaluate')
        .set('X-API-Key', validApiKey)
        .send({
          agentId: 'test-agent',
          toolName: 'system-command',
          parameters: { command: 'rm -rf /' }
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.decision.action).toBe('deny');
      expect(response.body.decision.reason).toContain('system');
    });

    test('POST /api/security/evaluate should transform write operations', async () => {
      const response = await request(app)
        .post('/api/security/evaluate')
        .set('X-API-Key', validApiKey)
        .send({
          agentId: 'test-agent',
          toolName: 'file-write',
          parameters: { path: '/tmp/test.txt', content: 'test' }
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.decision.action).toBe('transform');
      expect(response.body.decision.transformedRequest).toBeDefined();
    });
  });

  describe('Policy Management', () => {
    test('GET /api/security/policies should return current policies', async () => {
      const response = await request(app)
        .get('/api/security/policies')
        .set('X-API-Key', validApiKey)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.policies.policies).toBeInstanceOf(Array);
      expect(response.body.policies.policies.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Trail', () => {
    test('GET /api/security/audit/:agentId should return audit logs', async () => {
      // First make a request to generate audit logs
      await request(app)
        .post('/api/security/evaluate')
        .set('X-API-Key', validApiKey)
        .send({
          agentId: 'audit-test-agent',
          toolName: 'web-search',
          parameters: { query: 'test' }
        });

      // Then check audit logs
      const response = await request(app)
        .get('/api/security/audit/audit-test-agent')
        .set('X-API-Key', validApiKey)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.auditTrail.entries).toBeInstanceOf(Array);
    });
  });
});