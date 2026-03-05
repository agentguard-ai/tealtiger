/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.1: Policy Rollout Modes - Mode Resolution Algorithm
 * 
 * Hierarchical mode resolution with priority: policy-specific > environment-specific > global default
 * 
 * @module core/engine/ModeResolver
 * @version 1.1.0
 */

import { 
  PolicyMode, 
  ModeConfig, 
  InvalidConfigurationError,
  isValidPolicyMode,
  validateModeConfig
} from './task-1.1-types';

/**
 * Mode resolution context
 * Contains all information needed to resolve the effective mode for a policy
 * 
 * @interface ModeResolutionContext
 */
export interface ModeResolutionContext {
  /** Policy ID being evaluated */
  policyId: string;
  
  /** Current environment (e.g., 'production', 'staging', 'development') */
  environment?: string;
  
  /** Mode configuration */
  modeConfig: ModeConfig;
}

/**
 * Mode resolution result
 * Contains the resolved mode and metadata about the resolution
 * 
 * @interface ModeResolutionResult
 */
export interface ModeResolutionResult {
  /** Resolved policy mode */
  mode: PolicyMode;
  
  /** Source of the resolved mode */
  source: 'policy' | 'environment' | 'default';
  
  /** Resolution time in milliseconds */
  resolutionTimeMs: number;
}

/**
 * ModeResolver class
 * Implements hierarchical mode resolution algorithm with performance optimization
 */
export class ModeResolver {
  /**
   * Resolves the effective policy mode using hierarchical resolution
   * Priority: policy-specific > environment-specific > global default
   * 
   * Performance target: < 1ms at 99th percentile
   * 
   * @param context - Mode resolution context
   * @returns Mode resolution result with resolved mode and metadata
   * @throws {InvalidConfigurationError} if mode configuration is invalid
   */
  static resolvePolicyMode(context: ModeResolutionContext): ModeResolutionResult {
    const startTime = performance.now();
    
    // Validate mode configuration
    validateModeConfig(context.modeConfig);
    
    // Priority 1: Policy-specific override (highest priority)
    if (context.modeConfig.policy && context.policyId in context.modeConfig.policy) {
      const mode = context.modeConfig.policy[context.policyId];
      
      if (!isValidPolicyMode(mode)) {
        throw new InvalidConfigurationError(
          `Invalid policy-specific mode for policy '${context.policyId}': ${mode}`
        );
      }
      
      const resolutionTimeMs = performance.now() - startTime;
      return {
        mode,
        source: 'policy',
        resolutionTimeMs
      };
    }
    
    // Priority 2: Environment-specific override
    if (context.environment && context.modeConfig.environment && 
        context.environment in context.modeConfig.environment) {
      const mode = context.modeConfig.environment[context.environment];
      
      if (!isValidPolicyMode(mode)) {
        throw new InvalidConfigurationError(
          `Invalid environment-specific mode for environment '${context.environment}': ${mode}`
        );
      }
      
      const resolutionTimeMs = performance.now() - startTime;
      return {
        mode,
        source: 'environment',
        resolutionTimeMs
      };
    }
    
    // Priority 3: Global default (lowest priority)
    const mode = context.modeConfig.default;
    
    if (!isValidPolicyMode(mode)) {
      throw new InvalidConfigurationError(
        `Invalid default mode: ${mode}`
      );
    }
    
    const resolutionTimeMs = performance.now() - startTime;
    return {
      mode,
      source: 'default',
      resolutionTimeMs
    };
  }
  
  /**
   * Validates mode configuration at initialization
   * Throws InvalidConfigurationError if configuration is invalid
   * 
   * @param config - Mode configuration to validate
   * @throws {InvalidConfigurationError} if configuration is invalid
   */
  static validateModeConfiguration(config: ModeConfig): void {
    validateModeConfig(config);
    
    // Additional validation: check that all policy-specific modes are valid
    if (config.policy) {
      for (const [policyId, mode] of Object.entries(config.policy)) {
        if (!isValidPolicyMode(mode)) {
          throw new InvalidConfigurationError(
            `Invalid policy-specific mode for policy '${policyId}': ${mode}`
          );
        }
      }
    }
    
    // Additional validation: check that all environment-specific modes are valid
    if (config.environment) {
      for (const [env, mode] of Object.entries(config.environment)) {
        if (!isValidPolicyMode(mode)) {
          throw new InvalidConfigurationError(
            `Invalid environment-specific mode for environment '${env}': ${mode}`
          );
        }
      }
    }
  }
  
  /**
   * Gets the effective mode for a policy without metadata
   * Convenience method that returns only the mode
   * 
   * @param context - Mode resolution context
   * @returns Resolved policy mode
   */
  static getEffectiveMode(context: ModeResolutionContext): PolicyMode {
    const result = this.resolvePolicyMode(context);
    return result.mode;
  }
  
  /**
   * Checks if a mode configuration has any overrides
   * 
   * @param config - Mode configuration
   * @returns true if configuration has policy or environment overrides
   */
  static hasOverrides(config: ModeConfig): boolean {
    return !!(
      (config.policy && Object.keys(config.policy).length > 0) ||
      (config.environment && Object.keys(config.environment).length > 0)
    );
  }
  
  /**
   * Gets all policies with specific mode overrides
   * 
   * @param config - Mode configuration
   * @returns Array of policy IDs with specific mode overrides
   */
  static getPoliciesWithOverrides(config: ModeConfig): string[] {
    if (!config.policy) {
      return [];
    }
    return Object.keys(config.policy);
  }
  
  /**
   * Gets all environments with specific mode overrides
   * 
   * @param config - Mode configuration
   * @returns Array of environment names with specific mode overrides
   */
  static getEnvironmentsWithOverrides(config: ModeConfig): string[] {
    if (!config.environment) {
      return [];
    }
    return Object.keys(config.environment);
  }
}

/**
 * Resolves policy mode (standalone function for convenience)
 * 
 * @param policyId - Policy ID being evaluated
 * @param modeConfig - Mode configuration
 * @param environment - Optional environment name
 * @returns Resolved policy mode
 */
export function resolvePolicyMode(
  policyId: string,
  modeConfig: ModeConfig,
  environment?: string
): PolicyMode {
  return ModeResolver.getEffectiveMode({
    policyId,
    modeConfig,
    environment
  });
}

// Export types and utilities
export {
  PolicyMode,
  ModeConfig,
  InvalidConfigurationError,
  isValidPolicyMode,
  validateModeConfig
};
