import { createGovernanceApiServer } from './server';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.TEALTIGER_DB_URL ?? 'file:./data/tealtiger-events.sqlite';

async function main(): Promise<void> {
  const { app } = await createGovernanceApiServer({
    databaseUrl,
    logger: true,
  });

  await app.listen({ port, host });

  const shutdown = (): void => {
    app.close().then(() => process.exit(0)).catch(() => process.exit(1));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
