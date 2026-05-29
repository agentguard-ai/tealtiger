/**
 * TealTogether Quickstart
 *
 * Demonstrates a guarded Together AI client with input guardrails,
 * a daily budget, and per-request cost tracking for an open-source model.
 *
 * Run with:
 *
 *   TOGETHER_API_KEY=your-key npx ts-node --project examples/together-quickstart/tsconfig.json examples/together-quickstart/index.ts
 */

import {
  BudgetManager,
  ContentModerationGuardrail,
  CostTracker,
  GuardrailEngine,
  InMemoryCostStorage,
  PIIDetectionGuardrail,
} from 'tealtiger';
import { TealTogether, TOGETHER_PRICING } from 'tealtiger/providers/together';

const MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';

function createGuardrailEngine(): GuardrailEngine {
  const guardrailEngine = new GuardrailEngine();

  guardrailEngine.registerGuardrail(new PIIDetectionGuardrail({
    name: 'pii-detection',
    enabled: true,
    action: 'redact',
  }));

  guardrailEngine.registerGuardrail(new ContentModerationGuardrail({
    name: 'content-moderation',
    enabled: true,
    action: 'block',
    useOpenAI: false,
  }));

  return guardrailEngine;
}

function createCostTracker(): CostTracker {
  const costTracker = new CostTracker({
    enabled: true,
    persistRecords: true,
    enableBudgets: true,
    enableAlerts: true,
  });

  const pricing = TOGETHER_PRICING[MODEL];
  costTracker.addCustomPricing(MODEL, {
    provider: 'custom',
    inputCostPer1K: pricing.input,
    outputCostPer1K: pricing.output,
    lastUpdated: '2026-05-23',
  });

  return costTracker;
}

async function main() {
  const guardrailEngine = createGuardrailEngine();
  const costStorage = new InMemoryCostStorage();
  const costTracker = createCostTracker();
  const budgetManager = new BudgetManager(costStorage);

  budgetManager.createBudget({
    name: 'Together AI Quickstart Daily Budget',
    limit: 5.0,
    period: 'daily',
    alertThresholds: [50, 75, 90],
    action: 'alert',
    enabled: true,
  });

  const client = new TealTogether({
    apiKey: process.env.TOGETHER_API_KEY || 'your-together-api-key',
    agentId: 'together-quickstart-agent',
    model: MODEL,
    guardrailEngine,
    costTracker,
    budgetManager,
    costStorage,
  });

  console.log('--- Basic Together AI request ---');
  const basic = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a concise security engineer.',
      },
      {
        role: 'user',
        content: 'In one sentence, what does TealTiger add around Together AI calls?',
      },
    ],
    max_tokens: 120,
  });

  console.log('Response:', basic.choices[0].message.content);
  if (basic.security?.costRecord) {
    console.log(`Cost: $${basic.security.costRecord.actualCost.toFixed(6)}`);
    console.log(`Tokens: ${basic.security.costRecord.actualTokens.totalTokens}`);
  }

  console.log('\n--- PII guardrail request ---');
  const guarded = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: 'Draft a support reply for Taylor at taylor@example.com without repeating the email address.',
      },
    ],
    max_tokens: 120,
  });

  const inputGuardrails = guarded.security?.guardrailResult;
  const piiResult = inputGuardrails?.results.find(
    (result: { guardrailName: string }) => result.guardrailName === 'pii-detection',
  );
  const redactedText = piiResult?.result?.metadata?.redactedText;

  console.log('Guardrail summary:', inputGuardrails?.getSummary());
  if (redactedText) {
    console.log('Redacted input:', redactedText);
  }
  if (guarded.security?.costRecord) {
    console.log(`Cost: $${guarded.security.costRecord.actualCost.toFixed(6)}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const costSummary = await costStorage.getSummary(today, new Date(), 'together-quickstart-agent');

  console.log('\n--- Cost summary ---');
  console.log(`Requests tracked: ${costSummary.totalRequests}`);
  console.log(`Total cost: $${costSummary.totalCost.toFixed(6)}`);
}

main().catch((error) => {
  console.error('Together AI quickstart failed:', error);
  process.exit(1);
});
