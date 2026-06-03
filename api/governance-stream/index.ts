import { createGovernanceStreamServer } from './server';

export { BoundedEventQueue } from './client-buffer';
export { GovernanceEventStream } from './event-stream';
export { attachTealEngineStreaming, normalizeDecision, publishDecision } from './teal-engine-adapter';
export { createGovernanceStreamServer, GovernanceStreamServer } from './server';
export type {
  GovernanceEventMessage,
  PublishOptions,
  StreamMessage,
  StreamMetrics,
  SubscriptionFilter,
  TEECReceipt,
} from './types';

if (require.main === module) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '0.0.0.0';
  const server = createGovernanceStreamServer();

  server.start(port, host)
    .then(({ wsUrl, httpUrl }) => {
      console.log(`Governance event WebSocket listening at ${wsUrl}/ws/events`);
      console.log(`SSE fallback listening at ${httpUrl}/sse/events`);

      const shutdown = (): void => {
        server.stop().then(() => process.exit(0)).catch(() => process.exit(1));
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

