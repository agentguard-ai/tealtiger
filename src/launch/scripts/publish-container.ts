#!/usr/bin/env ts-node
/**
 * Publish to GHCR or Docker Hub.
 * Usage: npx ts-node src/launch/scripts/publish-container.ts --target ghcr|dockerhub --version 1.1.1
 */
import { ContainerPublisher } from '../ContainerPublisher';
import { CredentialManager } from '../CredentialManager';
import { ErrorHandler } from '../ErrorHandler';

const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx !== -1 ? args[targetIdx + 1] : '';
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';

async function main() {
  if (!target || !['ghcr', 'dockerhub'].includes(target)) {
    console.error('Usage: --target ghcr|dockerhub --version X.Y.Z');
    process.exit(1);
  }

  const publisher = new ContainerPublisher({
    credentialManager: new CredentialManager(),
    errorHandler: new ErrorHandler(),
  });

  console.log(`🐳 Publishing container to ${target} v${version}...`);
  const results = await publisher.publish(version);
  const result = results.find((r) => r.channel === target);

  if (!result || result.status === 'failed') {
    console.error(`❌ ${target} publish failed: ${result?.error || 'unknown'}`);
    process.exit(1);
  }
  console.log(`✅ ${target} published: ${result.artifactUrl}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
