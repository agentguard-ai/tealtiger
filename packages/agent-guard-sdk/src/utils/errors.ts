/**
 * Custom Error Classes for AgentGuard SDK
 * 
 * This file defines custom error classes for different types of errors
 * that can occur when using the AgentGuard SDK
 */

import { AgentGuardError, AgentGuardErrorCode } from '../types';

/**
 * Base class for all AgentGuard SDK errors
 */
export class BaseAgentGuardError extends Error implements AgentGuardError {
  public readonly code: AgentGuardErrorCode;
  public readonly details?: Record<string, unknown> | undefined;
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: AgentGuardErrorCode,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    
    // Handle optional properties explicitly for exactOptionalPropertyTypes
    if (details !== undefined) {
      this.details = details;
    }
    
    if (cause !== undefined) {
      this.cause = cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

/**
 * Configuration-related errors
 */
export class AgentGuardConfigError extends BaseAgentGuardError {
  constructor(
    message: string,
    code: AgentGuardErrorCode = AgentGuardErrorCode.INVALID_CONFIG,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Network and communication errors
 */
export class AgentGuardNetworkError extends BaseAgentGuardError {
  constructor(
    message: string,
    code: AgentGuardErrorCode = AgentGuardErrorCode.NETWORK_ERROR,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Server-side errors from the SSA
 */
export class AgentGuardServerError extends BaseAgentGuardError {
  constructor(
    message: string,
    code: AgentGuardErrorCode = AgentGuardErrorCode.SERVER_ERROR,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Security-related errors (denied requests, policy violations)
 */
export class AgentGuardSecurityError extends BaseAgentGuardError {
  constructor(
    message: string,
    code: AgentGuardErrorCode = AgentGuardErrorCode.SECURITY_DENIED,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Request validation errors
 */
export class AgentGuardValidationError extends BaseAgentGuardError {
  constructor(
    message: string,
    code: AgentGuardErrorCode = AgentGuardErrorCode.VALIDATION_ERROR,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Authentication errors
 */
export class AgentGuardAuthError extends BaseAgentGuardError {
  constructor(
    message: string,
    code: AgentGuardErrorCode = AgentGuardErrorCode.AUTHENTICATION_ERROR,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Utility function to create appropriate error based on error code
 */
export function createAgentGuardError(
  message: string,
  code: AgentGuardErrorCode,
  details?: Record<string, unknown>,
  cause?: Error
): AgentGuardError {
  switch (code) {
    case AgentGuardErrorCode.INVALID_CONFIG:
    case AgentGuardErrorCode.MISSING_API_KEY:
    case AgentGuardErrorCode.INVALID_SSA_URL:
      return new AgentGuardConfigError(message, code, details, cause);

    case AgentGuardErrorCode.NETWORK_ERROR:
    case AgentGuardErrorCode.TIMEOUT_ERROR:
    case AgentGuardErrorCode.CONNECTION_ERROR:
      return new AgentGuardNetworkError(message, code, details, cause);

    case AgentGuardErrorCode.AUTHENTICATION_ERROR:
    case AgentGuardErrorCode.INVALID_API_KEY_FORMAT:
      return new AgentGuardAuthError(message, code, details, cause);

    case AgentGuardErrorCode.INVALID_REQUEST:
    case AgentGuardErrorCode.VALIDATION_ERROR:
      return new AgentGuardValidationError(message, code, details, cause);

    case AgentGuardErrorCode.SERVER_ERROR:
    case AgentGuardErrorCode.SERVICE_UNAVAILABLE:
      return new AgentGuardServerError(message, code, details, cause);

    case AgentGuardErrorCode.SECURITY_DENIED:
    case AgentGuardErrorCode.POLICY_ERROR:
      return new AgentGuardSecurityError(message, code, details, cause);

    default:
      return new BaseAgentGuardError(message, code, details, cause);
  }
}

/**
 * Type guard to check if an error is an AgentGuard error
 */
export function isAgentGuardError(error: unknown): error is AgentGuardError {
  return error instanceof BaseAgentGuardError;
}

/**
 * Extract error details for logging
 */
export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (isAgentGuardError(error) && error instanceof BaseAgentGuardError && typeof error.toJSON === 'function') {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    error: String(error)
  };
}