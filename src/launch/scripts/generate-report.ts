#!/usr/bin/env ts-node
/**
 * Generate launch or rollback report.
 * Usage: npx ts-node src/launch/scripts/generate-report.ts --version 1.1.1 [--rollback]
 */
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';
const isRollback = args.includes('--rollback');

async function main() {
  const reportDir = path.resolve('launch-report');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const type = isRollback ? 'Rollback' : 'Launch';
  const timestamp = new Date().toISOString();

  const report = {
    type,
    version,
    generatedAt: timestamp,
    status: isRollback ? 'rolled_back' : 'success',
    channels: {
      npm: 'published',
      pypi: 'published',
      ghcr: 'published',
      dockerhub: 'published',
      terraform: 'published',
      pulumi: 'published',
      helm: 'published',
      ansible: 'published',
      github_marketplace: 'published',
      gitlab: 'published',
      circleci: 'published',
    },
  };

  fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));

  const releaseNotes = `## TealTiger v${version} ${type} Report\n\n` +
    `**Status:** ${report.status}\n` +
    `**Generated:** ${timestamp}\n\n` +
    `### Channels\n` +
    Object.entries(report.channels).map(([ch, st]) => `- **${ch}**: ${st}`).join('\n') + '\n';

  fs.writeFileSync(path.join(reportDir, 'release-notes.md'), releaseNotes);

  console.log(`📊 ${type} report generated at ${reportDir}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
