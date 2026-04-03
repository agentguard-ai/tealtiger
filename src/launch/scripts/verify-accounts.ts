#!/usr/bin/env ts-node
/**
 * Verify registry accounts — pre-flight check for launch workflow.
 * Usage: npx ts-node src/launch/scripts/verify-accounts.ts --version 1.1.1 [--skip channel1,channel2]
 */
import { CredentialManager, REQUIRED_CREDENTIALS } from '../CredentialManager';

const args = process.argv.slice(2);
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';
const skipIdx = args.indexOf('--skip');
const skipChannels = skipIdx !== -1 ? args[skipIdx + 1].split(',') : [];

async function main() {
  console.log(`🔍 Verifying registry accounts for v${version}...`);
  const cm = new CredentialManager();
  const errors: string[] = [];

  for (const [channel] of REQUIRED_CREDENTIALS.entries()) {
    if (skipChannels.includes(channel)) {
      console.log(`  ⏭️  ${channel} — skipped`);
      continue;
    }
    try {
      await cm.getCredentials(channel);
      console.log(`  ✅ ${channel} — credentials valid`);
    } catch (e: any) {
      console.log(`  ❌ ${channel} — ${e.message}`);
      errors.push(channel);
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} channel(s) failed verification: ${errors.join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ All registry accounts verified.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
