/**
 * Configuration Management for AgentGuard SDK
 * 
 * This file handles SDK configuration with defaults and validation
 */

import { AgentGuardConfig } from '../types';
import { validateConfig } from '../utils/validation';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<AgentGuardConfig> = {
  timeout: 5000,
  retries: 3,
  debug: false,
  headers: {}
};

/**
 * Configuration manager class
 */
export class Configuration {
  private config: AgentGuardConfig;

  constructor(userConfig: Partial<AgentGuardConfig>) {
    // Merge user config with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...userConfig
    } as AgentGuardConfig;

    // Validate the final configuration
    validateConfig(this.config);

    // Generate agent ID if not provided
    if (!this.config.agentId) {
      this.config.agentId = this.generateAgentId();
    }
  }

  /**
   * Get the complete configuration
   */
  getConfig(): AgentGuardConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof AgentGuardConfig>(key: K): AgentGuardConfig[K] {
    const value = this.config[key];
    
    // Deep clone objects to prevent external modification
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return JSON.parse(JSON.stringify(value)) as AgentGuardConfig[K];
    }
    
    return value;
  }

  /**
   * Update configuration (creates new instance)
   */
  update(updates: Partial<AgentGuardConfig>): Configuration {
    const newConfig = {
      ...this.config,
      ...updates
    };
    return new Configuration(newConfig);
  }

  /**
   * Generate a unique agent ID
   */
  private generateAgentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `agent-${timestamp}-${random}`;
  }

  /**
   * Get configuration for safe logging (without sensitive data)
   */
  getSafeConfig(): Partial<AgentGuardConfig> {
    const safeConfig: Partial<AgentGuardConfig> = {
      ssaUrl: this.config.ssaUrl
    };

    if (this.config.agentId !== undefined) {
      safeConfig.agentId = this.config.agentId;
    }

    if (this.config.timeout !== undefined) {
      safeConfig.timeout = this.config.timeout;
    }

    if (this.config.retries !== undefined) {
      safeConfig.retries = this.config.retries;
    }

    if (this.config.debug !== undefined) {
      safeConfig.debug = this.config.debug;
    }

    if (this.config.apiKey !== undefined) {
      safeConfig.apiKey = `${this.config.apiKey.substring(0, 10)}...`;
    }

    return safeConfig;
  }
}