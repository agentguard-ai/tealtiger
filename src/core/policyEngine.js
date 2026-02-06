/**
 * Policy Engine - Core Security Decision Logic
 * 
 * This module evaluates agent requests against security policies
 * and makes allow/deny/transform decisions
 */

const fs = require('fs').promises;
const path = require('path');

class PolicyEngine {
  constructor() {
    this.policies = [];
    this.defaultPolicies = this.getDefaultPolicies();
    this.initialized = false;
  }

  /**
   * Initialize the policy engine with default policies
   */
  async initialize() {
    try {
      // Load policies from file if exists, otherwise use defaults
      await this.loadPolicies();
      this.initialized = true;
      console.log(`✅ Policy Engine initialized with ${this.policies.length} policies`);
    } catch (error) {
      console.error('Policy Engine initialization error:', error);
      // Fall back to default policies
      this.policies = this.defaultPolicies;
      this.initialized = true;
      console.log('⚠️ Using default policies due to initialization error');
    }
  }

  /**
   * Evaluate an agent request against all policies
   */
  async evaluate(request) {
    if (!this.initialized) {
      throw new Error('Policy Engine not initialized');
    }

    const startTime = Date.now();
    
    try {
      console.log(`🔍 Evaluating request: ${request.toolName} for agent ${request.agentId}`);
      
      // Step 1: Basic risk assessment
      const riskLevel = this.assessRisk(request);
      
      // Step 2: Apply policies in order
      for (const policy of this.policies) {
        const result = await this.applyPolicy(policy, request, riskLevel);
        
        if (result.matches) {
          const evaluationTime = Date.now() - startTime;
          
          console.log(`📋 Policy matched: ${policy.name} -> ${result.action}`);
          
          return {
            action: result.action,
            reason: result.reason,
            riskLevel: riskLevel,
            transformedRequest: result.transformedRequest,
            policyVersion: '1.0.0',
            evaluationTime: evaluationTime,
            matchedPolicy: policy.name
          };
        }
      }
      
      // Step 3: Default policy (if no policies match)
      const evaluationTime = Date.now() - startTime;
      
      return {
        action: riskLevel === 'critical' ? 'deny' : 'allow',
        reason: riskLevel === 'critical' 
          ? 'High risk operation denied by default policy'
          : 'Allowed by default policy',
        riskLevel: riskLevel,
        policyVersion: '1.0.0',
        evaluationTime: evaluationTime,
        matchedPolicy: 'default'
      };
      
    } catch (error) {
      console.error('Policy evaluation error:', error);
      
      // Fail closed on error
      return {
        action: 'deny',
        reason: `Policy evaluation failed: ${error.message}`,
        riskLevel: 'critical',
        policyVersion: '1.0.0',
        evaluationTime: Date.now() - startTime,
        error: true
      };
    }
  }

  /**
   * Apply a single policy to a request
   */
  async applyPolicy(policy, request, riskLevel) {
    try {
      // Check if policy conditions match
      const matches = this.evaluateConditions(policy.conditions, request, riskLevel);
      
      if (!matches) {
        return { matches: false };
      }
      
      // Apply policy action
      let result = {
        matches: true,
        action: policy.action,
        reason: policy.reason || `Applied policy: ${policy.name}`
      };
      
      // Handle transformations
      if (policy.action === 'transform' && policy.transformation) {
        result.transformedRequest = this.applyTransformation(
          request, 
          policy.transformation
        );
      }
      
      return result;
      
    } catch (error) {
      console.error(`Policy application error for ${policy.name}:`, error);
      return { matches: false };
    }
  }

  /**
   * Evaluate policy conditions against request
   */
  evaluateConditions(conditions, request, riskLevel) {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions = always match
    }
    
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, request, riskLevel)) {
        return false; // All conditions must match
      }
    }
    
    return true;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, request, riskLevel) {
    switch (condition.type) {
      case 'tool_name':
        return this.matchPattern(request.toolName, condition.pattern);
      
      case 'risk_level':
        return this.compareRiskLevel(riskLevel, condition.operator, condition.value);
      
      case 'agent_id':
        return this.matchPattern(request.agentId, condition.pattern);
      
      case 'parameter_exists':
        return request.parameters && request.parameters.hasOwnProperty(condition.parameter);
      
      case 'parameter_value':
        return request.parameters && 
               request.parameters[condition.parameter] === condition.value;
      
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Assess risk level of a request
   */
  assessRisk(request) {
    const { toolName, parameters } = request;
    
    // High-risk tools
    const highRiskTools = [
      'file-write', 'file-delete', 'system-command', 'database-write',
      'external-api-call', 'credential-access', 'network-request'
    ];
    
    // Critical risk tools
    const criticalRiskTools = [
      'system-admin', 'user-impersonation', 'credential-write',
      'security-bypass', 'privilege-escalation'
    ];
    
    if (criticalRiskTools.some(tool => toolName.includes(tool))) {
      return 'critical';
    }
    
    if (highRiskTools.some(tool => toolName.includes(tool))) {
      return 'high';
    }
    
    // Check for sensitive parameters
    if (parameters) {
      const sensitiveParams = ['password', 'token', 'key', 'secret', 'credential'];
      const hasSensitiveParams = Object.keys(parameters).some(key =>
        sensitiveParams.some(sensitive => key.toLowerCase().includes(sensitive))
      );
      
      if (hasSensitiveParams) {
        return 'high';
      }
    }
    
    // Default to medium risk
    return 'medium';
  }

  /**
   * Apply transformation to request
   */
  applyTransformation(request, transformation) {
    const transformed = { ...request };
    
    switch (transformation.type) {
      case 'read_only':
        // Convert write operations to read-only
        transformed.toolName = transformed.toolName.replace('write', 'read');
        break;
      
      case 'parameter_filter':
        // Remove sensitive parameters
        if (transformation.remove_parameters) {
          transformation.remove_parameters.forEach(param => {
            delete transformed.parameters[param];
          });
        }
        break;
      
      case 'parameter_anonymize':
        // Anonymize sensitive data
        if (transformation.anonymize_parameters) {
          transformation.anonymize_parameters.forEach(param => {
            if (transformed.parameters[param]) {
              transformed.parameters[param] = '[ANONYMIZED]';
            }
          });
        }
        break;
    }
    
    return transformed;
  }

  /**
   * Helper methods
   */
  matchPattern(value, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(value);
    }
    return value === pattern;
  }

  compareRiskLevel(current, operator, target) {
    const levels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const currentLevel = levels[current] || 2;
    const targetLevel = levels[target] || 2;
    
    switch (operator) {
      case '>=': return currentLevel >= targetLevel;
      case '>': return currentLevel > targetLevel;
      case '<=': return currentLevel <= targetLevel;
      case '<': return currentLevel < targetLevel;
      case '==': return currentLevel === targetLevel;
      default: return false;
    }
  }

  /**
   * Load policies from file
   */
  async loadPolicies() {
    try {
      const policiesPath = path.join(__dirname, '../config/policies.json');
      const data = await fs.readFile(policiesPath, 'utf8');
      this.policies = JSON.parse(data).policies || this.defaultPolicies;
    } catch (error) {
      console.log('No custom policies found, using defaults');
      this.policies = this.defaultPolicies;
    }
  }

  /**
   * Get current policies
   */
  async getPolicies() {
    return {
      policies: this.policies,
      version: '1.0.0',
      count: this.policies.length
    };
  }

  /**
   * Validate policies configuration
   */
  async validatePolicies(policies) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(policies)) {
      errors.push('Policies must be an array');
      return { valid: false, errors, warnings };
    }
    
    policies.forEach((policy, index) => {
      if (!policy.name) {
        errors.push(`Policy ${index}: Missing name`);
      }
      
      if (!policy.action || !['allow', 'deny', 'transform'].includes(policy.action)) {
        errors.push(`Policy ${index}: Invalid action`);
      }
      
      if (policy.action === 'transform' && !policy.transformation) {
        warnings.push(`Policy ${index}: Transform action without transformation`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Default security policies
   */
  getDefaultPolicies() {
    return [
      {
        name: 'deny-critical-risk',
        description: 'Deny all critical risk operations',
        conditions: [
          { type: 'risk_level', operator: '>=', value: 'critical' }
        ],
        action: 'deny',
        reason: 'Operation exceeds critical risk threshold'
      },
      {
        name: 'transform-write-to-read',
        description: 'Convert write operations to read-only for medium risk',
        conditions: [
          { type: 'tool_name', pattern: '*write*' },
          { type: 'risk_level', operator: '==', value: 'medium' }
        ],
        action: 'transform',
        transformation: { type: 'read_only' },
        reason: 'Write operation converted to read-only for safety'
      },
      {
        name: 'allow-low-risk',
        description: 'Allow all low risk operations',
        conditions: [
          { type: 'risk_level', operator: '<=', value: 'low' }
        ],
        action: 'allow',
        reason: 'Low risk operation approved'
      }
    ];
  }
}

// Export singleton instance
module.exports = new PolicyEngine();