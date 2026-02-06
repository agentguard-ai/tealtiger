/**
 * Base Guardrail Interface
 * 
 * All guardrails must implement this interface to be compatible
 * with the GuardrailEngine execution system.
 */

class Guardrail {
  constructor(config = {}) {
    if (this.constructor === Guardrail) {
      throw new Error('Guardrail is an abstract class and cannot be instantiated directly');
    }
    
    this.name = config.name || this.constructor.name;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.config = config;
  }

  /**
   * Evaluate input against this guardrail
   * @param {Object} input - The input to evaluate (prompt, parameters, etc.)
   * @param {Object} context - Execution context (agentId, sessionId, etc.)
   * @returns {Promise<GuardrailResult>} - Evaluation result
   */
  async evaluate(input, context) {
    throw new Error('evaluate() must be implemented by subclass');
  }

  /**
   * Configure the guardrail with new settings
   * @param {Object} config - Configuration object
   */
  configure(config) {
    this.config = { ...this.config, ...config };
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
  }

  /**
   * Get guardrail metadata
   * @returns {Object} - Metadata about this guardrail
   */
  getMetadata() {
    return {
      name: this.name,
      enabled: this.enabled,
      version: this.config.version || '1.0.0',
      description: this.config.description || 'No description provided'
    };
  }
}

/**
 * GuardrailResult - Standard result format for guardrail evaluations
 */
class GuardrailResult {
  constructor({ passed, action, reason, metadata = {}, riskScore = 0 }) {
    this.passed = passed;
    this.action = action; // 'allow', 'block', 'redact', 'mask', 'transform'
    this.reason = reason;
    this.metadata = metadata;
    this.riskScore = riskScore; // 0-100
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if the guardrail passed
   * @returns {boolean}
   */
  isPassed() {
    return this.passed;
  }

  /**
   * Check if the action should be blocked
   * @returns {boolean}
   */
  shouldBlock() {
    return this.action === 'block';
  }

  /**
   * Get the risk score
   * @returns {number} - Risk score 0-100
   */
  getRiskScore() {
    return this.riskScore;
  }
}

module.exports = { Guardrail, GuardrailResult };
