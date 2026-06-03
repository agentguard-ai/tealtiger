/**
 * observe() Quickstart — TypeScript
 *
 * Zero-config instrumentation for OpenAI and Anthropic clients.
 * Runs without real API keys: mock adapters simulate LLM responses
 * so the governance layer (cost tracking, audit log, PII detection)
 * can be exercised locally.
 *
 * Run:
 *   npx ts-node examples/observe-quickstart.ts
 */

import { observe, freeze, unfreeze } from 'tealtiger';

// ---------------------------------------------------------------------------
// Mock clients — stand-ins for real openai / @anthropic-ai/sdk instances.
// Replace with the real SDK clients and your API keys in production.
// ---------------------------------------------------------------------------

const mockOpenAI = {
  chat: {
    completions: {
      create: async (params: Record<string, unknown>) => ({
        id: 'chatcmpl-mock-001',
        object: 'chat.completion',
        model: params.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '[mock] OpenAI response via TealTiger observe()',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 },
      }),
    },
  },
};

const mockAnthropic = {
  messages: {
    create: async (params: Record<string, unknown>) => ({
      id: 'msg-mock-001',
      type: 'message',
      role: 'assistant',
      model: params.model,
      content: [
        { type: 'text', text: '[mock] Anthropic response via TealTiger observe()' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 14, output_tokens: 11 },
    }),
  },
};

// ---------------------------------------------------------------------------
// 1. Zero-config observe() — one line instruments the client
// ---------------------------------------------------------------------------

async function zeroConfigExample() {
  console.log('\n--- 1. Zero-config observe() ---');

  // observe() wraps the client and auto-enables cost tracking,
  // audit logging, and PII detection with sensible defaults.
  const openai = observe(mockOpenAI);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'What is TealTiger?' }],
  });

  console.log('Response:', response.choices[0].message.content);
}

// ---------------------------------------------------------------------------
// 2. Named agent with session tracking
// ---------------------------------------------------------------------------

async function namedAgentExample() {
  console.log('\n--- 2. Named agent + session ID ---');

  // agentId groups all calls under one logical agent in the audit log.
  // sessionId ties calls within a single user conversation together.
  const anthropic = observe(mockAnthropic, {
    agentId: 'support-bot',
    sessionId: 'sess-abc-123',
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: 'Summarise the TealTiger governance model.' }],
  });

  console.log('Response:', response.content[0].text);
}

// ---------------------------------------------------------------------------
// 3. freeze() / unfreeze() — emergency circuit-breaker
// ---------------------------------------------------------------------------

async function circuitBreakerExample() {
  console.log('\n--- 3. freeze() / unfreeze() ---');

  const openai = observe(mockOpenAI, { agentId: 'billing-agent' });

  // Freeze the agent immediately — all subsequent calls will be blocked
  // until unfreeze() is called. Use this when you detect anomalous behaviour
  // or want to halt an agent during an incident.
  freeze('billing-agent');
  console.log('Agent frozen. Calls will be blocked.');

  try {
    await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Process payment for order #99' }],
    });
  } catch (err) {
    // Expected: FrozenAgentError
    console.log('Blocked as expected:', (err as Error).message);
  }

  // Unfreeze when the incident is resolved.
  unfreeze('billing-agent');
  console.log('Agent unfrozen. Resuming normal operation.');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Process payment for order #99' }],
  });
  console.log('Response after unfreeze:', response.choices[0].message.content);
}

// ---------------------------------------------------------------------------
// 4. Both providers side-by-side (multi-provider setup)
// ---------------------------------------------------------------------------

async function multiProviderExample() {
  console.log('\n--- 4. Multi-provider under one agentId ---');

  // The same agentId can be applied to different provider clients.
  // All calls appear together in the governance audit log.
  const openai = observe(mockOpenAI, { agentId: 'research-agent' });
  const anthropic = observe(mockAnthropic, { agentId: 'research-agent' });

  const [oaiRes, antRes] = await Promise.all([
    openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Explain tool use in OpenAI.' }],
    }),
    anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Explain tool use in Anthropic.' }],
    }),
  ]);

  console.log('OpenAI:', oaiRes.choices[0].message.content);
  console.log('Anthropic:', antRes.content[0].text);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

(async () => {
  await zeroConfigExample();
  await namedAgentExample();
  await circuitBreakerExample();
  await multiProviderExample();
  console.log('\nDone. In production, swap mock clients for real SDK instances.');
})();
