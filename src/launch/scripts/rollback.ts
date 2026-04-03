#!/usr/bin/env ts-node
/**
 * Execute rollback for failed launch.
 * Usage: npx ts-node src/launch/scripts/rollback.ts --version 1.1.1 --reason "message" [--skip channel1,channel2]
 */
import { RollbackSystem } from '../RollbackSystem';
import { CredentialManager } from '../CredentialManager';
import { ErrorHandler } from '../ErrorHandler';

const args = process.argv.slice(2);
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';
const reasonIdx = args.indexOf('--reason');
const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : 'Manual rollback';
const skipIdx = args.indexOf('--skip');
const skipChannels = skipIdx !== -1 ? args[skipIdx + 1].split(',') : [];

async function main() {
  console.log(`⏪ Rolling back v${version}: ${reason}`);
  if (skipChannels.length > 0) {
    console.log(`  Skipping: ${skipChannels.join(', ')}`);
  }

  const rollback = new RollbackSystem({
    credentialManager: new CredentialManager(),
    errorHandler: new ErrorHandler(),
  });

  const result = await rollback.executeRollback(version, reason);

  console.log(`\n📊 Rollback result: ${result.status}`);
  console.log(`  Channels rolled back: ${result.channelResults?.filter((r: any) => r.status === 'success').length || 0}`);
  console.log(`  Channels failed: ${result.channelResults?.filter((r: any) => r.status === 'failed').length || 0}`);

  if (result.status === 'failed') {
    process.exit(1);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
