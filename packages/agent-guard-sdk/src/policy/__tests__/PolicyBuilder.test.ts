/**
 * PolicyBuilder Unit Tests
 */

import { createPolicy, PolicyTemplates } from '../PolicyBuilder';
import { AgentGuardValidationError } from '../../utils/errors';

describe('PolicyBuilder', () => {
  describe('Basic Policy Building', () => {
    it('should build a simple allow policy', () => {
      const policy = createPolicy()
        .name('test-policy')
        .description('Test policy')
        .priority(10)
        .whenToolName('web-search')
        .allow('Safe operation')
        .build();

      expect(policy.name).toBe('test-policy');
      expect(policy.description).toBe('Test policy');
      expect(policy.priority).toBe(10);
      expect(policy.action).toBe('allow');
      expect(policy.reason).toBe('Safe operation');
      expect(policy.conditions).toHaveLength(1);
      expect(policy.conditions[0]).toEqual({
        type: 'tool_name',
        pattern: 'web-search'
      });
    });

    it('should build a deny policy with multiple conditions', () => {
      const policy = createPolicy()
        .name('deny-policy')
        .whenToolName('system-*')
        .whenRiskLevel('>=', 'high')
        .deny('Too risky')
        .build();

      expect(policy.action).toBe('deny');
      expect(policy.conditions).toHaveLength(2);
      expect(policy.conditions[0].type).toBe('tool_name');
      expect(policy.conditions[1].type).toBe('risk_level');
    });

    it('should build a transform policy with parameter filtering', () => {
      const policy = createPolicy()
        .name('filter-policy')
        .whenParameterExists('password')
        .transformFilterParameters(['password', 'token'], 'Sensitive data removed')
        .build();

      expect(policy.action).toBe('transform');
      expect(policy.transformation).toEqual({
        type: 'parameter_filter',
        remove_parameters: ['password', 'token']
      });
    });
  });

  describe('Validation', () => {
    it('should require policy name', () => {
      expect(() => {
        createPolicy()
          .whenToolName('test')
          .allow()
          .build();
      }).toThrow(AgentGuardValidationError);
    });

    it('should require at least one condition', () => {
      expect(() => {
        createPolicy()
          .name('test')
          .allow()
          .build();
      }).toThrow(AgentGuardValidationError);
    });

    it('should require transformation for transform action', () => {
      const builder = createPolicy()
        .name('test')
        .whenToolName('test');
      
      // Manually set action without transformation
      (builder as any).policy.action = 'transform';
      
      expect(() => {
        builder.build();
      }).toThrow(AgentGuardValidationError);
    });

    it('should validate policy name format', () => {
      expect(() => {
        createPolicy().name('');
      }).toThrow(AgentGuardValidationError);

      expect(() => {
        createPolicy().name('   ');
      }).toThrow(AgentGuardValidationError);
    });

    it('should validate priority format', () => {
      expect(() => {
        createPolicy().priority(-1);
      }).toThrow(AgentGuardValidationError);

      expect(() => {
        createPolicy().priority(NaN);
      }).toThrow(AgentGuardValidationError);
    });
  });

  describe('Condition Building', () => {
    it('should add tool name conditions', () => {
      const policy = createPolicy()
        .name('test')
        .whenToolName('file-*')
        .allow()
        .build();

      expect(policy.conditions[0]).toEqual({
        type: 'tool_name',
        pattern: 'file-*'
      });
    });

    it('should add risk level conditions', () => {
      const policy = createPolicy()
        .name('test')
        .whenRiskLevel('>=', 'high')
        .deny()
        .build();

      expect(policy.conditions[0]).toEqual({
        type: 'risk_level',
        operator: '>=',
        value: 'high'
      });
    });

    it('should add agent ID conditions', () => {
      const policy = createPolicy()
        .name('test')
        .whenAgentId('admin-*')
        .allow()
        .build();

      expect(policy.conditions[0]).toEqual({
        type: 'agent_id',
        pattern: 'admin-*'
      });
    });

    it('should add parameter existence conditions', () => {
      const policy = createPolicy()
        .name('test')
        .whenParameterExists('sensitive_data')
        .deny()
        .build();

      expect(policy.conditions[0]).toEqual({
        type: 'parameter_exists',
        parameter: 'sensitive_data'
      });
    });

    it('should add parameter value conditions', () => {
      const policy = createPolicy()
        .name('test')
        .whenParameterEquals('mode', 'production')
        .deny()
        .build();

      expect(policy.conditions[0]).toEqual({
        type: 'parameter_value',
        parameter: 'mode',
        value: 'production'
      });
    });
  });

  describe('Transformation Building', () => {
    it('should create read-only transformation', () => {
      const policy = createPolicy()
        .name('test')
        .whenToolName('file-write')
        .transformToReadOnly('Convert to read-only')
        .build();

      expect(policy.transformation).toEqual({
        type: 'read_only'
      });
    });

    it('should create parameter filter transformation', () => {
      const policy = createPolicy()
        .name('test')
        .whenParameterExists('password')
        .transformFilterParameters(['password', 'secret'])
        .build();

      expect(policy.transformation).toEqual({
        type: 'parameter_filter',
        remove_parameters: ['password', 'secret']
      });
    });

    it('should create parameter anonymization transformation', () => {
      const policy = createPolicy()
        .name('test')
        .whenParameterExists('email')
        .transformAnonymizeParameters(['email', 'phone'])
        .build();

      expect(policy.transformation).toEqual({
        type: 'parameter_anonymize',
        anonymize_parameters: ['email', 'phone']
      });
    });
  });
});

describe('PolicyTemplates', () => {
  it('should generate allow low risk policy', () => {
    const policy = PolicyTemplates.allowLowRisk();
    
    expect(policy.name).toBe('allow-low-risk');
    expect(policy.action).toBe('allow');
    expect(policy.conditions[0]).toEqual({
      type: 'risk_level',
      operator: '<=',
      value: 'low'
    });
  });

  it('should generate deny critical risk policy', () => {
    const policy = PolicyTemplates.denyCriticalRisk();
    
    expect(policy.name).toBe('deny-critical-risk');
    expect(policy.action).toBe('deny');
    expect(policy.conditions[0]).toEqual({
      type: 'risk_level',
      operator: '>=',
      value: 'critical'
    });
  });

  it('should generate search operations policy', () => {
    const policy = PolicyTemplates.allowSearchOperations();
    
    expect(policy.name).toBe('allow-search-operations');
    expect(policy.action).toBe('allow');
    expect(policy.conditions[0]).toEqual({
      type: 'tool_name',
      pattern: '*search*'
    });
  });

  it('should generate system commands policy', () => {
    const policy = PolicyTemplates.denySystemCommands();
    
    expect(policy.name).toBe('deny-system-commands');
    expect(policy.action).toBe('deny');
    expect(policy.conditions[0]).toEqual({
      type: 'tool_name',
      pattern: '*system*'
    });
  });

  it('should generate file write transformation policy', () => {
    const policy = PolicyTemplates.transformFileWrites();
    
    expect(policy.name).toBe('transform-file-writes');
    expect(policy.action).toBe('transform');
    expect(policy.transformation).toEqual({
      type: 'read_only'
    });
  });

  it('should generate sensitive data filtering policy', () => {
    const policy = PolicyTemplates.filterSensitiveData();
    
    expect(policy.name).toBe('filter-sensitive-data');
    expect(policy.action).toBe('transform');
    expect(policy.transformation).toEqual({
      type: 'parameter_filter',
      remove_parameters: ['password', 'token', 'secret', 'key']
    });
  });

  it('should generate agent restriction policy', () => {
    const policy = PolicyTemplates.restrictAgentAccess('test-*', ['web-search', 'file-read']);
    
    expect(policy.name).toBe('restrict-test-agents');
    expect(policy.action).toBe('allow');
    expect(policy.conditions).toHaveLength(2);
    expect(policy.conditions[0].type).toBe('agent_id');
    expect(policy.conditions[1].type).toBe('tool_name');
  });

  it('should generate default policy set', () => {
    const policies = PolicyTemplates.getDefaultPolicies();
    
    expect(policies).toHaveLength(6);
    expect(policies.map(p => p.name)).toContain('deny-critical-risk');
    expect(policies.map(p => p.name)).toContain('allow-low-risk');
  });
});