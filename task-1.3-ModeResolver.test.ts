/**
 * TealTiger SDK v1.1.x - Enterprise Adoption Features
 * P0.1: Policy Rollout Modes - Mode Resolution Algorithm Tests
 * 
 * @module core/engine/ModeResolver.test
 * @version 1.1.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModeResolver,
  resolvePolicyMode,
  PolicyMode,
  ModeConfig,
  InvalidConfigurationError,
  ModeResolutionContext
} from './task-1.3-ModeResolver';

describe('ModeResolver', () => {
  describe('resolvePolicyMode', () => {
    describe('Priority 1: Policy-specific override', () => {
      it('should use policy-specific mode when available', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.MONITOR
          },
          policy: {
            'test-policy': PolicyMode.REPORT_ONLY
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy',
          environment: 'production',
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.REPORT_ONLY);
        expect(result.source).toBe('policy');
        expect(result.resolutionTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.resolutionTimeMs).toBeLessThan(1); // Performance target: < 1ms
      });
      
      it('should prioritize policy-specific over environment-specific', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'staging': PolicyMode.MONITOR
          },
          policy: {
            'critical-policy': PolicyMode.ENFORCE
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'critical-policy',
          environment: 'staging',
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.ENFORCE);
        expect(result.source).toBe('policy');
      });
      
      it('should prioritize policy-specific over global default', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          policy: {
            'test-policy': PolicyMode.MONITOR
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy',
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.MONITOR);
        expect(result.source).toBe('policy');
      });
    });
    
    describe('Priority 2: Environment-specific override', () => {
      it('should use environment-specific mode when no policy override exists', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'development': PolicyMode.MONITOR
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'any-policy',
          environment: 'development',
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.MONITOR);
        expect(result.source).toBe('environment');
      });
      
      it('should prioritize environment-specific over global default', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'staging': PolicyMode.REPORT_ONLY
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy',
          environment: 'staging',
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.REPORT_ONLY);
        expect(result.source).toBe('environment');
      });
      
      it('should fall back to default when environment not in config', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.MONITOR
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy',
          environment: 'staging', // Not in config
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.ENFORCE);
        expect(result.source).toBe('default');
      });
    });
    
    describe('Priority 3: Global default', () => {
      it('should use global default when no overrides exist', () => {
        const config: ModeConfig = {
          default: PolicyMode.MONITOR
        };
        
        const context: ModeResolutionContext = {
          policyId: 'any-policy',
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.MONITOR);
        expect(result.source).toBe('default');
      });
      
      it('should use global default when policy not in overrides', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          policy: {
            'other-policy': PolicyMode.MONITOR
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy', // Not in policy overrides
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.ENFORCE);
        expect(result.source).toBe('default');
      });
      
      it('should use global default when environment is undefined', () => {
        const config: ModeConfig = {
          default: PolicyMode.REPORT_ONLY,
          environment: {
            'production': PolicyMode.ENFORCE
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy',
          environment: undefined, // No environment specified
          modeConfig: config
        };
        
        const result = ModeResolver.resolvePolicyMode(context);
        
        expect(result.mode).toBe(PolicyMode.REPORT_ONLY);
        expect(result.source).toBe('default');
      });
    });
    
    describe('Determinism', () => {
      it('should return same mode for same inputs (deterministic)', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.MONITOR
          },
          policy: {
            'test-policy': PolicyMode.REPORT_ONLY
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'test-policy',
          environment: 'production',
          modeConfig: config
        };
        
        const result1 = ModeResolver.resolvePolicyMode(context);
        const result2 = ModeResolver.resolvePolicyMode(context);
        const result3 = ModeResolver.resolvePolicyMode(context);
        
        expect(result1.mode).toBe(result2.mode);
        expect(result2.mode).toBe(result3.mode);
        expect(result1.source).toBe(result2.source);
        expect(result2.source).toBe(result3.source);
      });
      
      it('should be deterministic across different policy IDs', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          policy: {
            'policy-a': PolicyMode.MONITOR,
            'policy-b': PolicyMode.REPORT_ONLY
          }
        };
        
        const contextA: ModeResolutionContext = {
          policyId: 'policy-a',
          modeConfig: config
        };
        
        const contextB: ModeResolutionContext = {
          policyId: 'policy-b',
          modeConfig: config
        };
        
        const resultA1 = ModeResolver.resolvePolicyMode(contextA);
        const resultA2 = ModeResolver.resolvePolicyMode(contextA);
        const resultB1 = ModeResolver.resolvePolicyMode(contextB);
        const resultB2 = ModeResolver.resolvePolicyMode(contextB);
        
        expect(resultA1.mode).toBe(resultA2.mode);
        expect(resultB1.mode).toBe(resultB2.mode);
        expect(resultA1.mode).toBe(PolicyMode.MONITOR);
        expect(resultB1.mode).toBe(PolicyMode.REPORT_ONLY);
      });
    });
    
    describe('Performance', () => {
      it('should resolve mode in less than 1ms (p99 target)', () => {
        const config: ModeConfig = {
          default: PolicyMode.ENFORCE,
          environment: {
            'production': PolicyMode.MONITOR,
            'staging': PolicyMode.REPORT_ONLY,
            'development': PolicyMode.MONITOR
          },
          policy: {
            'policy-1': PolicyMode.ENFORCE,
            'policy-2': PolicyMode.MONITOR,
            'policy-3': PolicyMode.REPORT_ONLY
          }
        };
        
        const context: ModeResolutionContext = {
          policyId: 'policy-2',
          environment: 'production',
          modeConfig: config
        };
        
        // Run 100 iterations to get p99
        const times: number[] = [];
        for (let i = 0; i < 100; i++) {
          const result = ModeResolver.resolvePolicyMode(context);
          times.push(result.resolutionTimeMs);
        }
        
        // Calculate p99
        times.sort((a, b) => a - b);
        const p99Index = Math.floor(times.length * 0.99);
        const p99Time = times[p99Index];
        
        expect(p99Time).toBeLessThan(1); // Performance target: < 1ms at p99
      });
    });
  });
  
  describe('validateModeConfiguration', () => {
    it('should validate valid configuration', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {
          'production': PolicyMode.MONITOR
        },
        policy: {
          'test-policy': PolicyMode.REPORT_ONLY
        }
      };
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).not.toThrow();
    });
    
    it('should throw InvalidConfigurationError for invalid default mode', () => {
      const config = {
        default: 'INVALID_MODE'
      } as any;
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).toThrow(InvalidConfigurationError);
    });
    
    it('should throw InvalidConfigurationError for invalid policy-specific mode', () => {
      const config = {
        default: PolicyMode.ENFORCE,
        policy: {
          'test-policy': 'INVALID_MODE'
        }
      } as any;
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).toThrow(InvalidConfigurationError);
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).toThrow(/Invalid.*mode for policy/);
    });
    
    it('should throw InvalidConfigurationError for invalid environment-specific mode', () => {
      const config = {
        default: PolicyMode.ENFORCE,
        environment: {
          'production': 'INVALID_MODE'
        }
      } as any;
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).toThrow(InvalidConfigurationError);
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).toThrow(/Invalid.*mode for environment/);
    });
    
    it('should throw InvalidConfigurationError for missing default mode', () => {
      const config = {
        environment: {
          'production': PolicyMode.MONITOR
        }
      } as any;
      
      expect(() => {
        ModeResolver.validateModeConfiguration(config);
      }).toThrow(InvalidConfigurationError);
    });
  });
  
  describe('getEffectiveMode', () => {
    it('should return only the mode without metadata', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        policy: {
          'test-policy': PolicyMode.MONITOR
        }
      };
      
      const context: ModeResolutionContext = {
        policyId: 'test-policy',
        modeConfig: config
      };
      
      const mode = ModeResolver.getEffectiveMode(context);
      
      expect(mode).toBe(PolicyMode.MONITOR);
      expect(typeof mode).toBe('string');
    });
  });
  
  describe('hasOverrides', () => {
    it('should return true when policy overrides exist', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        policy: {
          'test-policy': PolicyMode.MONITOR
        }
      };
      
      expect(ModeResolver.hasOverrides(config)).toBe(true);
    });
    
    it('should return true when environment overrides exist', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {
          'production': PolicyMode.MONITOR
        }
      };
      
      expect(ModeResolver.hasOverrides(config)).toBe(true);
    });
    
    it('should return true when both overrides exist', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {
          'production': PolicyMode.MONITOR
        },
        policy: {
          'test-policy': PolicyMode.REPORT_ONLY
        }
      };
      
      expect(ModeResolver.hasOverrides(config)).toBe(true);
    });
    
    it('should return false when no overrides exist', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE
      };
      
      expect(ModeResolver.hasOverrides(config)).toBe(false);
    });
    
    it('should return false when overrides are empty objects', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {},
        policy: {}
      };
      
      expect(ModeResolver.hasOverrides(config)).toBe(false);
    });
  });
  
  describe('getPoliciesWithOverrides', () => {
    it('should return array of policy IDs with overrides', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        policy: {
          'policy-a': PolicyMode.MONITOR,
          'policy-b': PolicyMode.REPORT_ONLY,
          'policy-c': PolicyMode.ENFORCE
        }
      };
      
      const policies = ModeResolver.getPoliciesWithOverrides(config);
      
      expect(policies).toHaveLength(3);
      expect(policies).toContain('policy-a');
      expect(policies).toContain('policy-b');
      expect(policies).toContain('policy-c');
    });
    
    it('should return empty array when no policy overrides exist', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE
      };
      
      const policies = ModeResolver.getPoliciesWithOverrides(config);
      
      expect(policies).toHaveLength(0);
    });
  });
  
  describe('getEnvironmentsWithOverrides', () => {
    it('should return array of environment names with overrides', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {
          'production': PolicyMode.MONITOR,
          'staging': PolicyMode.REPORT_ONLY,
          'development': PolicyMode.MONITOR
        }
      };
      
      const environments = ModeResolver.getEnvironmentsWithOverrides(config);
      
      expect(environments).toHaveLength(3);
      expect(environments).toContain('production');
      expect(environments).toContain('staging');
      expect(environments).toContain('development');
    });
    
    it('should return empty array when no environment overrides exist', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE
      };
      
      const environments = ModeResolver.getEnvironmentsWithOverrides(config);
      
      expect(environments).toHaveLength(0);
    });
  });
  
  describe('resolvePolicyMode (standalone function)', () => {
    it('should resolve mode using standalone function', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        policy: {
          'test-policy': PolicyMode.MONITOR
        }
      };
      
      const mode = resolvePolicyMode('test-policy', config);
      
      expect(mode).toBe(PolicyMode.MONITOR);
    });
    
    it('should support optional environment parameter', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {
          'production': PolicyMode.MONITOR
        }
      };
      
      const mode = resolvePolicyMode('any-policy', config, 'production');
      
      expect(mode).toBe(PolicyMode.MONITOR);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty policy overrides object', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        policy: {}
      };
      
      const context: ModeResolutionContext = {
        policyId: 'test-policy',
        modeConfig: config
      };
      
      const result = ModeResolver.resolvePolicyMode(context);
      
      expect(result.mode).toBe(PolicyMode.ENFORCE);
      expect(result.source).toBe('default');
    });
    
    it('should handle empty environment overrides object', () => {
      const config: ModeConfig = {
        default: PolicyMode.MONITOR,
        environment: {}
      };
      
      const context: ModeResolutionContext = {
        policyId: 'test-policy',
        environment: 'production',
        modeConfig: config
      };
      
      const result = ModeResolver.resolvePolicyMode(context);
      
      expect(result.mode).toBe(PolicyMode.MONITOR);
      expect(result.source).toBe('default');
    });
    
    it('should handle special characters in policy IDs', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        policy: {
          'tools.file_delete': PolicyMode.MONITOR,
          'identity.admin_access': PolicyMode.ENFORCE
        }
      };
      
      const context: ModeResolutionContext = {
        policyId: 'tools.file_delete',
        modeConfig: config
      };
      
      const result = ModeResolver.resolvePolicyMode(context);
      
      expect(result.mode).toBe(PolicyMode.MONITOR);
      expect(result.source).toBe('policy');
    });
    
    it('should handle special characters in environment names', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE,
        environment: {
          'prod-us-east-1': PolicyMode.MONITOR,
          'staging_v2': PolicyMode.REPORT_ONLY
        }
      };
      
      const context: ModeResolutionContext = {
        policyId: 'test-policy',
        environment: 'prod-us-east-1',
        modeConfig: config
      };
      
      const result = ModeResolver.resolvePolicyMode(context);
      
      expect(result.mode).toBe(PolicyMode.MONITOR);
      expect(result.source).toBe('environment');
    });
  });
  
  describe('All PolicyMode values', () => {
    it('should support ENFORCE mode', () => {
      const config: ModeConfig = {
        default: PolicyMode.ENFORCE
      };
      
      const mode = resolvePolicyMode('test-policy', config);
      
      expect(mode).toBe(PolicyMode.ENFORCE);
    });
    
    it('should support MONITOR mode', () => {
      const config: ModeConfig = {
        default: PolicyMode.MONITOR
      };
      
      const mode = resolvePolicyMode('test-policy', config);
      
      expect(mode).toBe(PolicyMode.MONITOR);
    });
    
    it('should support REPORT_ONLY mode', () => {
      const config: ModeConfig = {
        default: PolicyMode.REPORT_ONLY
      };
      
      const mode = resolvePolicyMode('test-policy', config);
      
      expect(mode).toBe(PolicyMode.REPORT_ONLY);
    });
  });
});
