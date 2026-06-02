import { createGovernanceStreamServer } from '../../api/governance-stream';
import type { TEECReceipt } from '../../api/governance-stream';

const AGENTS = ['finance-agent', 'support-agent', 'admin-agent', 'code-agent', 'research-agent'];
const TOOLS = ['stripe.charge', 'delete_user', 'export_data', 'github.merge', 'vector.search', 'crm.update'];
const DECISIONS = ['ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL'] as const;
const REASONS = [
  'Policy: budget_under_limit',
  'Tool not in allowlist',
  'Requires human sign-off',
  'Output must remove customer identifier',
  'Risk score above delegated threshold',
  'Policy: scoped token and audit receipt present',
];

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const eventsPerSecond = Number(process.env.EVENTS_PER_SECOND ?? 125);
const intervalMs = 100;
const eventsPerTick = Math.max(1, Math.round(eventsPerSecond / (1000 / intervalMs)));

let sequence = 0;

const server = createGovernanceStreamServer({
  historyLimit: 20_000,
  heartbeatIntervalMs: 10_000,
});

server.start(port, host)
  .then(({ wsUrl, httpUrl }) => {
    console.log(`Dashboard mock stream publishing ${eventsPerTick * (1000 / intervalMs)} events/sec`);
    console.log(`Governance event WebSocket listening at ${wsUrl}/ws/events`);
    console.log(`SSE fallback listening at ${httpUrl}/sse/events`);

    const publisher = setInterval(() => {
      for (let index = 0; index < eventsPerTick; index += 1) {
        server.publish(createReceipt(sequence++));
      }
    }, intervalMs);

    const shutdown = async (): Promise<void> => {
      clearInterval(publisher);
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

function createReceipt(index: number): TEECReceipt {
  const decision = DECISIONS[index % DECISIONS.length];
  const agent = AGENTS[index % AGENTS.length];
  const tool = TOOLS[(index * 5) % TOOLS.length];
  const latency = 0.8 + ((index * 17) % 70) / 10;
  const riskScore = Number((((index * 13) % 100) / 100).toFixed(2));
  const timestamp = new Date().toISOString();

  return {
    schema_version: '1.0.0',
    event_id: `demo-${index}`,
    event_type: 'governance.decision',
    source: 'tealtiger-dashboard-demo',
    timestamp,
    correlation_id: `corr-${Math.floor(index / 8)}`,
    agent_id: agent,
    tool,
    action: tool,
    decision,
    reason: REASONS[index % REASONS.length],
    latency_ms: latency,
    risk_score: riskScore,
    policy_version: 'dashboard-preview-v1',
    teec_receipt: {
      receipt_id: `teec-${index}`,
      issued_at: timestamp,
      subject: agent,
      action: tool,
      decision,
      evidence_hash: `sha256:${(index * 2654435761).toString(16).padStart(16, '0')}`,
      verifier: 'tealtiger-governance-stream',
    },
    metadata: {
      environment: index % 3 === 0 ? 'production' : 'sandbox',
      latency_ms: latency,
      tool,
      trace_id: `trace-${index}`,
    },
  };
}
