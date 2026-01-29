/**
 * Security Sidecar Agent (SSA) HTTP Client
 * 
 * This class handles all HTTP communication with the Security Sidecar Agent
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import {
  AgentGuardConfig,
  SecurityEvaluationResponse,
  ToolExecutionRequest,
  AuditTrailResponse,
  PolicyValidationResult,
  SecurityPolicy,
  AgentGuardError,
  AgentGuardErrorCode
} from '../types';
import { AgentGuardConfigError, AgentGuardNetworkError, AgentGuardServerError } from '../utils/errors';

/**
 * HTTP client for communicating with the Security Sidecar Agent
 */
export class SSAClient {
  private readonly httpClient: AxiosInstance;
  private readonly config: AgentGuardConfig;

  constructor(config: AgentGuardConfig) {
    this.config = config;
    
    // Create axios instance with default configuration
    this.httpClient = axios.create({
      baseURL: config.ssaUrl,
      timeout: config.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'User-Agent': 'AgentGuard-SDK/0.1.0',
        ...config.headers
      }
    });

    // Add request interceptor for debugging
    if (config.debug) {
      this.httpClient.interceptors.request.use(
        (request) => {
          console.log(`[AgentGuard SDK] Request: ${request.method?.toUpperCase()} ${request.url}`);
          console.log(`[AgentGuard SDK] Headers:`, request.headers);
          if (request.data) {
            console.log(`[AgentGuard SDK] Body:`, request.data);
          }
          return request;
        },
        (error) => {
          console.error('[AgentGuard SDK] Request Error:', error);
          return Promise.reject(error);
        }
      );
    }

    // Add response interceptor for debugging and error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          console.log(`[AgentGuard SDK] Response: ${response.status} ${response.statusText}`);
          console.log(`[AgentGuard SDK] Data:`, response.data);
        }
        return response;
      },
      (error: AxiosError) => {
        if (this.config.debug) {
          console.error('[AgentGuard SDK] Response Error:', error.message);
        }
        return Promise.reject(this.handleHttpError(error));
      }
    );
  }

  /**
   * Check if the SSA service is healthy
   */
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    try {
      const response = await this.httpClient.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Health check failed');
    }
  }

  /**
   * Evaluate a tool execution request for security
   */
  async evaluateSecurity(request: ToolExecutionRequest): Promise<SecurityEvaluationResponse> {
    try {
      const response: AxiosResponse<SecurityEvaluationResponse> = await this.httpClient.post(
        '/api/security/evaluate',
        request
      );
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Security evaluation failed');
    }
  }

  /**
   * Get current security policies
   */
  async getPolicies(): Promise<{ policies: SecurityPolicy[]; version: string; count: number }> {
    try {
      const response = await this.httpClient.get('/api/security/policies');
      return response.data.policies;
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve policies');
    }
  }

  /**
   * Validate security policies
   */
  async validatePolicies(policies: SecurityPolicy[]): Promise<PolicyValidationResult> {
    try {
      const response = await this.httpClient.post('/api/security/policies/validate', {
        policies
      });
      return response.data.validation;
    } catch (error) {
      throw this.handleError(error, 'Policy validation failed');
    }
  }

  /**
   * Get audit trail for an agent
   */
  async getAuditTrail(
    agentId: string, 
    options: { limit?: number; offset?: number } = {}
  ): Promise<AuditTrailResponse> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      
      const url = `/api/security/audit/${agentId}${params.toString() ? `?${params.toString()}` : ''}`;
      const response: AxiosResponse<AuditTrailResponse> = await this.httpClient.get(url);
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve audit trail');
    }
  }

  /**
   * Handle HTTP errors and convert them to AgentGuard errors
   */
  private handleHttpError(error: AxiosError): AgentGuardError {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new AgentGuardNetworkError(
        'Unable to connect to Security Sidecar Agent',
        AgentGuardErrorCode.CONNECTION_ERROR,
        { ssaUrl: this.config.ssaUrl, originalError: error.message }
      );
    }

    if (error.code === 'ECONNABORTED') {
      return new AgentGuardNetworkError(
        'Request timeout',
        AgentGuardErrorCode.TIMEOUT_ERROR,
        { timeout: this.config.timeout, originalError: error.message }
      );
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        return new AgentGuardConfigError(
          'Authentication failed - invalid API key',
          AgentGuardErrorCode.AUTHENTICATION_ERROR,
          { apiKey: this.config.apiKey.substring(0, 10) + '...', response: data }
        );
      }

      if (status === 400) {
        return new AgentGuardConfigError(
          'Invalid request format',
          AgentGuardErrorCode.VALIDATION_ERROR,
          { response: data }
        );
      }

      if (status >= 500) {
        return new AgentGuardServerError(
          'Security Sidecar Agent server error',
          AgentGuardErrorCode.SERVER_ERROR,
          { status, response: data }
        );
      }

      return new AgentGuardNetworkError(
        `HTTP ${status}: ${error.response.statusText}`,
        AgentGuardErrorCode.NETWORK_ERROR,
        { status, response: data }
      );
    }

    return new AgentGuardNetworkError(
      'Network error occurred',
      AgentGuardErrorCode.NETWORK_ERROR,
      { originalError: error.message }
    );
  }

  /**
   * Generic error handler
   */
  private handleError(error: unknown, context: string): AgentGuardError {
    if (error instanceof Error && 'code' in error) {
      return error as AgentGuardError;
    }

    if (error instanceof AxiosError) {
      return this.handleHttpError(error);
    }

    return new AgentGuardNetworkError(
      `${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      AgentGuardErrorCode.NETWORK_ERROR,
      { context, originalError: error }
    );
  }

  /**
   * Get client configuration (for debugging)
   */
  getConfig(): Partial<AgentGuardConfig> {
    return {
      ssaUrl: this.config.ssaUrl,
      agentId: this.config.agentId,
      timeout: this.config.timeout,
      retries: this.config.retries,
      debug: this.config.debug
    };
  }
}