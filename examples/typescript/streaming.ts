/**
 * TealOpenAI Streaming Example
 *
 * Shortest runnable example of wrapping OpenAI's chat completions API with
 * TealTiger's guardrails and cost tracking, using streaming. Run with:
 *
 *   OPENAI_API_KEY=sk-... ts-node examples/typescript/streaming.ts
 *
 * Compile-only (no key needed):
 *
 *   tsc --noEmit examples/typescript/streaming.ts
 *
 * OpenAI-specific notes this example demonstrates:
 *   - streaming is a flag on create(): `stream: true`
 *   - the returned value is an async iterable of ChatCompletionChunk
 *   - each chunk's delta.content carries the incremental text
 *   - the final chunk has finish_reason set; earlier chunks do not
 *   - guardrails run on the assembled response body when streaming
 *     completes, so the handler below re-concatenates the deltas
 */

import {
  TealOpenAI,
  GuardrailEngine,
  PIIDetectionGuardrail,
  ContentModerationGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage,
} from 'tealtiger';

async function main() {
  // 1. Guardrails: redact PII, block anything flagged as unsafe content.
  //    These guardrails run on the streamed response as well -- when the
  //    stream finishes, the concatenated text is passed through the
  //    engine before `security` is attached to the terminal chunk.
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
  //    Streaming calls are billed once the stream completes, using the
  //    accumulated token count reported by the final chunk.
  const storage = new InMemoryCostStorage();
  const costTracker = new CostTracker({
    enabled: true,
    persistRecords: true,
    enableBudgets: true,
    enableAlerts: true,
  });
  const budgetManager = new BudgetManager(storage);
  budgetManager.createBudget({
    name: 'Streaming Example Daily Budget',
    limit: 5.0,
    period: 'daily',
    alertThresholds: [50, 75, 90],
    action: 'alert',
    enabled: true,
  });

  // 3. TealOpenAI is a drop-in wrapper around the OpenAI SDK. The
  //    chat.completions.create shape matches upstream; TealTiger adds a
  //    `security` envelope to the response with guardrail + cost metadata.
  const client = new TealOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
    agentId: 'streaming-example-agent',
    guardrailEngine,
    costTracker,
    budgetManager,
    costStorage: storage,
  });

  // 4. Non-streaming baseline so the streaming section below has a point
  //    of comparison. Same method, no `stream: true` flag, response is
  //    awaited as a single object.
  console.log('--- Non-streaming baseline ---');
  const baseline = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'In one sentence, what does TealTiger do?' },
    ],
    max_tokens: 120,
  });
  console.log(baseline.choices[0].message.content);
  if (baseline.security?.costRecord) {
    console.log(`Cost: $${baseline.security.costRecord.actualCost.toFixed(6)}`);
  }

  // 5. Streaming. The async iterator yields ChatCompletionChunk objects;
  //    each chunk's `choices[0].delta.content` is the incremental text.
  //    Wrap the iteration in try/catch so a mid-stream interruption
  //    (network drop, abort signal, server error) is surfaced cleanly
  //    and any partial output is still printed.
  console.log('\n--- Streaming response ---');
  let accumulated = '';
  let chunkCount = 0;
  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Count to five, one number per line.' },
      ],
      max_tokens: 120,
      stream: true,
    });

    for await (const chunk of stream) {
      chunkCount += 1;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        accumulated += delta;
        process.stdout.write(delta);
      }

      // finish_reason is set on the terminal chunk. The security envelope
      // is attached here as well, after guardrails run on the assembled
      // body.
      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason) {
        process.stdout.write('\n');
        console.log(`[stream finished: reason=${finishReason}, chunks=${chunkCount}]`);
        if (chunk.security?.costRecord) {
          console.log(
            `Cost: $${chunk.security.costRecord.actualCost.toFixed(6)}`,
          );
        }
        if (chunk.security?.guardrailResults) {
          const redactions = chunk.security.guardrailResults.filter(
            (r) => r.action === 'redact',
          );
          if (redactions.length > 0) {
            console.log(`Guardrails redacted ${redactions.length} match(es).`);
          }
        }
      }
    }
  } catch (err) {
    // Stream interruptions arrive here. Print whatever accumulated so the
    // user sees partial output rather than an empty terminal, then surface
    // the original error so the process exits non-zero.
    process.stdout.write('\n');
    console.error(
      `[stream interrupted after ${chunkCount} chunk(s); partial output of ${accumulated.length} char(s) printed above]`,
    );
    throw err;
  }
}

main().catch((err) => {
  console.error('Streaming example failed:', err);
  process.exit(1);
});
