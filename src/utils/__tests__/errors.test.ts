/**
 * Error Classes Unit Tests
 */

import {
  BaseAgentGuardError,
  AgentGuardConfigError,
  AgentGuardNetworkError,
  AgentGuardServerError,
  AgentGuardSecurityError,
  AgentGuardValidationError,
  AgentGuardAuthError,
  createAgentGuardError,
  isAgentGuardError,
  getErrorDetails
} from '../errors';
import { AgentGuardErrorCode } from '../../types';

describe('Error Classes', () => {
  describe('BaseAgentGuardError', () => {
    it('should create error with required properties', () => {
      const error = new BaseAgentGuardError(
        'Test error message',
        AgentGuardErrorCode.VALIDATION_ERROR
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(AgentGuardErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('BaseAgentGuardError');
    });

    it('should create error with optional details and cause', () => {
      const cause = new Error('Original error');
      const details = { requestId: '123', userId: 'user456' };

      const error = new BaseAgentGuardError(
        'Test error message',
        AgentGuardErrorCode.NETWORK_ERROR,
        details,
        cause
      );

      expect(error.details).toEqual(details);
      expect(error.cause).toBe(cause);
    });

    it('should have proper stack trace', () => {
      const error = new BaseAgentGuardError(
        'Test error',
        AgentGuardErrorCode.VALIDATION_ERROR
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BaseAgentGuardError');
    });

    it('should serialize to JSON correctly', () => {
      const cause = new Error('Original error');
      const details = { requestId: '123' };

      const error = new BaseAgentGuardError(
        'Test error message',
        AgentGuardErrorCode.SERVER_ERROR,
        details,
        cause
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'BaseAgentGuardError',
        message: 'Test error message',
        code: AgentGuardErrorCode.SERVER_ERROR,
        details: { requestId: '123' },
        stack: error.stack,
        cause: 'Original error'
      });
    });

    it('should handle undefined details and cause', () => {
      const error = new BaseAgentGuardError(
        'Test error',
        AgentGuardErrorCode.VALIDATION_ERROR
      );

      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();

      const json = error.toJSON();
      expect(json.details).toBeUndefined();
      expect(json.cause).toBeUndefined();
    });
  });

  describe('Specific Error Classes', () => {
    it('should create AgentGuardConfigError with default code', () => {
      const error = new AgentGuardConfigError('Config error');

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error).toBeInstanceOf(AgentGuardConfigError);
      expect(error.code).toBe(AgentGuardErrorCode.INVALID_CONFIG);
      expect(error.message).toBe('Config error');
      expect(error.name).toBe('AgentGuardConfigError');
    });

    it('should create AgentGuardNetworkError with default code', () => {
      const error = new AgentGuardNetworkError('Network error');

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error).toBeInstanceOf(AgentGuardNetworkError);
      expect(error.code).toBe(AgentGuardErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Network error');
      expect(error.name).toBe('AgentGuardNetworkError');
    });

    it('should create AgentGuardServerError with default code', () => {
      const error = new AgentGuardServerError('Server error');

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error).toBeInstanceOf(AgentGuardServerError);
      expect(error.code).toBe(AgentGuardErrorCode.SERVER_ERROR);
      expect(error.message).toBe('Server error');
      expect(error.name).toBe('AgentGuardServerError');
    });

    it('should create AgentGuardSecurityError with default code', () => {
      const error = new AgentGuardSecurityError('Security error');

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error).toBeInstanceOf(AgentGuardSecurityError);
      expect(error.code).toBe(AgentGuardErrorCode.SECURITY_DENIED);
      expect(error.message).toBe('Security error');
      expect(error.name).toBe('AgentGuardSecurityError');
    });

    it('should create AgentGuardValidationError with default code', () => {
      const error = new AgentGuardValidationError('Validation error');

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error).toBeInstanceOf(AgentGuardValidationError);
      expect(error.code).toBe(AgentGuardErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Validation error');
      expect(error.name).toBe('AgentGuardValidationError');
    });

    it('should create AgentGuardAuthError with default code', () => {
      const error = new AgentGuardAuthError('Auth error');

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error).toBeInstanceOf(AgentGuardAuthError);
      expect(error.code).toBe(AgentGuardErrorCode.AUTHENTICATION_ERROR);
      expect(error.message).toBe('Auth error');
      expect(error.name).toBe('AgentGuardAuthError');
    });

    it('should allow custom error codes', () => {
      const error = new AgentGuardConfigError(
        'Custom config error',
        AgentGuardErrorCode.MISSING_API_KEY
      );

      expect(error.code).toBe(AgentGuardErrorCode.MISSING_API_KEY);
    });

    it('should accept details and cause parameters', () => {
      const cause = new Error('Original error');
      const details = { field: 'apiKey' };

      const error = new AgentGuardValidationError(
        'Validation failed',
        AgentGuardErrorCode.VALIDATION_ERROR,
        details,
        cause
      );

      expect(error.details).toEqual(details);
      expect(error.cause).toBe(cause);
    });
  });

  describe('createAgentGuardError', () => {
    it('should create appropriate error types based on error codes', () => {
      const testCases = [
        {
          code: AgentGuardErrorCode.INVALID_CONFIG,
          expectedType: AgentGuardConfigError
        },
        {
          code: AgentGuardErrorCode.MISSING_API_KEY,
          expectedType: AgentGuardConfigError
        },
        {
          code: AgentGuardErrorCode.INVALID_SSA_URL,
          expectedType: AgentGuardConfigError
        },
        {
          code: AgentGuardErrorCode.NETWORK_ERROR,
          expectedType: AgentGuardNetworkError
        },
        {
          code: AgentGuardErrorCode.TIMEOUT_ERROR,
          expectedType: AgentGuardNetworkError
        },
        {
          code: AgentGuardErrorCode.CONNECTION_ERROR,
          expectedType: AgentGuardNetworkError
        },
        {
          code: AgentGuardErrorCode.AUTHENTICATION_ERROR,
          expectedType: AgentGuardAuthError
        },
        {
          code: AgentGuardErrorCode.INVALID_API_KEY_FORMAT,
          expectedType: AgentGuardAuthError
        },
        {
          code: AgentGuardErrorCode.INVALID_REQUEST,
          expectedType: AgentGuardValidationError
        },
        {
          code: AgentGuardErrorCode.VALIDATION_ERROR,
          expectedType: AgentGuardValidationError
        },
        {
          code: AgentGuardErrorCode.SERVER_ERROR,
          expectedType: AgentGuardServerError
        },
        {
          code: AgentGuardErrorCode.SERVICE_UNAVAILABLE,
          expectedType: AgentGuardServerError
        },
        {
          code: AgentGuardErrorCode.SECURITY_DENIED,
          expectedType: AgentGuardSecurityError
        },
        {
          code: AgentGuardErrorCode.POLICY_ERROR,
          expectedType: AgentGuardSecurityError
        }
      ];

      testCases.forEach(({ code, expectedType }) => {
        const error = createAgentGuardError('Test message', code);
        expect(error).toBeInstanceOf(expectedType);
        expect(error.code).toBe(code);
        expect(error.message).toBe('Test message');
      });
    });

    it('should create BaseAgentGuardError for unknown codes', () => {
      const unknownCode = 'UNKNOWN_ERROR' as AgentGuardErrorCode;
      const error = createAgentGuardError('Unknown error', unknownCode);

      expect(error).toBeInstanceOf(BaseAgentGuardError);
      expect(error.code).toBe(unknownCode);
    });

    it('should pass details and cause to created errors', () => {
      const cause = new Error('Original error');
      const details = { requestId: '123' };

      const error = createAgentGuardError(
        'Test message',
        AgentGuardErrorCode.NETWORK_ERROR,
        details,
        cause
      );

      expect(error.details).toEqual(details);
      expect(error.cause).toBe(cause);
    });
  });

  describe('isAgentGuardError', () => {
    it('should return true for AgentGuard errors', () => {
      const errors = [
        new BaseAgentGuardError('Test', AgentGuardErrorCode.VALIDATION_ERROR),
        new AgentGuardConfigError('Config error'),
        new AgentGuardNetworkError('Network error'),
        new AgentGuardServerError('Server error'),
        new AgentGuardSecurityError('Security error'),
        new AgentGuardValidationError('Validation error'),
        new AgentGuardAuthError('Auth error')
      ];

      errors.forEach(error => {
        expect(isAgentGuardError(error)).toBe(true);
      });
    });

    it('should return false for non-AgentGuard errors', () => {
      const nonAgentGuardErrors = [
        new Error('Regular error'),
        new TypeError('Type error'),
        new ReferenceError('Reference error'),
        'string error',
        123,
        null,
        undefined,
        {},
        []
      ];

      nonAgentGuardErrors.forEach(error => {
        expect(isAgentGuardError(error)).toBe(false);
      });
    });
  });

  describe('getErrorDetails', () => {
    it('should extract details from AgentGuard errors', () => {
      const error = new BaseAgentGuardError(
        'Test error',
        AgentGuardErrorCode.VALIDATION_ERROR,
        { field: 'apiKey' },
        new Error('Cause')
      );

      const details = getErrorDetails(error);

      expect(details).toEqual({
        name: 'BaseAgentGuardError',
        message: 'Test error',
        code: AgentGuardErrorCode.VALIDATION_ERROR,
        details: { field: 'apiKey' },
        stack: error.stack,
        cause: 'Cause'
      });
    });

    it('should extract details from regular errors', () => {
      const error = new Error('Regular error');
      error.stack = 'Error stack trace';

      const details = getErrorDetails(error);

      expect(details).toEqual({
        name: 'Error',
        message: 'Regular error',
        stack: 'Error stack trace'
      });
    });

    it('should handle non-error values', () => {
      const testCases = [
        { input: 'string error', expected: { error: 'string error' } },
        { input: 123, expected: { error: '123' } },
        { input: null, expected: { error: 'null' } },
        { input: undefined, expected: { error: 'undefined' } },
        { input: {}, expected: { error: '[object Object]' } },
        { input: [], expected: { error: '' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const details = getErrorDetails(input);
        expect(details).toEqual(expected);
      });
    });

    it('should handle AgentGuard errors without toJSON method', () => {
      // Create a regular error that will be handled by the Error branch
      const mockError = new Error('Mock error');
      mockError.name = 'MockAgentGuardError';
      delete (mockError as any).stack;

      const details = getErrorDetails(mockError);

      expect(details).toEqual({
        name: 'MockAgentGuardError',
        message: 'Mock error',
        stack: undefined
      });
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const error = new AgentGuardValidationError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof BaseAgentGuardError).toBe(true);
      expect(error instanceof AgentGuardValidationError).toBe(true);
    });

    it('should be catchable as Error', () => {
      expect(() => {
        throw new AgentGuardConfigError('Config error');
      }).toThrow(Error);
    });

    it('should be catchable as BaseAgentGuardError', () => {
      expect(() => {
        throw new AgentGuardNetworkError('Network error');
      }).toThrow(BaseAgentGuardError);
    });
  });
});