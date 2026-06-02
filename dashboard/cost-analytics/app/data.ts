import type { AgentId, CostEvent, Provider } from './types';

export const AGENTS: AgentId[] = [
  'finance-agent',
  'support-agent',
  'admin-agent',
  'code-agent',
  'research-agent',
];

export const AGENT_COLORS: Record<AgentId, string> = {
  'finance-agent': '#147d64',
  'support-agent': '#2f6fdd',
  'admin-agent': '#a05d00',
  'code-agent': '#8b5cf6',
  'research-agent': '#be3455',
};

export const PROVIDER_COLORS: Record<Provider, string> = {
  OpenAI: '#147d64',
  Anthropic: '#2f6fdd',
  'AWS Bedrock': '#a05d00',
  'Google Vertex': '#8b5cf6',
  Mistral: '#be3455',
};

export const AGENT_BUDGETS: Record<AgentId, number> = {
  'finance-agent': 92,
  'support-agent': 68,
  'admin-agent': 55,
  'code-agent': 74,
  'research-agent': 48,
};

const PROVIDERS: Provider[] = ['OpenAI', 'Anthropic', 'AWS Bedrock', 'Google Vertex', 'Mistral'];
const TOOLS = ['stripe.charge', 'delete_user', 'export_data', 'github.merge', 'vector.search', 'crm.update', 'report.generate', 'ticket.reply'];
const MODELS = ['gpt-4.1-mini', 'claude-3.7-sonnet', 'bedrock/llama3', 'gemini-2.5-flash', 'mistral-large'];

const SAMPLE_END = Date.UTC(2026, 4, 31, 18, 0, 0);
const HOURS = 24 * 14;

export const SAMPLE_RANGE = {
  from: toDateInput(new Date(SAMPLE_END - (HOURS - 1) * 60 * 60 * 1000)),
  to: toDateInput(new Date(SAMPLE_END)),
};

export const SAMPLE_COST_EVENTS = createSampleCostEvents();

function createSampleCostEvents(): CostEvent[] {
  const events: CostEvent[] = [];
  let sequence = 0;

  for (let hour = 0; hour < HOURS; hour += 1) {
    const timestamp = new Date(SAMPLE_END - (HOURS - hour) * 60 * 60 * 1000);
    const hourOfDay = timestamp.getUTCHours();
    const businessHoursMultiplier = hourOfDay >= 13 && hourOfDay <= 21 ? 1.35 : 0.72;

    AGENTS.forEach((agent, agentIndex) => {
      const calls = 2 + ((hour + agentIndex * 3) % 5);
      for (let call = 0; call < calls; call += 1) {
        const provider = PROVIDERS[(hour + call + agentIndex) % PROVIDERS.length];
        const tool = TOOLS[(hour * 2 + call + agentIndex * 3) % TOOLS.length];
        const model = MODELS[(hour + call + agentIndex) % MODELS.length];
        const spike = shouldSpike(hour, agentIndex, call) ? 4.8 : 1;
        const baseCost = 0.018 + agentIndex * 0.009 + call * 0.004;
        const providerMultiplier = 1 + (PROVIDERS.indexOf(provider) * 0.09);
        const costUsd = roundCurrency(baseCost * businessHoursMultiplier * providerMultiplier * spike);

        events.push({
          id: `call-${sequence++}`,
          timestamp: new Date(timestamp.getTime() + call * 6 * 60 * 1000).toISOString(),
          agent,
          tool,
          provider,
          model,
          inputTokens: 900 + ((hour + call + agentIndex) * 137) % 5600,
          outputTokens: 240 + ((hour * 11 + call + agentIndex) * 73) % 2600,
          costUsd,
          latencyMs: 420 + ((hour + call + agentIndex) * 97) % 2800,
        });
      }
    });
  }

  return events;
}

function shouldSpike(hour: number, agentIndex: number, call: number): boolean {
  return call === 0 && (
    (hour === 74 && agentIndex === 0)
    || (hour === 121 && agentIndex === 3)
    || (hour === 206 && agentIndex === 4)
    || (hour === 275 && agentIndex === 2)
  );
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
