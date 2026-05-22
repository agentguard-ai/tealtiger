/**
 * TealBedrock Quickstart — Multi-Model Routing
 *
 * Demonstrates a guarded Bedrock client that routes requests to different
 * models based on task type (reasoning → Claude, code → Llama, Q&A → Titan).
 *
 * Run with:
 *
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *     npx ts-node examples/bedrock-quickstart/index.ts
 */

import {
  BudgetManager,
  ContentModerationGuardrail,
  CostTracker,
  GuardrailEngine,
  InMemoryCostStorage,
  PIIDetectionGuardrail,
} from 'tealtiger';
import { TealBedrock } from 'tealtiger/providers/bedrock';

const BEDROCK_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic.claude-v2':                          { input: 0.01102, output: 0.03268 },
  'anthropic.claude-instant-v1':                  { input: 0.00163, output: 0.00551 },
  'anthropic.claude-3-haiku-20240307-v1:0':      { input: 0.00025, output: 0.00125 },
  'meta.llama2-70b-chat-v1':                     { input: 0.00195, output: 0.00256 },
  'amazon.titan-text-express-v1':                { input: 0.00080, output: 0.00080 },
  'cohere.command-text-v14':                     { input: 0.00150, output: 0.00200 },
};

type TaskType = 'reasoning' | 'code' | 'summary' | 'creative' | 'quick';

interface Route {
  modelId: string;
  label: string;
  config?: { temperature?: number; maxTokens?: number };
}

function routeForTask(task: TaskType): Route {
  switch (task) {
    case 'reasoning':
      return {
        modelId: 'anthropic.claude-v2',
        label: 'Claude v2 (complex reasoning)',
        config: { temperature: 0.3, maxTokens: 500 },
      };
    case 'code':
      return {
        modelId: 'meta.llama2-70b-chat-v1',
        label: 'Llama 2 70B (code generation)',
        config: { temperature: 0.2, maxTokens: 600 },
      };
    case 'summary':
      return {
        modelId: 'amazon.titan-text-express-v1',
        label: 'Titan Text Express (summarization)',
        config: { temperature: 0.5, maxTokens: 300 },
      };
    case 'creative':
      return {
        modelId: 'cohere.command-text-v14',
        label: 'Cohere Command (creative writing)',
        config: { temperature: 0.8, maxTokens: 400 },
      };
    case 'quick':
      return {
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        label: 'Claude 3 Haiku (fast & cheap)',
        config: { temperature: 0.0, maxTokens: 150 },
      };
  }
}

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

  for (const [modelId, pricing] of Object.entries(BEDROCK_PRICING)) {
    costTracker.addCustomPricing(modelId, {
      provider: 'bedrock',
      inputCostPer1K: pricing.input,
      outputCostPer1K: pricing.output,
      lastUpdated: '2026-05-20',
    });
  }

  return costTracker;
}

async function main() {
  const guardrailEngine = createGuardrailEngine();
  const costStorage = new InMemoryCostStorage();
  const costTracker = createCostTracker();
  const budgetManager = new BudgetManager(costStorage);

  budgetManager.createBudget({
    name: 'Bedrock Quickstart Daily Budget',
    limit: 10.0,
    period: 'daily',
    alertThresholds: [50, 75, 90],
    action: 'alert',
    enabled: true,
  });

  const client = new TealBedrock({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key',
    },
    agentId: 'bedrock-quickstart-agent',
    guardrailEngine,
    costTracker,
    budgetManager,
    costStorage,
  });

  const tasks: { type: TaskType; prompt: string }[] = [
    {
      type: 'reasoning',
      prompt: 'Explain the difference between symmetric and asymmetric encryption in one paragraph.',
    },
    {
      type: 'code',
      prompt: 'Write a TypeScript function that fetches data from an API with retry logic.',
    },
    {
      type: 'summary',
      prompt: 'Summarise the benefits of using guardrails in AI applications in two sentences.',
    },
    {
      type: 'creative',
      prompt: 'Write a short tagline for a security-focused AI company.',
    },
    {
      type: 'quick',
      prompt: 'What is 2+2?',
    },
  ];

  for (const { type, prompt } of tasks) {
    const route = routeForTask(type);

    console.log(`\n--- ${route.label} ---`);
    console.log(`Task: ${type}`);
    console.log(`Prompt: ${prompt}`);

    const response = await client.invokeModel({
      modelId: route.modelId,
      prompt,
      maxTokens: route.config?.maxTokens ?? 200,
      temperature: route.config?.temperature,
    });

    console.log(`Response: ${response.text}`);
    if (response.metadata?.cost) {
      console.log(`Cost: $${Number(response.metadata.cost).toFixed(6)}`);
    }
    if (response.inputTokens != null) {
      console.log(`Tokens: ${response.inputTokens} in / ${response.outputTokens} out`);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const costSummary = await costStorage.getSummary(today, new Date(), 'bedrock-quickstart-agent');

  console.log('\n--- Cost summary ---');
  console.log(`Requests tracked: ${costSummary.totalRequests}`);
  console.log(`Total cost: $${costSummary.totalCost.toFixed(6)}`);
}

main().catch((error) => {
  console.error('Bedrock quickstart failed:', error);
  process.exit(1);
});
