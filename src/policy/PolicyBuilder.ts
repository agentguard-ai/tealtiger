/**
 * Policy Builder - Fluent API for Creating Security Policies
 * 
 * This utility provides a fluent interface for building security policies
 * with validation and type safety
 */

import {
  SecurityPolicy,
  PolicyCondition,
  PolicyTransformation,
  RiskLevel
} from '../types';
import { AgentGuardValidationError } from '../utils/errors';
import { AgentGuardErrorCode } from '../types';

/**
 * Fluent policy builder class
 */
export class PolicyBuilder {
  private policy: Partial<SecurityPolicy> = {
    conditions: []
  };

  /**
   * Set policy name
   */
  name(name: string): PolicyBuilder {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AgentGuardValidationError(
        'Policy name must be a non-empty string',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }
    this.policy.name = name.trim();
    return this;
  }

  /**
   * Set policy description
   */
  description(description: string): PolicyBuilder {
    if (description && typeof description === 'string') {
      this.policy.description = description.trim();
    }
    return this;
  }

  /**
   * Set policy priority (lower numbers = higher priority)
   */
  priority(priority: number): PolicyBuilder {
    if (typeof priority !== 'number' || priority < 0 || !Number.isFinite(priority)) {
      throw new AgentGuardValidationError(
        'Policy priority must be a non-negative finite number',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }
    this.policy.priority = priority;
    return this;
  }

  /**
   * Add condition: tool name matches pattern
   */
  whenToolName(pattern: string): PolicyBuilder {
    this.addCondition({
      type: 'tool_name',
      pattern
    });
    return this;
  }

  /**
   * Add condition: risk level comparison
   */
  whenRiskLevel(operator: '>=' | '>' | '<=' | '<' | '==', level: RiskLevel): PolicyBuilder {
    this.addCondition({
      type: 'risk_level',
      operator,
      value: level
    });
    return this;
  }

  /**
   * Add condition: agent ID matches pattern
   */
  whenAgentId(pattern: string): PolicyBuilder {
    this.addCondition({
      type: 'agent_id',
      pattern
    });
    return this;
  }

  /**
   * Add condition: parameter exists
   */
  whenParameterExists(parameter: string): PolicyBuilder {
    this.addCondition({
      type: 'parameter_exists',
      parameter
    });
    return this;
  }

  /**
   * Add condition: parameter has specific value
   */
  whenParameterEquals(parameter: string, value: string): PolicyBuilder {
    this.addCondition({
      type: 'parameter_value',
      parameter,
      value
    });
    return this;
  }

  /**
   * Add custom condition
   */
  whenCondition(condition: PolicyCondition): PolicyBuilder {
    this.addCondition(condition);
    return this;
  }

  /**
   * Set action to allow
   */
  allow(reason?: string): PolicyBuilder {
    this.policy.action = 'allow';
    this.policy.reason = reason || 'Operation allowed by policy';
    return this;
  }

  /**
   * Set action to deny
   */
  deny(reason?: string): PolicyBuilder {
    this.policy.action = 'deny';
    this.policy.reason = reason || 'Operation denied by policy';
    return this;
  }

  /**
   * Set action to transform with read-only transformation
   */
  transformToReadOnly(reason?: string): PolicyBuilder {
    this.policy.action = 'transform';
    this.policy.reason = reason || 'Operation transformed to read-only for safety';
    this.policy.transformation = {
      type: 'read_only'
    };
    return this;
  }

  /**
   * Set action to transform with parameter filtering
   */
  transformFilterParameters(parametersToRemove: string[], reason?: string): PolicyBuilder {
    this.policy.action = 'transform';
    this.policy.reason = reason || 'Sensitive parameters filtered for safety';
    this.policy.transformation = {
      type: 'parameter_filter',
      remove_parameters: parametersToRemove
    };
    return this;
  }

  /**
   * Set action to transform with parameter anonymization
   */
  transformAnonymizeParameters(parametersToAnonymize: string[], reason?: string): PolicyBuilder {
    this.policy.action = 'transform';
    this.policy.reason = reason || 'Sensitive parameters anonymized for safety';
    this.policy.transformation = {
      type: 'parameter_anonymize',
      anonymize_parameters: parametersToAnonymize
    };
    return this;
  }

  /**
   * Set custom transformation
   */
  transformWith(transformation: PolicyTransformation, reason?: string): PolicyBuilder {
    this.policy.action = 'transform';
    this.policy.reason = reason || 'Operation transformed by policy';
    this.policy.transformation = transformation;
    return this;
  }

  /**
   * Build the final policy
   */
  build(): SecurityPolicy {
    this.validatePolicy();
    return this.policy as SecurityPolicy;
  }

  /**
   * Add a condition to the policy
   */
  private addCondition(condition: PolicyCondition): void {
    if (!this.policy.conditions) {
      this.policy.conditions = [];
    }
    this.policy.conditions.push(condition);
  }

  /**
   * Validate the policy before building
   */
  private validatePolicy(): void {
    if (!this.policy.name) {
      throw new AgentGuardValidationError(
        'Policy name is required',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }

    if (!this.policy.action) {
      throw new AgentGuardValidationError(
        'Policy action is required (allow, deny, or transform)',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }

    if (!this.policy.reason) {
      throw new AgentGuardValidationError(
        'Policy reason is required',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }

    if (!this.policy.conditions || this.policy.conditions.length === 0) {
      throw new AgentGuardValidationError(
        'Policy must have at least one condition',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }

    if (this.policy.action === 'transform' && !this.policy.transformation) {
      throw new AgentGuardValidationError(
        'Transform action requires a transformation definition',
        AgentGuardErrorCode.VALIDATION_ERROR
      );
    }
  }
}

/**
 * Create a new policy builder
 */
export function createPolicy(): PolicyBuilder {
  return new PolicyBuilder();
}

/**
 * Policy template functions for common patterns
 */
export class PolicyTemplates {
  /**
   * Allow all low-risk operations
   */
  static allowLowRisk(): SecurityPolicy {
    return createPolicy()
      .name('allow-low-risk')
      .description('Allow all low-risk operations')
      .whenRiskLevel('<=', 'low')
      .allow('Low-risk operations are safe to execute')
      .build();
  }

  /**
   * Deny all critical-risk operations
   */
  static denyCriticalRisk(): SecurityPolicy {
    return createPolicy()
      .name('deny-critical-risk')
      .description('Deny all critical-risk operations')
      .whenRiskLevel('>=', 'critical')
      .deny('Critical-risk operations are too dangerous')
      .build();
  }

  /**
   * Allow search operations
   */
  static allowSearchOperations(): SecurityPolicy {
    return createPolicy()
      .name('allow-search-operations')
      .description('Allow web search and information retrieval')
      .whenToolName('*search*')
      .allow('Search operations are generally safe')
      .build();
  }

  /**
   * Deny system commands
   */
  static denySystemCommands(): SecurityPolicy {
    return createPolicy()
      .name('deny-system-commands')
      .description('Block all system command execution')
      .whenToolName('*system*')
      .deny('System commands pose security risks')
      .build();
  }

  /**
   * Transform file writes to reads
   */
  static transformFileWrites(): SecurityPolicy {
    return createPolicy()
      .name('transform-file-writes')
      .description('Convert file write operations to read-only')
      .whenToolName('*write*')
      .transformToReadOnly('File writes converted to reads for safety')
      .build();
  }

  /**
   * Filter sensitive parameters
   */
  static filterSensitiveData(): SecurityPolicy {
    return createPolicy()
      .name('filter-sensitive-data')
      .description('Remove sensitive parameters from requests')
      .whenParameterExists('password')
      .transformFilterParameters(
        ['password', 'token', 'secret', 'key'],
        'Sensitive data filtered for security'
      )
      .build();
  }

  /**
   * Restrict agent access by ID pattern
   */
  static restrictAgentAccess(agentPattern: string, allowedTools: string[]): SecurityPolicy {
    const toolPattern = allowedTools.length === 1 
      ? allowedTools[0] 
      : `{${allowedTools.join(',')}}`;

    return createPolicy()
      .name(`restrict-${agentPattern.replace('*', 'agents')}`)
      .description(`Restrict ${agentPattern} agents to specific tools`)
      .whenAgentId(agentPattern)
      .whenToolName(toolPattern)
      .allow(`Agent ${agentPattern} allowed to use ${allowedTools.join(', ')}`)
      .build();
  }

  /**
   * Get all default policy templates
   */
  static getDefaultPolicies(): SecurityPolicy[] {
    return [
      this.denyCriticalRisk(),
      this.denySystemCommands(),
      this.transformFileWrites(),
      this.filterSensitiveData(),
      this.allowSearchOperations(),
      this.allowLowRisk()
    ];
  }
}