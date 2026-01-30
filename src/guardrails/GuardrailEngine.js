/**
 * GuardrailEngine - Executes multiple guardrails in parallel
 * 
 * Handles parallel execution, error handling, and result aggregation
 * for all registered guardrails.
 */

const { GuardrailResult } = require('./Guardrail');

class GuardrailEngine {
  constructor(options = {}) {
    this.guardrails = [];
    this.options = {
      parallelExecution: options.parallelExecution !== undefined ? options.parallelExecution : true,
      continueOnError: options.continueOnError !== undefined ? options.continueOnError : true,
      timeout: options.timeout || 5000, // 5 seconds default timeout
      ...options
    };
  }

  /**
   * Register a guardrail for execution
   * @param {Guardrail} guardrail - Guardrail instance to register
   */
  registerGuardrail(guardrail) {
    if (!guardrail.evaluate || typeof guardrail.evaluate !== 'function') {
      throw new Error('Guardrail must implement evaluate() method');
    }
    
    this.guardrails.push(guardrail);
    console.log(`[GuardrailEngine] Registered guardrail: ${guardrail.name}`);
  }

  /**
   * Unregister a guardrail by name
   * @param {string} name - Name of guardrail to remove
   */
  unregisterGuardrail(name) {
    const index = this.guardrails.findIndex(g => g.name === name);
    if (index !== -1) {
      this.guardrails.splice(index, 1);
      console.log(`[GuardrailEngine] Unregistered guardrail: ${name}`);
    }
  }

  /**
   * Execute all registered guardrails
   * @param {Object} input - Input to evaluate
   * @param {Object} context - Execution context
   * @returns {Promise<GuardrailEngineResult>} - Aggregated results
   */
  async execute(input, context = {}) {
    const startTime = Date.now();
    const enabledGuardrails = this.guardrails.filter(g => g.enabled);

    if (enabledGuardrails.length === 0) {
      return new GuardrailEngineResult({
        passed: true,
        results: [],
        executionTime: Date.now() - startTime,
        guardrailsExecuted: 0
      });
    }

    let results;
    
    if (this.options.parallelExecution) {
      results = await this._executeParallel(enabledGuardrails, input, context);
    } else {
      results = await this._executeSequential(enabledGuardrails, input, context);
    }

    const executionTime = Date.now() - startTime;
    
    // Aggregate results
    const passed = results.every(r => r.result ? r.result.passed : false);
    const maxRiskScore = Math.max(...results.map(r => r.result ? r.result.riskScore : 0));
    const failedGuardrails = results.filter(r => r.result && !r.result.passed);

    return new GuardrailEngineResult({
      passed,
      results,
      executionTime,
      guardrailsExecuted: enabledGuardrails.length,
      maxRiskScore,
      failedGuardrails: failedGuardrails.map(r => r.guardrailName)
    });
  }

  /**
   * Execute guardrails in parallel
   * @private
   */
  async _executeParallel(guardrails, input, context) {
    const promises = guardrails.map(guardrail => 
      this._executeWithTimeout(guardrail, input, context)
    );

    return Promise.all(promises);
  }

  /**
   * Execute guardrails sequentially
   * @private
   */
  async _executeSequential(guardrails, input, context) {
    const results = [];
    
    for (const guardrail of guardrails) {
      const result = await this._executeWithTimeout(guardrail, input, context);
      results.push(result);
      
      // Stop on first failure if configured
      if (!this.options.continueOnError && result.error) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Execute a single guardrail with timeout and error handling
   * @private
   */
  async _executeWithTimeout(guardrail, input, context) {
    const guardrailName = guardrail.name;
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Guardrail execution timeout')), this.options.timeout)
      );

      const evaluationPromise = guardrail.evaluate(input, context);
      const result = await Promise.race([evaluationPromise, timeoutPromise]);

      return {
        guardrailName,
        result,
        executionTime: Date.now() - startTime,
        error: null
      };
    } catch (error) {
      console.error(`[GuardrailEngine] Error executing ${guardrailName}:`, error.message);
      
      if (this.options.continueOnError) {
        // Return a failed result but continue execution
        return {
          guardrailName,
          result: new GuardrailResult({
            passed: false,
            action: 'block',
            reason: `Guardrail execution failed: ${error.message}`,
            riskScore: 100
          }),
          executionTime: Date.now() - startTime,
          error: error.message
        };
      } else {
        throw error;
      }
    }
  }

  /**
   * Get list of registered guardrails
   * @returns {Array} - Array of guardrail metadata
   */
  getRegisteredGuardrails() {
    return this.guardrails.map(g => g.getMetadata());
  }

  /**
   * Clear all registered guardrails
   */
  clearGuardrails() {
    this.guardrails = [];
    console.log('[GuardrailEngine] Cleared all guardrails');
  }
}

/**
 * GuardrailEngineResult - Aggregated result from all guardrails
 */
class GuardrailEngineResult {
  constructor({ passed, results, executionTime, guardrailsExecuted, maxRiskScore = 0, failedGuardrails = [] }) {
    this.passed = passed;
    this.results = results;
    this.executionTime = executionTime;
    this.guardrailsExecuted = guardrailsExecuted;
    this.maxRiskScore = maxRiskScore;
    this.failedGuardrails = failedGuardrails;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if all guardrails passed
   * @returns {boolean}
   */
  allPassed() {
    return this.passed;
  }

  /**
   * Get failed guardrail names
   * @returns {Array<string>}
   */
  getFailedGuardrails() {
    return this.failedGuardrails;
  }

  /**
   * Get maximum risk score across all guardrails
   * @returns {number}
   */
  getMaxRiskScore() {
    return this.maxRiskScore;
  }

  /**
   * Get summary of execution
   * @returns {Object}
   */
  getSummary() {
    return {
      passed: this.passed,
      guardrailsExecuted: this.guardrailsExecuted,
      failedCount: this.failedGuardrails.length,
      maxRiskScore: this.maxRiskScore,
      executionTime: this.executionTime
    };
  }
}

module.exports = { GuardrailEngine, GuardrailEngineResult };
