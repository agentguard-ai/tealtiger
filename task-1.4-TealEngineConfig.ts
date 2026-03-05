/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.1: Policy Rollout Modes - TealEngineConfig Extension
 * 
 * Extends TealEngineConfig to support ModeConfig for policy rollout modes
 * 
 * @module core/engine/TealEngineConfig
 * @version 1.1.0
 */

import { 
  PolicyMode, 
  ModeConfig, 
  InvalidConfigurationError,
  validateModeConfig
} from './task-1.1-types';
import { ModeResolver } from './task-1.3-ModeResolver';

/**
 * TealTiger policy configuration
 * Placeholder for actual policy structure
 */
export interface TealPolicy {
  /** Policy rules and constraints */
  [key: string]: any;
}

/**
 * Cache configuration for TealEngine
 */
export interface CacheConfig {
  /** Enable/disable caching */
  enabled?: boolean;
  
  /** Cache TTL in milliseconds */
  ttl?: number;
  
  /** Maximum cache size (number of entries) */
  maxSize?: number;
}

/**
 * TealEngine configuration with mode support
 * 
 * @interface TealEngineConfig
 */
export interface TealEngineConfig {
  /** Policy configuration */
  policies: TealPolicy;
  
  /** Mode configuration (optional, defaults to ENFORCE) */
  mode?: ModeConfig;
  
  /** Cache configuration (optional) */
  cache?: CacheConfig;
  
  /** @deprecated Use cache.ttl instead */
  cacheTTL?: number;
  
  /** @deprecated Use cache.enabled instead */
  cacheEnabled?: boolean;
  
  /** @deprecated Use cache.maxSize instead */
  cacheMaxSize?: number;
}

/**
 * Default mode configuration
 * Used when no mode configuration is provided
 */
export const DEFAULT_MODE_CONFIG: ModeConfig = {
  default: PolicyMode.ENFORCE
};

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 60000, // 60 seconds
  maxSize: 1000
};

/**
 * TealEngine class with mode support
 * 
 * This is a minimal implementation for Task 1.4.
 * Full implementation will be completed in Phase 2.
 */
export class TealEngine {
  private readonly policies: TealPolicy;
  private readonly modeConfig: ModeConfig;
  private readonly cacheConfig: CacheConfig;
  
  /**
   * Creates a new TealEngine instance
   * 
   * @param config - TealEngine configuration
   * @throws {InvalidConfigurationError} if configuration is invalid
   */
  constructor(config: TealEngineConfig) {
    // Validate required fields
    if (!config) {
      throw new InvalidConfigurationError('TealEngineConfig is required');
    }
    
    if (!config.policies) {
      throw new InvalidConfigurationError('TealEngineConfig.policies is required');
    }
    
    // Store policies
    this.policies = config.policies;
    
    // Initialize mode configuration
    this.modeConfig = this.initializeModeConfig(config);
    
    // Initialize cache configuration
    this.cacheConfig = this.initializeCacheConfig(config);
    
    // Validate mode configuration
    ModeResolver.validateModeConfiguration(this.modeConfig);
  }
  
  /**
   * Initializes mode configuration from TealEngineConfig
   * Handles backwards compatibility with deprecated fields
   * 
   * @param config - TealEngine configuration
   * @returns Initialized mode configuration
   * @private
   */
  private initializeModeConfig(config: TealEngineConfig): ModeConfig {
    // If mode configuration is provided, use it
    if (config.mode) {
      return config.mode;
    }
    
    // Otherwise, use default (ENFORCE mode)
    return DEFAULT_MODE_CONFIG;
  }
  
  /**
   * Initializes cache configuration from TealEngineConfig
   * Handles backwards compatibility with deprecated fields
   * 
   * @param config - TealEngine configuration
   * @returns Initialized cache configuration
   * @private
   */
  private initializeCacheConfig(config: TealEngineConfig): CacheConfig {
    // If cache configuration is provided, use it
    if (config.cache) {
      return {
        enabled: config.cache.enabled ?? DEFAULT_CACHE_CONFIG.enabled,
        ttl: config.cache.ttl ?? DEFAULT_CACHE_CONFIG.ttl,
        maxSize: config.cache.maxSize ?? DEFAULT_CACHE_CONFIG.maxSize
      };
    }
    
    // Handle deprecated fields for backwards compatibility
    if (config.cacheEnabled !== undefined || 
        config.cacheTTL !== undefined || 
        config.cacheMaxSize !== undefined) {
      return {
        enabled: config.cacheEnabled ?? DEFAULT_CACHE_CONFIG.enabled,
        ttl: config.cacheTTL ?? DEFAULT_CACHE_CONFIG.ttl,
        maxSize: config.cacheMaxSize ?? DEFAULT_CACHE_CONFIG.maxSize
      };
    }
    
    // Use defaults
    return DEFAULT_CACHE_CONFIG;
  }
  
  /**
   * Gets the current mode configuration
   * 
   * @returns Mode configuration
   */
  getModeConfig(): ModeConfig {
    return { ...this.modeConfig };
  }
  
  /**
   * Gets the current cache configuration
   * 
   * @returns Cache configuration
   */
  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }
  
  /**
   * Gets the policies
   * 
   * @returns Policy configuration
   */
  getPolicies(): TealPolicy {
    return this.policies;
  }
  
  /**
   * Checks if mode configuration has any overrides
   * 
   * @returns true if configuration has policy or environment overrides
   */
  hasModeOverrides(): boolean {
    return ModeResolver.hasOverrides(this.modeConfig);
  }
  
  /**
   * Gets all policies with specific mode overrides
   * 
   * @returns Array of policy IDs with specific mode overrides
   */
  getPoliciesWithModeOverrides(): string[] {
    return ModeResolver.getPoliciesWithOverrides(this.modeConfig);
  }
  
  /**
   * Gets all environments with specific mode overrides
   * 
   * @returns Array of environment names with specific mode overrides
   */
  getEnvironmentsWithModeOverrides(): string[] {
    return ModeResolver.getEnvironmentsWithOverrides(this.modeConfig);
  }
  
  /**
   * Gets the effective mode for a specific policy
   * 
   * @param policyId - Policy ID
   * @param environment - Optional environment name
   * @returns Resolved policy mode
   */
  getEffectiveMode(policyId: string, environment?: string): PolicyMode {
    return ModeResolver.getEffectiveMode({
      policyId,
      environment,
      modeConfig: this.modeConfig
    });
  }
  
  /**
   * Placeholder for evaluate method
   * Full implementation will be completed in Task 2.1
   * 
   * @param context - Request context
   * @returns Decision object (placeholder)
   */
  evaluate(context: any): any {
    throw new Error('TealEngine.evaluate() not yet implemented. Will be completed in Task 2.1.');
  }
}

/**
 * Creates a TealEngine instance with validation
 * 
 * @param config - TealEngine configuration
 * @returns TealEngine instance
 * @throws {InvalidConfigurationError} if configuration is invalid
 */
export function createTealEngine(config: TealEngineConfig): TealEngine {
  return new TealEngine(config);
}

/**
 * Validates TealEngine configuration without creating an instance
 * 
 * @param config - TealEngine configuration to validate
 * @throws {InvalidConfigurationError} if configuration is invalid
 */
export function validateTealEngineConfig(config: TealEngineConfig): void {
  if (!config) {
    throw new InvalidConfigurationError('TealEngineConfig is required');
  }
  
  if (!config.policies) {
    throw new InvalidConfigurationError('TealEngineConfig.policies is required');
  }
  
  // Validate mode configuration if provided
  if (config.mode) {
    validateModeConfig(config.mode);
  }
}

// Export types and utilities
export {
  PolicyMode,
  ModeConfig,
  InvalidConfigurationError,
  ModeResolver
};
