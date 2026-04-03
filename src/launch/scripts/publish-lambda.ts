#!/usr/bin/env ts-node
/**
 * Publish Lambda layers to all regions.
 * Usage: npx ts-node src/launch/scripts/publish-lambda.ts --version 1.1.1
 */
import { LambdaPublisher } from '../LambdaPublisher';
import { CredentialManager } from '../CredentialManager';
import { ErrorHandler } from '../ErrorHandler';

const args = process.argv.slice(2);
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';

async function main() {
  const publisher = new LambdaPublisher({
    credentialManager: new CredentialManager(),
    errorHandler: new ErrorHandler(),
  });

  console.log(`λ Publishing Lambda layers v${version}...`);
  const results = await publisher.publish(version);
  const failed = results.filter((r) => r.status === 'failed');

  if (failed.length > 0) {
    console.error(`❌ ${failed.length} Lambda publish(es) failed`);
    failed.forEach((f) => console.error(`  - ${f.channel}: ${f.error}`));
    process.exit(1);
  }
  console.log(`✅ Lambda layers published successfully`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
