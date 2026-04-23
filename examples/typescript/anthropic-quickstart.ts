/**
 * TealAnthropic Quickstart
 *
 * Shortest runnable example of wrapping Anthropic's Claude API with
 * TealTiger's guardrails and cost tracking. Run with:
 *
 *   ANTHROPIC_API_KEY=sk-ant-... ts-node examples/typescript/anthropic-quickstart.ts
 *
 * Claude-specific notes this example demonstrates:
 *   - system is a top-level field on messages.create(), not a message role
 *   - models include dates (claude-3-5-sonnet-20241022); pin them in production
 *   - max_tokens is required
 *   - streaming uses client.messages.stream({...}) rather than a flag
 */

import {
  TealAnthropic,
  GuardrailEngine,
  PIIDetectionGuardrail,
  ContentModerationGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage,
} from 'tealtiger';

async function main() {
  // 1. Guardrails: redact PII, block anything flagged as unsafe content.
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
  }));

  // 2. Cost tracking + a daily $5 budget with alerts at 50 / 75 / 90%.
  const storage = new InMemoryCostStorage();
  const costTracker = new CostTracker({
    enabled: true,
    persistRecords: true,
    enableBudgets: true,
    enableAlerts: true,
  });
  const budgetManager = new BudgetManager(storage);
  budgetManager.createBudget({
    name: 'Quickstart Daily Budget',
    limit: 5.0,
    period: 'daily',
    alertThresholds: [50, 75, 90],
    action: 'alert',
    enabled: true,
  });

  // 3. TealAnthropic is a drop-in wrapper around Anthropic's SDK.
  const client = new TealAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key',
    agentId: 'quickstart-agent',
    guardrailEngine,
    costTracker,
    budgetManager,
    costStorage: storage,
  });

  // 4. Plain message. The shape matches the upstream Anthropic SDK; the
  //    security metadata on the response is added by TealAnthropic.
  const basic = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [
      { role: 'user', content: 'In one sentence, what does TealTiger do?' },
    ],
  });
  console.log('Basic response:', basic.content[0].text);
  console.log('Cost: $' + (basic.security?.costRecord?.actualCost ?? 0).toFixed(6));

  // 5. System prompt. Claude's API takes `system` as a top-level field,
  //    not as a message with role: "system" like OpenAI does.
  const systemed = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    system: 'You answer as a concise security engineer. Three sentences max.',
    messages: [
      { role: 'user', content: 'Why redact PII before sending prompts to a model?' },
    ],
  });
  console.log('\nSystem-primed response:', systemed.content[0].text);

  // 6. Streaming. messages.stream returns an async iterable of events;
  //    text_delta events carry the incremental text.
  console.log('\nStreaming response:');
  const stream = await client.messages.stream({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [
      { role: 'user', content: 'Count to five, one number per line.' },
    ],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
  process.stdout.write('\n');
}

main().catch((err) => {
  console.error('Quickstart failed:', err);
  process.exit(1);
});
