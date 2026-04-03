#!/usr/bin/env ts-node
/**
 * Publish to npm or PyPI.
 * Usage: npx ts-node src/launch/scripts/publish-package.ts --target npm|pypi --version 1.1.1
 */
import { PackagePublisher } from '../PackagePublisher';
import { CredentialManager } from '../CredentialManager';
import { ErrorHandler } from '../ErrorHandler';

const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx !== -1 ? args[targetIdx + 1] : '';
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';

async function main() {
  if (!target || !['npm', 'pypi'].includes(target)) {
    console.error('Usage: --target npm|pypi --version X.Y.Z');
    process.exit(1);
  }

  const publisher = new PackagePublisher({
    credentialManager: new CredentialManager(),
    errorHandler: new ErrorHandler(),
  });

  console.log(`📦 Publishing to ${target} v${version}...`);
  const result = target === 'npm'
    ? await publisher.publishToNpm(version)
    : await publisher.publishToPyPI(version);

  if (result.status === 'failed') {
    console.error(`❌ ${target} publish failed: ${result.error}`);
    process.exit(1);
  }
  console.log(`✅ ${target} published: ${result.artifactUrl}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
