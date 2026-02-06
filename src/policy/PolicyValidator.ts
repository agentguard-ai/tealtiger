/**
 * Policy Validation Utilities
 * 
 * This module provides utilities for validating security policies
 * and checking for common issues and conflicts
 */

import {
  SecurityPolicy,
  PolicyCondition,
  PolicyTransformation,
  SecurityAction,
  RiskLevel
} from '../types';

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  /** Whether the policy is valid */
  isValid: boolean;
  
  /** List of validation errors */
  errors: string[];
  
  /** List of validation warnings */
  warnings: string[];
  
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Policy conflict detection result
 */
export interface PolicyConflict {
  /** Type of conflict */
  type: 'priority' | 'condition_overlap' | 'action_contradiction';
  
  /** Description of the conflict */
  description: string;
  
  /** Policies involved in the conflict */
  policies: string[];
  
  /** Severity of the conflict */
  severity: 'error' | 'warning' | 'info';
  
  /** Suggested resolution */
  resolution?: string;
}

/**
 * Policy set analysis result
 */
export interface PolicySetAnalysis {
  /** Individual policy validation results */
  policyResults: Record<string, PolicyValidationResult>;
  
  /** Detected conflicts between policies */
  conflicts: PolicyConflict[];
  
  /** Coverage analysis */
  coverage: {
    /** Risk levels covered */
    riskLevels: RiskLevel[];
    
    /** Tool patterns covered */
    toolPatterns: string[];
    
    /** Gaps in coverage */
    gaps: string[];
  };
  
  /** Performance analysis */
  performance: {
    /** Estimated evaluation time */
    estimatedEvaluationTime: number;
    
    /** Number of conditions to evaluate */
    totalConditions: number;
    
    /** Optimization suggestions */
    optimizations: string[];
  };
}

/**
 * Policy validation utility class
 */
export class PolicyValidator {
  /**
   * Validate a single policy
   */
  static validatePolicy(policy: SecurityPolicy): PolicyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (!policy.name || policy.name.trim().length === 0) {
      errors.push('Policy name is required and cannot be empty');
    }

    if (!policy.action) {
      errors.push('Policy action is required (allow, deny, or transform)');
    }

    if (!policy.reason || policy.reason.trim().length === 0) {
      errors.push('Policy reason is required and cannot be empty');
    }

    if (!policy.conditions || policy.conditions.length === 0) {
      errors.push('Policy must have at least one condition');
    }

    // Validate action-specific requirements
    if (policy.action === 'transform') {
      if (!policy.transformation) {
        errors.push('Transform action requires a transformation definition');
      } else {
        const transformErrors = this.validateTransformation(policy.transformation);
        errors.push(...transformErrors);
      }
    }

    // Validate conditions
    if (policy.conditions) {
      for (let i = 0; i < policy.conditions.length; i++) {
        const condition = policy.conditions[i];
        const conditionErrors = this.validateCondition(condition, i);
        errors.push(...conditionErrors);
      }
    }

    // Check for potential issues
    if (policy.priority === undefined) {
      warnings.push('Policy priority not set - will default to 999 (lowest priority)');
      suggestions.push('Set explicit priority to control policy evaluation order');
    }

    if (policy.conditions && policy.conditions.length > 5) {
      warnings.push('Policy has many conditions - consider splitting into multiple policies');
      suggestions.push('Complex policies can be harder to maintain and debug');
    }

    // Check for overly broad patterns
    if (policy.conditions) {
      const hasWildcardOnly = policy.conditions.some(c => 
        c.type === 'tool_name' && c.pattern === '*'
      );
      if (hasWildcardOnly) {
        warnings.push('Policy uses overly broad wildcard pattern (*)');
        suggestions.push('Consider more specific patterns to avoid unintended matches');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate a transformation definition
   */
  private static validateTransformation(transformation: PolicyTransformation): string[] {
    const errors: string[] = [];

    if (!transformation.type) {
      errors.push('Transformation type is required');
      return errors;
    }

    switch (transformation.type) {
      case 'parameter_filter':
        if (!transformation.remove_parameters || transformation.remove_parameters.length === 0) {
          errors.push('Parameter filter transformation requires remove_parameters array');
        }
        break;

      case 'parameter_anonymize':
        if (!transformation.anonymize_parameters || transformation.anonymize_parameters.length === 0) {
          errors.push('Parameter anonymize transformation requires anonymize_parameters array');
        }
        break;

      case 'read_only':
        // No additional validation needed for read_only
        break;

      default:
        errors.push(`Unknown transformation type: ${transformation.type}`);
    }

    return errors;
  }

  /**
   * Validate a policy condition
   */
  private static validateCondition(condition: PolicyCondition, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Condition ${index + 1}:`;

    if (!condition.type) {
      errors.push(`${prefix} Condition type is required`);
      return errors;
    }

    switch (condition.type) {
      case 'tool_name':
      case 'agent_id':
        if (!condition.pattern) {
          errors.push(`${prefix} Pattern is required for ${condition.type} condition`);
        }
        break;

      case 'risk_level':
        if (!condition.operator) {
          errors.push(`${prefix} Operator is required for risk_level condition`);
        } else if (!['>=', '>', '<=', '<', '=='].includes(condition.operator)) {
          errors.push(`${prefix} Invalid operator: ${condition.operator}`);
        }
        
        if (!condition.value) {
          errors.push(`${prefix} Value is required for risk_level condition`);
        } else if (!['low', 'medium', 'high', 'critical'].includes(condition.value)) {
          errors.push(`${prefix} Invalid risk level: ${condition.value}`);
        }
        break;

      case 'parameter_exists':
      case 'parameter_value':
        if (!condition.parameter) {
          errors.push(`${prefix} Parameter name is required for ${condition.type} condition`);
        }
        
        if (condition.type === 'parameter_value' && condition.value === undefined) {
          errors.push(`${prefix} Value is required for parameter_value condition`);
        }
        break;

      default:
        errors.push(`${prefix} Unknown condition type: ${condition.type}`);
    }

    return errors;
  }

  /**
   * Analyze a set of policies for conflicts and coverage
   */
  static analyzePolicySet(policies: SecurityPolicy[]): PolicySetAnalysis {
    const policyResults: Record<string, PolicyValidationResult> = {};
    const conflicts: PolicyConflict[] = [];

    // Validate individual policies
    for (const policy of policies) {
      policyResults[policy.name] = this.validatePolicy(policy);
    }

    // Detect conflicts
    conflicts.push(...this.detectPriorityConflicts(policies));
    conflicts.push(...this.detectConditionOverlaps(policies));
    conflicts.push(...this.detectActionContradictions(policies));

    // Analyze coverage
    const coverage = this.analyzeCoverage(policies);

    // Analyze performance
    const performance = this.analyzePerformance(policies);

    return {
      policyResults,
      conflicts,
      coverage,
      performance
    };
  }

  /**
   * Detect priority conflicts
   */
  private static detectPriorityConflicts(policies: SecurityPolicy[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];
    const priorityGroups: Record<number, string[]> = {};

    // Group policies by priority
    for (const policy of policies) {
      const priority = policy.priority || 999;
      if (!priorityGroups[priority]) {
        priorityGroups[priority] = [];
      }
      priorityGroups[priority].push(policy.name);
    }

    // Check for multiple policies with same priority
    for (const [priority, policyNames] of Object.entries(priorityGroups)) {
      if (policyNames.length > 1) {
        conflicts.push({
          type: 'priority',
          description: `Multiple policies have the same priority (${priority})`,
          policies: policyNames,
          severity: 'warning',
          resolution: 'Assign unique priorities to ensure deterministic evaluation order'
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect condition overlaps
   */
  private static detectConditionOverlaps(policies: SecurityPolicy[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];

    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const policy1 = policies[i];
        const policy2 = policies[j];

        if (this.policiesHaveOverlappingConditions(policy1, policy2)) {
          conflicts.push({
            type: 'condition_overlap',
            description: `Policies may have overlapping conditions`,
            policies: [policy1.name, policy2.name],
            severity: 'info',
            resolution: 'Review conditions to ensure intended behavior'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect action contradictions
   */
  private static detectActionContradictions(policies: SecurityPolicy[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];

    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const policy1 = policies[i];
        const policy2 = policies[j];

        if (this.policiesHaveOverlappingConditions(policy1, policy2) &&
            this.actionsContradict(policy1.action, policy2.action)) {
          
          const priority1 = policy1.priority || 999;
          const priority2 = policy2.priority || 999;
          
          conflicts.push({
            type: 'action_contradiction',
            description: `Policies have contradictory actions for overlapping conditions`,
            policies: [policy1.name, policy2.name],
            severity: priority1 === priority2 ? 'error' : 'warning',
            resolution: priority1 === priority2 
              ? 'Set different priorities or refine conditions to avoid conflicts'
              : `Policy "${priority1 < priority2 ? policy1.name : policy2.name}" will take precedence`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two policies have overlapping conditions
   */
  private static policiesHaveOverlappingConditions(policy1: SecurityPolicy, policy2: SecurityPolicy): boolean {
    // Simplified overlap detection - in practice, this would be more sophisticated
    const conditions1 = policy1.conditions || [];
    const conditions2 = policy2.conditions || [];

    // Check for exact condition matches
    for (const c1 of conditions1) {
      for (const c2 of conditions2) {
        if (this.conditionsOverlap(c1, c2)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if two conditions overlap
   */
  private static conditionsOverlap(c1: PolicyCondition, c2: PolicyCondition): boolean {
    if (c1.type !== c2.type) {
      return false;
    }

    switch (c1.type) {
      case 'tool_name':
      case 'agent_id':
        return this.patternsOverlap(c1.pattern || '', c2.pattern || '');
      
      case 'parameter_exists':
        return c1.parameter === c2.parameter;
      
      case 'parameter_value':
        return c1.parameter === c2.parameter && c1.value === c2.value;
      
      case 'risk_level':
        return this.riskLevelConditionsOverlap(c1, c2);
      
      default:
        return false;
    }
  }

  /**
   * Check if two patterns overlap
   */
  private static patternsOverlap(pattern1: string, pattern2: string): boolean {
    // Simplified pattern overlap detection
    if (pattern1 === pattern2) return true;
    if (pattern1 === '*' || pattern2 === '*') return true;
    
    // More sophisticated pattern matching would be needed for complex wildcards
    return false;
  }

  /**
   * Check if risk level conditions overlap
   */
  private static riskLevelConditionsOverlap(c1: PolicyCondition, c2: PolicyCondition): boolean {
    // Simplified - would need more complex logic for different operators
    return c1.operator === c2.operator && c1.value === c2.value;
  }

  /**
   * Check if actions contradict each other
   */
  private static actionsContradict(action1: SecurityAction, action2: SecurityAction): boolean {
    return (action1 === 'allow' && action2 === 'deny') ||
           (action1 === 'deny' && action2 === 'allow');
  }

  /**
   * Analyze policy coverage
   */
  private static analyzeCoverage(policies: SecurityPolicy[]): PolicySetAnalysis['coverage'] {
    const riskLevels: Set<RiskLevel> = new Set();
    const toolPatterns: Set<string> = new Set();
    const gaps: string[] = [];

    for (const policy of policies) {
      for (const condition of policy.conditions || []) {
        if (condition.type === 'risk_level' && condition.value) {
          riskLevels.add(condition.value as RiskLevel);
        }
        if (condition.type === 'tool_name' && condition.pattern) {
          toolPatterns.add(condition.pattern);
        }
      }
    }

    // Check for coverage gaps
    const allRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    for (const level of allRiskLevels) {
      if (!riskLevels.has(level)) {
        gaps.push(`No policies cover ${level} risk level`);
      }
    }

    if (toolPatterns.size === 0) {
      gaps.push('No tool-specific policies defined');
    }

    return {
      riskLevels: Array.from(riskLevels),
      toolPatterns: Array.from(toolPatterns),
      gaps
    };
  }

  /**
   * Analyze policy performance characteristics
   */
  private static analyzePerformance(policies: SecurityPolicy[]): PolicySetAnalysis['performance'] {
    const totalConditions = policies.reduce((sum, policy) => 
      sum + (policy.conditions?.length || 0), 0
    );

    // Rough estimation: 1ms per condition evaluation
    const estimatedEvaluationTime = totalConditions * 1;

    const optimizations: string[] = [];

    if (policies.length > 10) {
      optimizations.push('Consider grouping related policies to reduce evaluation overhead');
    }

    if (totalConditions > 50) {
      optimizations.push('High number of conditions may impact performance - consider policy consolidation');
    }

    // Check for inefficient patterns
    const hasComplexPatterns = policies.some(policy =>
      policy.conditions?.some(condition =>
        condition.type === 'tool_name' && 
        condition.pattern && 
        condition.pattern.includes('*') && 
        condition.pattern.length > 10
      )
    );

    if (hasComplexPatterns) {
      optimizations.push('Complex wildcard patterns may be slow - consider simpler alternatives');
    }

    return {
      estimatedEvaluationTime,
      totalConditions,
      optimizations
    };
  }
}

/**
 * Create a policy validator instance
 */
export function createPolicyValidator(): typeof PolicyValidator {
  return PolicyValidator;
}