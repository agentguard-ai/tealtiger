/**
 * Configuration Unit Tests
 */

import { Configuration, DEFAULT_CONFIG } from '../Configuration';
import { AgentGuardConfigError } from '../../utils/errors';
import { AgentGuardConfig } from '../../types';

describe('Configuration', () => {
  describe('Constructor', () => {
    it('should create configuration with valid config', () => {
      const config: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'test-agent'
      };

      const configuration = new Configuration(config);
      
      expect(configuration.get('apiKey')).toBe('test-api-key');
      expect(configuration.get('ssaUrl')).toBe('https://test-ssa.example.com');
      expect(configuration.get('agentId')).toBe('test-agent');
    });

    it('should merge with default configuration', () => {
      const config: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      };

      const configuration = new Configuration(config);
      
      expect(configuration.get('timeout')).toBe(DEFAULT_CONFIG.timeout);
      expect(configuration.get('retries')).toBe(DEFAULT_CONFIG.retries);
      expect(configuration.get('debug')).toBe(DEFAULT_CONFIG.debug);
    });

    it('should generate agent ID if not provided', () => {
      const config: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      };

      const configuration = new Configuration(config);
      const agentId = configuration.get('agentId');
      
      expect(agentId).toBeDefined();
      expect(agentId).toMatch(/^agent-\d+-[a-z0-9]+$/);
    });

    it('should validate configuration on creation', () => {
      expect(() => {
        new Configuration({
          apiKey: '',
          ssaUrl: 'https://test-ssa.example.com'
        });
      }).toThrow(AgentGuardConfigError);
    });
  });

  describe('get', () => {
    let configuration: Configuration;

    beforeEach(() => {
      configuration = new Configuration({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'test-agent',
        timeout: 10000,
        retries: 5,
        debug: true,
        headers: { 'Custom-Header': 'value' }
      });
    });

    it('should return configuration values', () => {
      expect(configuration.get('apiKey')).toBe('test-api-key');
      expect(configuration.get('ssaUrl')).toBe('https://test-ssa.example.com');
      expect(configuration.get('agentId')).toBe('test-agent');
      expect(configuration.get('timeout')).toBe(10000);
      expect(configuration.get('retries')).toBe(5);
      expect(configuration.get('debug')).toBe(true);
      expect(configuration.get('headers')).toEqual({ 'Custom-Header': 'value' });
    });

    it('should return undefined for non-existent keys', () => {
      expect(configuration.get('nonExistentKey' as any)).toBeUndefined();
    });
  });

  describe('getSafeConfig', () => {
    it('should return configuration without sensitive data', () => {
      const configuration = new Configuration({
        apiKey: 'very-secret-api-key-12345',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'test-agent',
        timeout: 10000,
        debug: true
      });

      const safeConfig = configuration.getSafeConfig();

      expect(safeConfig.apiKey).toBe('very-secre...');
      expect(safeConfig.ssaUrl).toBe('https://test-ssa.example.com');
      expect(safeConfig.agentId).toBe('test-agent');
      expect(safeConfig.timeout).toBe(10000);
      expect(safeConfig.debug).toBe(true);
    });

    it('should handle undefined optional fields', () => {
      const configuration = new Configuration({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      });

      const safeConfig = configuration.getSafeConfig();

      expect(safeConfig.ssaUrl).toBe('https://test-ssa.example.com');
      expect(safeConfig.agentId).toBeDefined(); // Generated agent ID
      expect(safeConfig.timeout).toBeDefined(); // Default value
      expect(safeConfig.retries).toBeDefined(); // Default value
      expect(safeConfig.debug).toBeDefined(); // Default value
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_CONFIG.timeout).toBe(5000);
      expect(DEFAULT_CONFIG.retries).toBe(3);
      expect(DEFAULT_CONFIG.debug).toBe(false);
    });
  });

  describe('Agent ID Generation', () => {
    it('should generate unique agent IDs', () => {
      const config1 = new Configuration({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      });

      const config2 = new Configuration({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      });

      const agentId1 = config1.get('agentId');
      const agentId2 = config2.get('agentId');

      expect(agentId1).not.toBe(agentId2);
      expect(agentId1).toMatch(/^agent-\d+-[a-z0-9]+$/);
      expect(agentId2).toMatch(/^agent-\d+-[a-z0-9]+$/);
    });

    it('should not override provided agent ID', () => {
      const configuration = new Configuration({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'custom-agent-id'
      });

      expect(configuration.get('agentId')).toBe('custom-agent-id');
    });
  });

  describe('Configuration Immutability', () => {
    it('should not allow external modification of internal config', () => {
      const configuration = new Configuration({
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        headers: { 'Custom-Header': 'value' }
      });

      const headers = configuration.get('headers');
      if (headers) {
        headers['Modified-Header'] = 'modified';
      }

      // Original configuration should not be affected
      const originalHeaders = configuration.get('headers');
      expect(originalHeaders).not.toHaveProperty('Modified-Header');
    });
  });
});