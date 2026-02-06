/**
 * Base Guardrail Interface
 * 
 * All guardrails must implement this interface to be compatible
 * with the GuardrailEngine execution system.
 */

export interface GuardrailConfig {
  name?: string;
  enabled?: boolean;
  version?: string;
  description?: string;
  [key: string]: any;
}

export interface GuardrailMetadata {
  name: string;
  enabled: boolean;
  version: string;
  description: string;
}

export interface GuardrailResultData {
  passed: boolean;
  action: 'allow' | 'block' | 'redact' | 'mask' | 'transform';
  reason: string;
  metadata?: Record<string, any>;
  riskScore?: number;
}

export class GuardrailResult {
  public readonly passed: boolean;
  public readonly action: 'allow' | 'block' | 'redact' | 'mask' | 'transform';
  public readonly reason: string;
  public readonly metadata: Record<string, any>;
  public readonly riskScore: number;
  public readonly timestamp: string;

  constructor(data: GuardrailResultData) {
    this.passed = data.passed;
    this.action = data.action;
    this.reason = data.reason;
    this.metadata = data.metadata || {};
    this.riskScore = data.riskScore || 0;
    this.timestamp = new Date().toISOString();
  }

  isPassed(): boolean {
    return this.passed;
  }

  shouldBlock(): boolean {
    return this.action === 'block';
  }

  getRiskScore(): number {
    return this.riskScore;
  }
}

export abstract class Guardrail {
  public readonly name: string;
  public enabled: boolean;
  protected config: GuardrailConfig;

  constructor(config: GuardrailConfig = {}) {
    this.name = config.name || this.constructor.name;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.config = config;
  }

  /**
   * Evaluate input against this guardrail
   */
  abstract evaluate(input: any, context?: Record<string, any>): Promise<GuardrailResult>;

  /**
   * Configure the guardrail with new settings
   */
  configure(config: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
  }

  /**
   * Get guardrail metadata
   */
  getMetadata(): GuardrailMetadata {
    return {
      name: this.name,
      enabled: this.enabled,
      version: this.config.version || '1.0.0',
      description: this.config.description || 'No description provided',
    };
  }
}
