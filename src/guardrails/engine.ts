/**
 * GuardrailEngine - Executes multiple guardrails in parallel
 * 
 * Handles parallel execution, error handling, and result aggregation
 * for all registered guardrails.
 */

import { Guardrail, GuardrailResult } from './base';

export interface GuardrailEngineOptions {
  parallelExecution?: boolean;
  continueOnError?: boolean;
  timeout?: number;
}

export interface GuardrailExecutionResult {
  guardrailName: string;
  result: GuardrailResult | null;
  executionTime: number;
  error: string | null;
}

export class GuardrailEngineResult {
  public readonly passed: boolean;
  public readonly results: GuardrailExecutionResult[];
  public readonly executionTime: number;
  public readonly guardrailsExecuted: number;
  public readonly maxRiskScore: number;
  public readonly failedGuardrails: string[];
  public readonly timestamp: string;

  constructor(data: {
    passed: boolean;
    results: GuardrailExecutionResult[];
    executionTime: number;
    guardrailsExecuted: number;
    maxRiskScore?: number;
    failedGuardrails?: string[];
  }) {
    this.passed = data.passed;
    this.results = data.results;
    this.executionTime = data.executionTime;
    this.guardrailsExecuted = data.guardrailsExecuted;
    this.maxRiskScore = data.maxRiskScore || 0;
    this.failedGuardrails = data.failedGuardrails || [];
    this.timestamp = new Date().toISOString();
  }

  allPassed(): boolean {
    return this.passed;
  }

  getFailedGuardrails(): string[] {
    return this.failedGuardrails;
  }

  getMaxRiskScore(): number {
    return this.maxRiskScore;
  }

  getSummary(): {
    passed: boolean;
    guardrailsExecuted: number;
    failedCount: number;
    maxRiskScore: number;
    executionTime: number;
  } {
    return {
      passed: this.passed,
      guardrailsExecuted: this.guardrailsExecuted,
      failedCount: this.failedGuardrails.length,
      maxRiskScore: this.maxRiskScore,
      executionTime: this.executionTime,
    };
  }
}

export class GuardrailEngine {
  private guardrails: Guardrail[] = [];
  private options: Required<GuardrailEngineOptions>;

  constructor(options: GuardrailEngineOptions = {}) {
    this.options = {
      parallelExecution: options.parallelExecution !== undefined ? options.parallelExecution : true,
      continueOnError: options.continueOnError !== undefined ? options.continueOnError : true,
      timeout: options.timeout || 5000,
    };
  }

  registerGuardrail(guardrail: Guardrail): void {
    if (!guardrail.evaluate || typeof guardrail.evaluate !== 'function') {
      throw new Error('Guardrail must implement evaluate() method');
    }

    this.guardrails.push(guardrail);
    console.log(`[GuardrailEngine] Registered guardrail: ${guardrail.name}`);
  }

  unregisterGuardrail(name: string): void {
    const index = this.guardrails.findIndex((g) => g.name === name);
    if (index !== -1) {
      this.guardrails.splice(index, 1);
      console.log(`[GuardrailEngine] Unregistered guardrail: ${name}`);
    }
  }

  async execute(input: any, context: Record<string, any> = {}): Promise<GuardrailEngineResult> {
    const startTime = Date.now();
    const enabledGuardrails = this.guardrails.filter((g) => g.enabled);

    if (enabledGuardrails.length === 0) {
      return new GuardrailEngineResult({
        passed: true,
        results: [],
        executionTime: Date.now() - startTime,
        guardrailsExecuted: 0,
      });
    }

    let results: GuardrailExecutionResult[];

    if (this.options.parallelExecution) {
      results = await this.executeParallel(enabledGuardrails, input, context);
    } else {
      results = await this.executeSequential(enabledGuardrails, input, context);
    }

    const executionTime = Date.now() - startTime;

    // Aggregate results
    const passed = results.every((r) => r.result?.passed ?? false);
    const maxRiskScore = Math.max(...results.map((r) => r.result?.riskScore ?? 0));
    const failedGuardrails = results
      .filter((r) => r.result && !r.result.passed)
      .map((r) => r.guardrailName);

    return new GuardrailEngineResult({
      passed,
      results,
      executionTime,
      guardrailsExecuted: enabledGuardrails.length,
      maxRiskScore,
      failedGuardrails,
    });
  }

  private async executeParallel(
    guardrails: Guardrail[],
    input: any,
    context: Record<string, any>
  ): Promise<GuardrailExecutionResult[]> {
    const promises = guardrails.map((guardrail) =>
      this.executeWithTimeout(guardrail, input, context)
    );

    return Promise.all(promises);
  }

  private async executeSequential(
    guardrails: Guardrail[],
    input: any,
    context: Record<string, any>
  ): Promise<GuardrailExecutionResult[]> {
    const results: GuardrailExecutionResult[] = [];

    for (const guardrail of guardrails) {
      const result = await this.executeWithTimeout(guardrail, input, context);
      results.push(result);

      // Stop on first failure if configured
      if (!this.options.continueOnError && result.error) {
        break;
      }
    }

    return results;
  }

  private async executeWithTimeout(
    guardrail: Guardrail,
    input: any,
    context: Record<string, any>
  ): Promise<GuardrailExecutionResult> {
    const guardrailName = guardrail.name;
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Guardrail execution timeout')), this.options.timeout)
      );

      const evaluationPromise = guardrail.evaluate(input, context);
      const result = await Promise.race([evaluationPromise, timeoutPromise]);

      return {
        guardrailName,
        result,
        executionTime: Date.now() - startTime,
        error: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[GuardrailEngine] Error executing ${guardrailName}:`, errorMessage);

      if (this.options.continueOnError) {
        return {
          guardrailName,
          result: new GuardrailResult({
            passed: false,
            action: 'block',
            reason: `Guardrail execution failed: ${errorMessage}`,
            riskScore: 100,
          }),
          executionTime: Date.now() - startTime,
          error: errorMessage,
        };
      } else {
        throw error;
      }
    }
  }

  getRegisteredGuardrails(): Array<ReturnType<Guardrail['getMetadata']>> {
    return this.guardrails.map((g) => g.getMetadata());
  }

  clearGuardrails(): void {
    this.guardrails = [];
    console.log('[GuardrailEngine] Cleared all guardrails');
  }
}
