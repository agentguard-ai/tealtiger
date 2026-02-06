/**
 * AgentGuard SDK - Main Client Class
 * 
 * This is the primary interface for developers to interact with the
 * AI Agent Security Platform
 */

import {
  AgentGuardConfig,
  ToolParameters,
  SecurityContext,
  ToolExecutionResult,
  SecurityDecision,
  AuditTrailResponse,
  SecurityPolicy,
  PolicyValidationResult,
  SDKStatistics
} from '../types';
import { SSAClient } from './SSAClient';
import { Configuration } from '../config/Configuration';
import { validateToolName, validateToolParameters, sanitizeParameters } from '../utils/validation';
import { AgentGuardValidationError } from '../utils/errors';
import { AgentGuardErrorCode } from '../types';

/**
 * Main AgentGuard SDK client class
 */
export class AgentGuard {
  private readonly config: Configuration;
  private readonly ssaClient: SSAClient;
  private readonly statistics: SDKStatistics;

  constructor(config: Partial<AgentGuardConfig>) {
    this.config = new Configuration(config);
    this.ssaClient = new SSAClient(this.config.getConfig());
    
    // Initialize statistics
    this.statistics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      transformedRequests: 0,
      averageResponseTime: 0,
      errorCount: 0
    };

    if (this.config.get('debug')) {
      console.log('[AgentGuard SDK] Initialized with config:', this.config.getSafeConfig());
    }
  }

  /**
   * Execute a tool with security evaluation
   * This is the main method developers will use
   */
  async executeTool<T = unknown>(
    toolName: string,
    parameters: ToolParameters,
    context?: SecurityContext,
    toolExecutor?: (toolName: string, params: ToolParameters) => Promise<T>
  ): Promise<ToolExecutionResult<T>> {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      validateToolName(toolName);
      validateToolParameters(parameters);

      // Prepare security evaluation request
      const request = {
        agentId: this.config.get('agentId')!,
        toolName,
        parameters,
        context
      };

      if (this.config.get('debug')) {
        console.log('[AgentGuard SDK] Evaluating tool:', toolName);
        console.log('[AgentGuard SDK] Parameters:', sanitizeParameters(parameters));
      }

      // Evaluate security
      const evaluationResponse = await this.ssaClient.evaluateSecurity(request);
      
      if (!evaluationResponse.success) {
        throw new AgentGuardValidationError(
          'Security evaluation failed',
          AgentGuardErrorCode.VALIDATION_ERROR,
          { response: evaluationResponse }
        );
      }

      const decision = evaluationResponse.decision;
      this.updateStatistics(decision, Date.now() - startTime);

      // Handle security decision
      switch (decision.action) {
        case 'allow':
          return await this.handleAllowDecision(toolName, parameters, decision, toolExecutor);
        
        case 'deny':
          return this.handleDenyDecision(decision);
        
        case 'transform':
          return await this.handleTransformDecision(decision, toolExecutor);
        
        default:
          throw new AgentGuardValidationError(
            `Unknown security action: ${decision.action}`,
            AgentGuardErrorCode.POLICY_ERROR,
            { decision }
          );
      }

    } catch (error) {
      this.statistics.errorCount++;
      
      if (this.config.get('debug')) {
        console.error('[AgentGuard SDK] Tool execution failed:', error);
      }

      // Return error result
      return {
        success: false,
        securityDecision: {
          requestId: `error-${Date.now()}`,
          agentId: this.config.get('agentId')!,
          toolName,
          action: 'deny',
          reason: 'Tool execution failed due to error',
          riskLevel: 'critical',
          timestamp: new Date().toISOString()
        },
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof Error && 'details' in error ? (error as any).details : undefined
        }
      };
    }
  }

  /**
   * Evaluate tool security without execution
   */
  async evaluateTool(
    toolName: string,
    parameters: ToolParameters,
    context?: SecurityContext
  ): Promise<SecurityDecision> {
    validateToolName(toolName);
    validateToolParameters(parameters);

    const request = {
      agentId: this.config.get('agentId')!,
      toolName,
      parameters,
      context
    };

    const response = await this.ssaClient.evaluateSecurity(request);
    
    if (!response.success) {
      throw new AgentGuardValidationError(
        'Security evaluation failed',
        AgentGuardErrorCode.VALIDATION_ERROR,
        { response }
      );
    }

    return response.decision;
  }

  /**
   * Check if the Security Sidecar Agent is healthy
   */
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    return await this.ssaClient.healthCheck();
  }

  /**
   * Get current security policies
   */
  async getPolicies(): Promise<{ policies: SecurityPolicy[]; version: string; count: number }> {
    return await this.ssaClient.getPolicies();
  }

  /**
   * Validate security policies
   */
  async validatePolicies(policies: SecurityPolicy[]): Promise<PolicyValidationResult> {
    return await this.ssaClient.validatePolicies(policies);
  }

  /**
   * Get audit trail for the current agent
   */
  async getAuditTrail(options: { limit?: number; offset?: number } = {}): Promise<AuditTrailResponse> {
    const agentId = this.config.get('agentId')!;
    return await this.ssaClient.getAuditTrail(agentId, options);
  }

  /**
   * Get SDK usage statistics
   */
  getStatistics(): SDKStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset SDK statistics
   */
  resetStatistics(): void {
    this.statistics.totalRequests = 0;
    this.statistics.allowedRequests = 0;
    this.statistics.deniedRequests = 0;
    this.statistics.transformedRequests = 0;
    this.statistics.averageResponseTime = 0;
    this.statistics.errorCount = 0;
  }

  /**
   * Get current configuration (safe for logging)
   */
  getConfig(): Partial<AgentGuardConfig> {
    return this.config.getSafeConfig();
  }

  /**
   * Handle allow decision
   */
  private async handleAllowDecision<T>(
    toolName: string,
    parameters: ToolParameters,
    decision: SecurityDecision,
    toolExecutor?: (toolName: string, params: ToolParameters) => Promise<T>
  ): Promise<ToolExecutionResult<T>> {
    if (this.config.get('debug')) {
      console.log('[AgentGuard SDK] Tool allowed:', decision.reason);
    }

    let data: T | undefined;
    
    if (toolExecutor) {
      try {
        data = await toolExecutor(toolName, parameters);
      } catch (error) {
        return {
          success: false,
          securityDecision: decision,
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Tool execution failed',
            details: { originalError: error }
          }
        };
      }
    }

    return {
      success: true,
      data,
      securityDecision: decision
    };
  }

  /**
   * Handle deny decision
   */
  private handleDenyDecision<T>(decision: SecurityDecision): ToolExecutionResult<T> {
    if (this.config.get('debug')) {
      console.log('[AgentGuard SDK] Tool denied:', decision.reason);
    }

    return {
      success: false,
      securityDecision: decision,
      error: {
        code: 'SECURITY_DENIED',
        message: `Tool execution denied: ${decision.reason}`,
        details: { riskLevel: decision.riskLevel }
      }
    };
  }

  /**
   * Handle transform decision
   */
  private async handleTransformDecision<T>(
    decision: SecurityDecision,
    toolExecutor?: (toolName: string, params: ToolParameters) => Promise<T>
  ): Promise<ToolExecutionResult<T>> {
    if (this.config.get('debug')) {
      console.log('[AgentGuard SDK] Tool transformed:', decision.reason);
    }

    if (!decision.transformedRequest) {
      return {
        success: false,
        securityDecision: decision,
        error: {
          code: 'TRANSFORMATION_ERROR',
          message: 'Transform decision provided but no transformed request available'
        }
      };
    }

    let data: T | undefined;
    
    if (toolExecutor) {
      try {
        data = await toolExecutor(
          decision.transformedRequest.toolName,
          decision.transformedRequest.parameters
        );
      } catch (error) {
        return {
          success: false,
          securityDecision: decision,
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Transformed tool execution failed',
            details: { originalError: error }
          }
        };
      }
    }

    return {
      success: true,
      data,
      securityDecision: decision
    };
  }

  /**
   * Update internal statistics
   */
  private updateStatistics(decision: SecurityDecision, responseTime: number): void {
    this.statistics.totalRequests++;
    
    switch (decision.action) {
      case 'allow':
        this.statistics.allowedRequests++;
        break;
      case 'deny':
        this.statistics.deniedRequests++;
        break;
      case 'transform':
        this.statistics.transformedRequests++;
        break;
    }

    // Update average response time
    const totalTime = this.statistics.averageResponseTime * (this.statistics.totalRequests - 1) + responseTime;
    this.statistics.averageResponseTime = totalTime / this.statistics.totalRequests;
  }
}