#!/usr/bin/env ts-node
/**
 * Generate launch announcements for multiple platforms.
 * Usage: npx ts-node src/launch/scripts/generate-announcements.ts --version 1.1.1
 */
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';

async function main() {
  console.log(`📢 Generating announcements for v${version}...`);

  const reportDir = path.resolve('launch-report');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const announcement = `🚀 TealTiger v${version} is live!\n\n` +
    `AI agent security SDK with 7 LLM providers, 95%+ market coverage.\n\n` +
    `What's included:\n` +
    `• TealEngine — Policy evaluation with ENFORCE/MONITOR/REPORT_ONLY modes\n` +
    `• TealGuard — Client-side guardrails (PII, prompt injection, content moderation)\n` +
    `• TealCircuit — Circuit breaker for cascading failure prevention\n` +
    `• TealAudit — Audit logging with security-by-default redaction\n` +
    `• 7 providers: OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral\n\n` +
    `Install:\n` +
    `  npm install tealtiger\n` +
    `  pip install tealtiger\n\n` +
    `Docs: https://docs.tealtiger.ai\n` +
    `npm: https://www.npmjs.com/package/tealtiger\n` +
    `PyPI: https://pypi.org/project/tealtiger/\n`;

  fs.writeFileSync(path.join(reportDir, 'announcement.txt'), announcement);
  console.log(`✅ Announcements generated at ${reportDir}/announcement.txt`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
