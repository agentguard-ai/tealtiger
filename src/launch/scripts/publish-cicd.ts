#!/usr/bin/env ts-node
/**
 * Publish to CI/CD marketplaces (GitHub, GitLab, CircleCI).
 * Usage: npx ts-node src/launch/scripts/publish-cicd.ts --target github_marketplace|gitlab|circleci --version 1.1.1
 */
import { CICDPublisher } from '../CICDPublisher';
import { CredentialManager } from '../CredentialManager';
import { ErrorHandler } from '../ErrorHandler';

const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx !== -1 ? args[targetIdx + 1] : '';
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';

async function main() {
  const valid = ['github_marketplace', 'gitlab', 'circleci'];
  if (!target || !valid.includes(target)) {
    console.error(`Usage: --target ${valid.join('|')} --version X.Y.Z`);
    process.exit(1);
  }

  const publisher = new CICDPublisher({
    credentialManager: new CredentialManager(),
    errorHandler: new ErrorHandler(),
  });

  console.log(`🔄 Publishing to ${target} v${version}...`);
  const results = await publisher.publish(version);
  const result = results.find((r) => r.channel === target);

  if (!result || result.status === 'failed') {
    console.error(`❌ ${target} publish failed: ${result?.error || 'unknown'}`);
    process.exit(1);
  }
  console.log(`✅ ${target} published: ${result.artifactUrl}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
