/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.1: Policy Rollout Modes - TealEngineConfig Extension Tests
 * 
 * @module core/engine/TealEngineConfig.test
 * @version 1.1.0
 */

import { describe, it, expect } from 'vitest';
import {
  TealEngine,
  TealEngineConfig,
  createTealEngine,
  validateTealEngineConfig,
  DEFAULT_MODE_CONFIG,
  DEFAULT_CACHE_CONFIG,
  PolicyMode,
  ModeConfig,
  InvalidConfigurationError
} from './task-1.4-TealEngineConfig';

describe('TealEngineConfig', () => {
  describe('TealEngine constructor', () => {
    it('should create TealEngine with minimal configuration', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        }
      };
      
      const engine = new TealEngine(config);
      
      expect(engine).toBeDefined();
      expect(engine.getPolicies()).toEqual(config.policies);
    });
    
    it('should create TealEngine with mode configuration', () => {
      const modeConfig: ModeConfig = {
        default: PolicyMode.MONITOR,
        policy: {
          'critical-policy': PolicyMode.ENFORCE
        }
      };
      
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: modeConfig
      };
      
      const engine = new TealEngine(config);
      
      expect(engine.getModeConfig()).toEqual(modeConfig);
    });
    
    it('should use default mode configuration when not provided', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        }
      };
      
      const engine = new TealEngine(config);
      
      expect(engine.getModeConfig()).toEqual(DEFAULT_MODE_CONFIG);
      expect(engine.getModeConfig().default).toBe(PolicyMode.ENFORCE);
    });
    
    it('should throw InvalidConfigurationError when config is missing', () => {
      expect(() => {
        new TealEngine(null as any);
      }).toThrow(InvalidConfigurationError);
      
      expect(() => {
        new TealEngine(null as any);
      }).toThrow('TealEngineConfig is required');
    });
    
    it('should throw InvalidConfigurationError when policies are missing', () => {
      const config = {} as any;
      
      expect(() => {
        new TealEngine(config);
      }).toThrow(InvalidConfigurationError);
      
      expect(() => {
        new TealEngine(config);
      }).toThrow('TealEngineConfig.policies is required');
    });
    
    it('should throw InvalidConfigurationError for invalid mode configuration', () => {
      const config = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: 'INVALID_MODE'
        }
      } as any;
      
      expect(() => {
        new TealEngine(config);
      }).toThrow(InvalidConfigurationError);
    });
    
    it('should validate mode configuration at initialization', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          policy: {
            'test-policy': PolicyMode.MONITOR
          }
        }
      };
      
      // Should not throw
      expect(() => {
        new TealEngine(config);
      }).not.toThrow();
    });
  });
  
  describe('getModeConfig', () => {
    it('should return mode configuration', () => {
      const modeConfig: ModeConfig = {
        default: PolicyMode.MONITOR,
        environment: {
          'production': PolicyMode.ENFORCE
        }
      };
      
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: modeConfig
      };
      
      const engine = new TealEngine(config);
      const retrievedConfig = engine.getModeConfig();
      
      expect(retrievedConfig).toEqual(modeConfig);
      expect(retrievedConfig.default).toBe(PolicyMode.MONITOR);
      expect(retrievedConfig.environment?.['production']).toBe(PolicyMode.ENFORCE);
    });
    
    it('should return a copy of mode configuration (immutability)', () => {
      const modeConfig: ModeConfig = {
        default: PolicyMode.ENFORCE
      };
      
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: modeConfig
      };
      
      const engine = new TealEngine(config);
      const retrievedConfig1 = engine.getModeConfig();
      const retrievedConfig2 = engine.getModeConfig();
      
      // Should be equal but not the same reference
      expect(retrievedConfig1).toEqual(retrievedConfig2);
      expect(retrievedConfig1).not.toBe(retrievedConfig2);
    });
  });
  
  describe('getCacheConfig', () => {
    it('should return cache configuration', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cache: {
          enabled: true,
          ttl: 30000,
          maxSize: 500
        }
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.enabled).toBe(true);
      expect(cacheConfig.ttl).toBe(30000);
      expect(cacheConfig.maxSize).toBe(500);
    });
    
    it('should use default cache configuration when not provided', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        }
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig).toEqual(DEFAULT_CACHE_CONFIG);
    });
    
    it('should handle partial cache configuration', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cache: {
          ttl: 45000
        }
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.enabled).toBe(DEFAULT_CACHE_CONFIG.enabled);
      expect(cacheConfig.ttl).toBe(45000);
      expect(cacheConfig.maxSize).toBe(DEFAULT_CACHE_CONFIG.maxSize);
    });
  });
  
  describe('Backwards compatibility', () => {
    it('should support deprecated cacheTTL field', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cacheTTL: 90000
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.ttl).toBe(90000);
    });
    
    it('should support deprecated cacheEnabled field', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cacheEnabled: false
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.enabled).toBe(false);
    });
    
    it('should support deprecated cacheMaxSize field', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cacheMaxSize: 2000
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.maxSize).toBe(2000);
    });
    
    it('should support all deprecated cache fields together', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cacheEnabled: true,
        cacheTTL: 120000,
        cacheMaxSize: 3000
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.enabled).toBe(true);
      expect(cacheConfig.ttl).toBe(120000);
      expect(cacheConfig.maxSize).toBe(3000);
    });
    
    it('should prefer new cache config over deprecated fields', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        cache: {
          enabled: false,
          ttl: 30000,
          maxSize: 500
        },
        cacheEnabled: true, // Should be ignored
        cacheTTL: 60000, // Should be ignored
        cacheMaxSize: 1000 // Should be ignored
      };
      
      const engine = new TealEngine(config);
      const cacheConfig = engine.getCacheConfig();
      
      expect(cacheConfig.enabled).toBe(false);
      expect(cacheConfig.ttl).toBe(30000);
      expect(cacheConfig.maxSize).toBe(500);
    });
    
    it('should work without mode configuration (backwards compatible)', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        }
      };
      
      // Should not throw
      const engine = new TealEngine(config);
      
      // Should use default ENFORCE mode
      expect(engine.getModeConfig().default).toBe(PolicyMode.ENFORCE);
    });
  });
  
  describe('hasModeOverrides', () => {
    it('should return true when policy overrides exist', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          policy: {
            'test-policy': PolicyMode.MONITOR
          }
        }
      };
      
      const engine = new TealEngine(config);
      
      expect(engine.hasModeOverrides()).toBe(true);
    });
    
    it('should return true when environment overrides exist', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.MONITOR
          }
        }
      };
      
      const engine = new TealEngine(config);
      
      expect(engine.hasModeOverrides()).toBe(true);
    });
    
    it('should return false when no overrides exist', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE
        }
      };
      
      const engine = new TealEngine(config);
      
      expect(engine.hasModeOverrides()).toBe(false);
    });
  });
  
  describe('getPoliciesWithModeOverrides', () => {
    it('should return array of policy IDs with overrides', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          policy: {
            'policy-a': PolicyMode.MONITOR,
            'policy-b': PolicyMode.REPORT_ONLY
          }
        }
      };
      
      const engine = new TealEngine(config);
      const policies = engine.getPoliciesWithModeOverrides();
      
      expect(policies).toHaveLength(2);
      expect(policies).toContain('policy-a');
      expect(policies).toContain('policy-b');
    });
    
    it('should return empty array when no policy overrides exist', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE
        }
      };
      
      const engine = new TealEngine(config);
      const policies = engine.getPoliciesWithModeOverrides();
      
      expect(policies).toHaveLength(0);
    });
  });
  
  describe('getEnvironmentsWithModeOverrides', () => {
    it('should return array of environment names with overrides', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.MONITOR,
            'staging': PolicyMode.REPORT_ONLY
          }
        }
      };
      
      const engine = new TealEngine(config);
      const environments = engine.getEnvironmentsWithModeOverrides();
      
      expect(environments).toHaveLength(2);
      expect(environments).toContain('production');
      expect(environments).toContain('staging');
    });
    
    it('should return empty array when no environment overrides exist', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE
        }
      };
      
      const engine = new TealEngine(config);
      const environments = engine.getEnvironmentsWithModeOverrides();
      
      expect(environments).toHaveLength(0);
    });
  });
  
  describe('getEffectiveMode', () => {
    it('should return effective mode for a policy', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          policy: {
            'test-policy': PolicyMode.MONITOR
          }
        }
      };
      
      const engine = new TealEngine(config);
      const mode = engine.getEffectiveMode('test-policy');
      
      expect(mode).toBe(PolicyMode.MONITOR);
    });
    
    it('should return effective mode with environment', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          environment: {
            'staging': PolicyMode.REPORT_ONLY
          }
        }
      };
      
      const engine = new TealEngine(config);
      const mode = engine.getEffectiveMode('any-policy', 'staging');
      
      expect(mode).toBe(PolicyMode.REPORT_ONLY);
    });
    
    it('should return default mode when no overrides match', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE
        }
      };
      
      const engine = new TealEngine(config);
      const mode = engine.getEffectiveMode('any-policy');
      
      expect(mode).toBe(PolicyMode.ENFORCE);
    });
  });
  
  describe('createTealEngine', () => {
    it('should create TealEngine instance', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        }
      };
      
      const engine = createTealEngine(config);
      
      expect(engine).toBeInstanceOf(TealEngine);
    });
    
    it('should throw InvalidConfigurationError for invalid config', () => {
      const config = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: 'INVALID_MODE'
        }
      } as any;
      
      expect(() => {
        createTealEngine(config);
      }).toThrow(InvalidConfigurationError);
    });
  });
  
  describe('validateTealEngineConfig', () => {
    it('should validate valid configuration', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE
        }
      };
      
      expect(() => {
        validateTealEngineConfig(config);
      }).not.toThrow();
    });
    
    it('should throw InvalidConfigurationError when config is missing', () => {
      expect(() => {
        validateTealEngineConfig(null as any);
      }).toThrow(InvalidConfigurationError);
      
      expect(() => {
        validateTealEngineConfig(null as any);
      }).toThrow('TealEngineConfig is required');
    });
    
    it('should throw InvalidConfigurationError when policies are missing', () => {
      const config = {} as any;
      
      expect(() => {
        validateTealEngineConfig(config);
      }).toThrow(InvalidConfigurationError);
      
      expect(() => {
        validateTealEngineConfig(config);
      }).toThrow('TealEngineConfig.policies is required');
    });
    
    it('should throw InvalidConfigurationError for invalid mode configuration', () => {
      const config = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: 'INVALID_MODE'
        }
      } as any;
      
      expect(() => {
        validateTealEngineConfig(config);
      }).toThrow(InvalidConfigurationError);
    });
    
    it('should validate without throwing for config without mode', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        }
      };
      
      expect(() => {
        validateTealEngineConfig(config);
      }).not.toThrow();
    });
  });
  
  describe('Complex configurations', () => {
    it('should handle complex mode configuration', () => {
      const config: TealEngineConfig = {
        policies: {
          'policy-1': { allowed: true },
          'policy-2': { allowed: false },
          'policy-3': { allowed: true }
        },
        mode: {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.ENFORCE,
            'staging': PolicyMode.MONITOR,
            'development': PolicyMode.REPORT_ONLY
          },
          policy: {
            'policy-1': PolicyMode.MONITOR,
            'policy-2': PolicyMode.ENFORCE
          }
        }
      };
      
      const engine = new TealEngine(config);
      
      // Policy-specific override
      expect(engine.getEffectiveMode('policy-1')).toBe(PolicyMode.MONITOR);
      expect(engine.getEffectiveMode('policy-2')).toBe(PolicyMode.ENFORCE);
      
      // Environment-specific override
      expect(engine.getEffectiveMode('policy-3', 'staging')).toBe(PolicyMode.MONITOR);
      expect(engine.getEffectiveMode('policy-3', 'development')).toBe(PolicyMode.REPORT_ONLY);
      
      // Default
      expect(engine.getEffectiveMode('policy-3')).toBe(PolicyMode.ENFORCE);
    });
    
    it('should handle configuration with all features', () => {
      const config: TealEngineConfig = {
        policies: {
          'test-policy': { allowed: true }
        },
        mode: {
          default: PolicyMode.MONITOR,
          environment: {
            'production': PolicyMode.ENFORCE
          },
          policy: {
            'critical-policy': PolicyMode.ENFORCE
          }
        },
        cache: {
          enabled: true,
          ttl: 30000,
          maxSize: 500
        }
      };
      
      const engine = new TealEngine(config);
      
      expect(engine.getModeConfig().default).toBe(PolicyMode.MONITOR);
      expect(engine.getCacheConfig().ttl).toBe(30000);
      expect(engine.hasModeOverrides()).toBe(true);
    });
  });
});
