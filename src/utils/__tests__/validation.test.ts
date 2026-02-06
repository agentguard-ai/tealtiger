/**
 * Validation Utilities Unit Tests
 */

import {
  validateConfig,
  validateToolName,
  validateToolParameters,
  validateAgentId,
  sanitizeParameters,
  sanitizeConfig
} from '../validation';
import { AgentGuardValidationError, AgentGuardConfigError } from '../errors';
import { AgentGuardConfig } from '../../types';

describe('Validation Utilities', () => {
  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfig: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'test-agent',
        timeout: 5000,
        retries: 3,
        debug: false
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should reject missing API key', () => {
      const invalidConfig = {
        ssaUrl: 'https://test-ssa.example.com'
      } as AgentGuardConfig;

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should reject empty API key', () => {
      const invalidConfig: AgentGuardConfig = {
        apiKey: '',
        ssaUrl: 'https://test-ssa.example.com'
      };

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should reject missing SSA URL', () => {
      const invalidConfig = {
        apiKey: 'test-api-key'
      } as AgentGuardConfig;

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should reject invalid SSA URL', () => {
      const invalidConfig: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'not-a-valid-url'
      };

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should reject non-HTTPS URLs', () => {
      const invalidConfig: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'http://insecure-ssa.example.com'
      };

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should reject invalid timeout values', () => {
      const invalidConfig: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        timeout: -1
      };

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should reject invalid retry values', () => {
      const invalidConfig: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        retries: -1
      };

      expect(() => validateConfig(invalidConfig)).toThrow(AgentGuardConfigError);
    });

    it('should accept valid optional parameters', () => {
      const validConfig: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'custom-agent',
        timeout: 10000,
        retries: 5,
        debug: true,
        headers: { 'Custom-Header': 'value' }
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });
  });

  describe('validateToolName', () => {
    it('should accept valid tool names', () => {
      const validNames = [
        'web-search',
        'file-read',
        'database-query',
        'api-call',
        'system-info',
        'tool_with_underscores',
        'tool123',
        'UPPERCASE-TOOL'
      ];

      validNames.forEach(name => {
        expect(() => validateToolName(name)).not.toThrow();
      });
    });

    it('should reject empty tool names', () => {
      expect(() => validateToolName('')).toThrow(AgentGuardValidationError);
      expect(() => validateToolName('   ')).toThrow(AgentGuardValidationError);
    });

    it('should reject tool names with invalid characters', () => {
      const invalidNames = [
        'tool with spaces',
        'tool@special',
        'tool#hash',
        'tool$dollar',
        'tool%percent',
        'tool&ampersand',
        'tool*asterisk',
        'tool(parenthesis)',
        'tool[bracket]',
        'tool{brace}',
        'tool|pipe',
        'tool\\backslash',
        'tool/slash',
        'tool?question',
        'tool<less>',
        'tool"quote"',
        "tool'apostrophe",
        'tool`backtick',
        'tool~tilde',
        'tool!exclamation',
        'tool+plus',
        'tool=equals'
      ];

      invalidNames.forEach(name => {
        expect(() => validateToolName(name)).toThrow(AgentGuardValidationError);
      });
    });

    it('should reject tool names that are too long', () => {
      const longName = 'a'.repeat(101); // Assuming max length is 100
      expect(() => validateToolName(longName)).toThrow(AgentGuardValidationError);
    });

    it('should reject tool names that start with numbers', () => {
      expect(() => validateToolName('123-tool')).toThrow(AgentGuardValidationError);
    });

    it('should reject tool names with consecutive hyphens or underscores', () => {
      expect(() => validateToolName('tool--name')).toThrow(AgentGuardValidationError);
      expect(() => validateToolName('tool__name')).toThrow(AgentGuardValidationError);
    });
  });

  describe('validateToolParameters', () => {
    it('should accept valid parameter objects', () => {
      const validParameters = [
        {},
        { param1: 'value1' },
        { param1: 'value1', param2: 123 },
        { param1: true, param2: null },
        { nested: { key: 'value' } },
        { array: [1, 2, 3] }
      ];

      validParameters.forEach(params => {
        expect(() => validateToolParameters(params)).not.toThrow();
      });
    });

    it('should reject null parameters', () => {
      expect(() => validateToolParameters(null as any)).toThrow(AgentGuardValidationError);
    });

    it('should reject undefined parameters', () => {
      expect(() => validateToolParameters(undefined as any)).toThrow(AgentGuardValidationError);
    });

    it('should reject non-object parameters', () => {
      const invalidParameters = [
        'string',
        123,
        true,
        [],
        () => {}
      ];

      invalidParameters.forEach(params => {
        expect(() => validateToolParameters(params as any)).toThrow(AgentGuardValidationError);
      });
    });

    it('should reject parameters with function values', () => {
      const invalidParams = {
        validParam: 'value',
        invalidParam: () => console.log('function')
      };

      expect(() => validateToolParameters(invalidParams)).toThrow(AgentGuardValidationError);
    });

    it('should reject parameters with symbol values', () => {
      const invalidParams = {
        validParam: 'value',
        invalidParam: Symbol('symbol')
      };

      expect(() => validateToolParameters(invalidParams)).toThrow(AgentGuardValidationError);
    });
  });

  describe('validateAgentId', () => {
    it('should accept valid agent IDs', () => {
      const validIds = [
        'agent-123',
        'my-agent',
        'agent_with_underscores',
        'AGENT-UPPERCASE',
        'agent123',
        'a',
        'agent-' + 'a'.repeat(50) // Reasonable length
      ];

      validIds.forEach(id => {
        expect(() => validateAgentId(id)).not.toThrow();
      });
    });

    it('should reject empty agent IDs', () => {
      expect(() => validateAgentId('')).toThrow(AgentGuardValidationError);
      expect(() => validateAgentId('   ')).toThrow(AgentGuardValidationError);
    });

    it('should reject agent IDs with invalid characters', () => {
      const invalidIds = [
        'agent with spaces',
        'agent@special',
        'agent#hash',
        'agent$dollar',
        'agent%percent',
        'agent&ampersand',
        'agent*asterisk',
        'agent(parenthesis)',
        'agent[bracket]',
        'agent{brace}',
        'agent|pipe',
        'agent\\backslash',
        'agent/slash',
        'agent?question',
        'agent<less>',
        'agent"quote"',
        "agent'apostrophe",
        'agent`backtick',
        'agent~tilde',
        'agent!exclamation',
        'agent+plus',
        'agent=equals'
      ];

      invalidIds.forEach(id => {
        expect(() => validateAgentId(id)).toThrow(AgentGuardValidationError);
      });
    });

    it('should reject agent IDs that are too long', () => {
      const longId = 'a'.repeat(101); // Assuming max length is 100
      expect(() => validateAgentId(longId)).toThrow(AgentGuardValidationError);
    });
  });

  describe('sanitizeParameters', () => {
    it('should remove sensitive parameters', () => {
      const parameters = {
        username: 'user123',
        password: 'secret123',
        token: 'auth-token',
        apiKey: 'api-key-123',
        secret: 'secret-value',
        key: 'encryption-key',
        credential: 'credential-value',
        normalParam: 'normal-value'
      };

      const sanitized = sanitizeParameters(parameters);

      expect(sanitized).toEqual({
        username: 'user123',
        password: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        secret: '[REDACTED]',
        key: '[REDACTED]',
        credential: '[REDACTED]',
        normalParam: 'normal-value'
      });
    });

    it('should handle nested objects', () => {
      const parameters = {
        config: {
          password: 'secret',
          setting: 'value'
        },
        normalParam: 'value'
      };

      const sanitized = sanitizeParameters(parameters);

      expect(sanitized).toEqual({
        config: {
          password: '[REDACTED]',
          setting: 'value'
        },
        normalParam: 'value'
      });
    });

    it('should handle arrays', () => {
      const parameters = {
        items: [
          { password: 'secret1', name: 'item1' },
          { password: 'secret2', name: 'item2' }
        ]
      };

      const sanitized = sanitizeParameters(parameters);

      expect(sanitized).toEqual({
        items: [
          { password: '[REDACTED]', name: 'item1' },
          { password: '[REDACTED]', name: 'item2' }
        ]
      });
    });

    it('should handle case-insensitive sensitive keys', () => {
      const parameters = {
        PASSWORD: 'secret',
        Token: 'token',
        ApiKey: 'key',
        normalParam: 'value'
      };

      const sanitized = sanitizeParameters(parameters);

      expect(sanitized).toEqual({
        PASSWORD: '[REDACTED]',
        Token: '[REDACTED]',
        ApiKey: '[REDACTED]',
        normalParam: 'value'
      });
    });

    it('should not modify original object', () => {
      const parameters = {
        password: 'secret',
        normalParam: 'value'
      };

      const sanitized = sanitizeParameters(parameters);

      expect(parameters.password).toBe('secret');
      expect(sanitized.password).toBe('[REDACTED]');
    });

    it('should handle null and undefined values', () => {
      const parameters = {
        password: null,
        token: undefined,
        normalParam: 'value'
      };

      const sanitized = sanitizeParameters(parameters);

      expect(sanitized).toEqual({
        password: '[REDACTED]',
        token: '[REDACTED]',
        normalParam: 'value'
      });
    });
  });

  describe('sanitizeConfig', () => {
    it('should sanitize API key in configuration', () => {
      const config: AgentGuardConfig = {
        apiKey: 'very-long-secret-api-key-12345',
        ssaUrl: 'https://test-ssa.example.com',
        agentId: 'test-agent',
        timeout: 5000,
        debug: true
      };

      const sanitized = sanitizeConfig(config);

      expect(sanitized.apiKey).toBe('very-long-...');
      expect(sanitized.ssaUrl).toBe('https://test-ssa.example.com');
      expect(sanitized.agentId).toBe('test-agent');
      expect(sanitized.timeout).toBe(5000);
      expect(sanitized.debug).toBe(true);
    });

    it('should handle short API keys', () => {
      const config: AgentGuardConfig = {
        apiKey: 'short',
        ssaUrl: 'https://test-ssa.example.com'
      };

      const sanitized = sanitizeConfig(config);

      expect(sanitized.apiKey).toBe('short...');
    });

    it('should handle undefined optional fields', () => {
      const config: AgentGuardConfig = {
        apiKey: 'test-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      };

      const sanitized = sanitizeConfig(config);

      expect(sanitized.ssaUrl).toBe('https://test-ssa.example.com');
      expect(sanitized.apiKey).toBe('test-api-k...');
      expect(sanitized.agentId).toBeUndefined();
      expect(sanitized.timeout).toBeUndefined();
      expect(sanitized.retries).toBeUndefined();
      expect(sanitized.debug).toBeUndefined();
    });

    it('should not modify original configuration', () => {
      const config: AgentGuardConfig = {
        apiKey: 'secret-api-key',
        ssaUrl: 'https://test-ssa.example.com'
      };

      const sanitized = sanitizeConfig(config);

      expect(config.apiKey).toBe('secret-api-key');
      expect(sanitized.apiKey).toBe('secret-ap...');
    });
  });
});