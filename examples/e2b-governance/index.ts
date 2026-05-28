/**
 * TealTiger + E2B governance example.
 *
 * Flow:
 *   user prompt -> LLM-generated code -> TealEngine policy gate -> E2B sandbox
 *
 * The example runs in dry-run mode when E2B_API_KEY is not set, so it can be
 * typechecked and inspected without live credentials. Set E2B_API_KEY and
 * OPENAI_API_KEY to exercise the end-to-end provider path.
 */

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Sandbox } from '@e2b/code-interpreter';
import { TealEngine } from '../../packages/tealtiger-sdk/src/core/engine/TealEngine';
import { BudgetManager } from '../../packages/tealtiger-sdk/src/cost/BudgetManager';
import { CostTracker } from '../../packages/tealtiger-sdk/src/cost/CostTracker';
import { InMemoryCostStorage } from '../../packages/tealtiger-sdk/src/cost/CostStorage';
import type {
  CostEstimate,
  CostRecord,
  CostSummary,
} from '../../packages/tealtiger-sdk/src/cost/types';
import type { PolicyEvaluationResult } from '../../packages/tealtiger-sdk/src/core/engine/types';

type GateAction = 'ALLOW' | 'DENY' | 'MODIFY';

type SecretFinding = {
  type: 'OPENAI_API_KEY' | 'E2B_API_KEY' | 'GENERIC_SECRET_ASSIGNMENT';
  redacted: string;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
};

type GovernanceDecision = {
  action: GateAction;
  allowed: boolean;
  generatedCode: string;
  sanitizedCode?: string;
  reasons: string[];
  engine: PolicyEvaluationResult;
  secrets: SecretFinding[];
  rateLimit: RateLimitResult;
  costEstimate: CostEstimate;
  latencyMs: number;
};

type ExecutionResult = {
  output: string;
  latencyMs: number;
  dryRun: boolean;
};

type GovernanceRuntime = {
  engine: TealEngine;
  costTracker: CostTracker;
  costStorage: InMemoryCostStorage;
  budgetManager: BudgetManager;
  rateLimiter: SlidingWindowRateLimiter;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const AGENT_ID = 'e2b-governance-agent';
const E2B_TOOL = 'e2b_sandbox_run_code';
const E2B_COST_MODEL = 'e2b-sandbox-second';
const DEFAULT_PROMPT = 'Write Python code that computes the mean of [4, 8, 15, 16, 23, 42].';
const SECRET_DEMO_CODE = [
  'import os',
  '',
  'OPENAI_API_KEY = "sk-proj-DEMO_PLACEHOLDER_DO_NOT_USE"',
  'print("ready to call a model")',
].join('\n');

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SANDBOX_COST_PER_SECOND_USD = envNumber('E2B_COST_PER_SECOND_USD', 0.0006);
const ESTIMATED_SANDBOX_SECONDS = envNumber('E2B_ESTIMATED_SECONDS', 3);
const SESSION_BUDGET_USD = envNumber('TEALTIGER_E2B_SESSION_BUDGET_USD', 0.05);
const MAX_SANDBOX_CALLS = envNumber('TEALTIGER_E2B_MAX_CALLS', 2);
const RATE_WINDOW_MS = envNumber('TEALTIGER_E2B_RATE_WINDOW_MS', 60_000);
const ENGINE_RATE_WINDOW = '1m';

class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxCalls: number,
    private readonly windowMs: number,
  ) {}

  check(now = Date.now()): RateLimitResult {
    this.prune(now);
    const oldest = this.timestamps[0];
    const resetInMs = oldest == null ? this.windowMs : Math.max(0, this.windowMs - (now - oldest));

    return {
      allowed: this.timestamps.length < this.maxCalls,
      remaining: Math.max(0, this.maxCalls - this.timestamps.length),
      resetInMs,
    };
  }

  record(now = Date.now()): RateLimitResult {
    const result = this.check(now);
    if (result.allowed) {
      this.timestamps.push(now);
      return this.check(now);
    }

    return result;
  }

  private prune(now: number): void {
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.windowMs);
  }
}

function createRuntime(options: { budgetLimitUsd?: number; maxSandboxCalls?: number } = {}): GovernanceRuntime {
  const costStorage = new InMemoryCostStorage();
  const budgetManager = new BudgetManager(costStorage);
  const costTracker = new CostTracker({
    enabled: true,
    persistRecords: true,
    enableBudgets: true,
    enableAlerts: true,
  });

  costTracker.addCustomPricing(E2B_COST_MODEL, {
    provider: 'custom',
    inputCostPer1K: 0,
    outputCostPer1K: SANDBOX_COST_PER_SECOND_USD * 1000,
  });

  budgetManager.createBudget({
    name: 'E2B sandbox session budget',
    limit: options.budgetLimitUsd ?? SESSION_BUDGET_USD,
    period: 'total',
    alertThresholds: [50, 75, 90, 100],
    action: 'block',
    scope: {
      type: 'agent',
      id: AGENT_ID,
    },
    enabled: true,
  });

  const engine = new TealEngine({
    tools: {
      [E2B_TOOL]: {
        allowed: true,
        maxSize: '16KB',
        rateLimit: {
          max: options.maxSandboxCalls ?? MAX_SANDBOX_CALLS,
          window: ENGINE_RATE_WINDOW,
        },
      },
    },
    identity: {
      agentId: AGENT_ID,
      role: 'sandbox-runner',
      permissions: ['sandbox:execute'],
    },
    codeExecution: {
      allowedLanguages: ['python'],
      blockedFunctions: ['eval(', 'exec(', '__import__(', 'subprocess.', 'os.system('],
      blockedPatterns: [/pip\s+install/i, /curl\s+http/i, /wget\s+http/i],
      maxLength: 16_000,
      timeout: 30_000,
      requireSandbox: true,
    },
    behavioral: {
      costLimit: {
        daily: options.budgetLimitUsd ?? SESSION_BUDGET_USD,
      },
      rateLimit: {
        requests: options.maxSandboxCalls ?? MAX_SANDBOX_CALLS,
        window: ENGINE_RATE_WINDOW,
      },
    },
  });

  return {
    engine,
    costTracker,
    costStorage,
    budgetManager,
    rateLimiter: new SlidingWindowRateLimiter(options.maxSandboxCalls ?? MAX_SANDBOX_CALLS, RATE_WINDOW_MS),
  };
}

async function generateCode(prompt: string): Promise<{ code: string; source: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      code: deterministicCode(prompt),
      source: 'local deterministic fallback',
    };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: 'Return only safe Python code. Do not include markdown fences or secrets.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const payload = await response.json() as OpenAIResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI request failed with status ${response.status}`);
  }

  const text = extractOpenAIText(payload);
  return {
    code: stripMarkdownFence(text || deterministicCode(prompt)),
    source: 'OpenAI Responses API',
  };
}

function deterministicCode(prompt: string): string {
  return [
    `# Generated from prompt: ${prompt}`,
    'values = [4, 8, 15, 16, 23, 42]',
    'mean = sum(values) / len(values)',
    'print(f"mean={mean:.2f}")',
  ].join('\n');
}

function extractOpenAIText(payload: OpenAIResponse): string {
  if (payload.output_text) {
    return payload.output_text;
  }

  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? '')
    .join('\n')
    .trim() ?? '';
}

function stripMarkdownFence(text: string): string {
  return text
    .replace(/^```(?:python)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function scanGeneratedCodeForSecrets(code: string): SecretFinding[] {
  const patterns: Array<{ type: SecretFinding['type']; regex: RegExp }> = [
    { type: 'OPENAI_API_KEY', regex: /sk-(?:proj-)?[A-Za-z0-9_-]{12,}/g },
    { type: 'E2B_API_KEY', regex: /e2b_[A-Za-z0-9_-]{20,}/g },
    {
      type: 'GENERIC_SECRET_ASSIGNMENT',
      regex: /\b(?:api[_-]?key|token|secret)\b\s*=\s*["'][^"']{12,}["']/gi,
    },
  ];

  return patterns.flatMap(({ type, regex }) => {
    const matches = Array.from(code.matchAll(regex));
    return matches.map((match) => ({
      type,
      redacted: redactSecret(match[0]),
    }));
  });
}

function redactSecret(value: string): string {
  if (value.length <= 8) {
    return '[REDACTED]';
  }

  return `${value.slice(0, 4)}...[REDACTED]`;
}

function sanitizeGeneratedCode(code: string): string {
  return code
    .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/g, '[REDACTED_OPENAI_API_KEY]')
    .replace(/e2b_[A-Za-z0-9_-]{20,}/g, '[REDACTED_E2B_API_KEY]')
    .replace(/\b((?:api[_-]?key|token|secret)\b\s*=\s*)["'][^"']{12,}["']/gi, '$1"[REDACTED]"');
}

async function evaluateGovernance(
  runtime: GovernanceRuntime,
  generatedCode: string,
): Promise<GovernanceDecision> {
  const startedAt = performance.now();
  const estimatedTokens = {
    inputTokens: 0,
    outputTokens: ESTIMATED_SANDBOX_SECONDS,
    totalTokens: ESTIMATED_SANDBOX_SECONDS,
  };
  const costEstimate = runtime.costTracker.estimateCost(E2B_COST_MODEL, estimatedTokens, 'custom');
  const engine = runtime.engine.evaluate({
    agentId: AGENT_ID,
    action: 'tool.execute',
    tool: E2B_TOOL,
    toolParams: {
      language: 'python',
      sandbox: 'e2b',
    },
    code: generatedCode,
    cost: costEstimate.estimatedCost,
    metadata: {
      language: 'python',
      sandboxed: true,
    },
  });
  const secrets = scanGeneratedCodeForSecrets(generatedCode);
  const budget = await runtime.budgetManager.checkBudget(AGENT_ID, costEstimate.estimatedCost);
  const rateLimit = runtime.rateLimiter.check();
  const reasons: string[] = [];

  if (!engine.allowed) {
    reasons.push(engine.reason ?? 'TealEngine policy denied the sandbox call');
  }

  if (secrets.length > 0) {
    reasons.push(`Secret scanner found ${secrets.length} potential credential(s)`);
  }

  if (!budget.allowed) {
    reasons.push(`Budget "${budget.blockedBy?.name ?? 'unknown'}" would be exceeded`);
  }

  if (!rateLimit.allowed) {
    reasons.push(`Rate limit exceeded; retry in ${rateLimit.resetInMs}ms`);
  }

  if (reasons.length > 0) {
    return {
      action: secrets.length > 0 && engine.allowed && budget.allowed && rateLimit.allowed ? 'MODIFY' : 'DENY',
      allowed: false,
      generatedCode,
      sanitizedCode: secrets.length > 0 ? sanitizeGeneratedCode(generatedCode) : undefined,
      reasons,
      engine,
      secrets,
      rateLimit,
      costEstimate,
      latencyMs: performance.now() - startedAt,
    };
  }

  runtime.rateLimiter.record();

  return {
    action: 'ALLOW',
    allowed: true,
    generatedCode,
    reasons: ['Policy compliant'],
    engine,
    secrets,
    rateLimit: runtime.rateLimiter.check(),
    costEstimate,
    latencyMs: performance.now() - startedAt,
  };
}

async function executeInE2B(code: string): Promise<ExecutionResult> {
  if (!process.env.E2B_API_KEY || process.env.E2B_DRY_RUN === '1') {
    return {
      output: [
        'Dry run: E2B_API_KEY is not set, so no sandbox was created.',
        'The following code would be sent to E2B after governance approval:',
        code,
      ].join('\n'),
      latencyMs: 0,
      dryRun: true,
    };
  }

  const startedAt = performance.now();
  const sandbox = await Sandbox.create();

  try {
    const execution = await sandbox.runCode(code, { language: 'python' });
    const stdout = execution.logs.stdout.join('');
    const stderr = execution.logs.stderr.join('');
    const text = typeof execution.text === 'string' ? execution.text : '';

    return {
      output: [text, stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)',
      latencyMs: performance.now() - startedAt,
      dryRun: false,
    };
  } finally {
    await sandbox.kill();
  }
}

async function recordSandboxCost(
  runtime: GovernanceRuntime,
  requestId: string,
  execution: ExecutionResult,
): Promise<CostRecord> {
  const executionSeconds = execution.dryRun
    ? ESTIMATED_SANDBOX_SECONDS
    : Math.max(1, Math.ceil(execution.latencyMs / 1000));

  const record = runtime.costTracker.calculateActualCost(
    requestId,
    AGENT_ID,
    E2B_COST_MODEL,
    {
      inputTokens: 0,
      outputTokens: executionSeconds,
      totalTokens: executionSeconds,
    },
    'custom',
    {
      provider: 'e2b',
      dry_run: execution.dryRun,
      latency_ms: execution.latencyMs,
      pricing_unit: 'sandbox_second',
    },
  );

  await runtime.costStorage.store(record);
  await runtime.budgetManager.recordCost(record);
  return record;
}

async function getCostSummary(runtime: GovernanceRuntime): Promise<CostSummary> {
  return runtime.costStorage.getSummary(new Date(0), new Date(), AGENT_ID);
}

function printDecision(decision: GovernanceDecision): void {
  console.log('Governance decision:', decision.action);
  console.log('Allowed:', decision.allowed);
  console.log('Reasons:', decision.reasons.join('; '));
  console.log('TealEngine allowed:', decision.engine.allowed);
  console.log('Triggered policies:', decision.engine.triggeredPolicies.join(', ') || 'none');
  console.log(`Estimated E2B cost: $${decision.costEstimate.estimatedCost.toFixed(6)}`);
  console.log(`Gate latency: ${decision.latencyMs.toFixed(2)} ms`);

  if (decision.secrets.length > 0) {
    console.log('Secret findings:', decision.secrets.map((finding) => `${finding.type}:${finding.redacted}`).join(', '));
  }

  if (decision.sanitizedCode && decision.action === 'MODIFY') {
    console.log('Sanitized code preview:');
    console.log(decision.sanitizedCode);
  }
}

function printCostSummary(summary: CostSummary): void {
  console.log('Requests tracked:', summary.totalRequests);
  console.log(`Total sandbox cost: $${summary.totalCost.toFixed(6)}`);
  console.log(`Average cost per request: $${summary.averageCostPerRequest.toFixed(6)}`);
  console.log('Total sandbox seconds tracked:', summary.totalTokens.total);
}

async function runGovernedExecution(): Promise<void> {
  const runtime = createRuntime();
  const requestId = randomUUID();
  const prompt = process.env.CODE_PROMPT ?? DEFAULT_PROMPT;
  const generated = await generateCode(prompt);

  console.log('--- LLM generation ---');
  console.log('Source:', generated.source);
  console.log(generated.code);

  console.log('\n--- TealTiger policy gate ---');
  const decision = await evaluateGovernance(runtime, generated.code);
  printDecision(decision);

  if (!decision.allowed) {
    console.log('\nExecution blocked before E2B sandbox creation.');
    return;
  }

  console.log('\n--- E2B execution ---');
  const execution = await executeInE2B(decision.generatedCode);
  const costRecord = await recordSandboxCost(runtime, requestId, execution);

  console.log('Execution output:');
  console.log(execution.output);
  console.log(`Execution latency: ${execution.latencyMs.toFixed(2)} ms`);
  console.log(`Recorded cost: $${costRecord.actualCost.toFixed(6)}`);

  console.log('\n--- Cost summary ---');
  printCostSummary(await getCostSummary(runtime));
}

async function runBlockedSecretDemo(): Promise<void> {
  const runtime = createRuntime();

  console.log('\n--- Governance comparison: leaked secret ---');
  console.log('Without governance: the generated code would be sent directly to E2B.');

  const decision = await evaluateGovernance(runtime, SECRET_DEMO_CODE);
  printDecision(decision);
  console.log('With governance: sandbox execution is blocked before the leaked secret can run.');
}

async function runBudgetDemo(): Promise<void> {
  const runtime = createRuntime({ budgetLimitUsd: 0.0001 });
  const decision = await evaluateGovernance(runtime, deterministicCode('demonstrate budget enforcement'));

  console.log('\n--- Governance comparison: budget enforcement ---');
  printDecision(decision);
}

async function main(): Promise<void> {
  await runGovernedExecution();
  await runBlockedSecretDemo();
  await runBudgetDemo();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('E2B governance example failed:', message);
  process.exit(1);
});
