#!/usr/bin/env node
'use strict';

/**
 * TealTiger Post-Install Message
 * Shows a welcome message after `npm install tealtiger`.
 * Add to package.json: "scripts": { "postinstall": "node scripts/postinstall.js" }
 */

if (
  process.env.CI ||
  process.env.DOCKER ||
  process.env.TEALTIGER_QUIET ||
  process.env.npm_config_loglevel === 'silent'
) {
  process.exit(0);
}

const R = '\x1b[0m', B = '\x1b[1m', T = '\x1b[36m', D = '\x1b[2m', G = '\x1b[32m';

console.log(`
${T}${B}  🐯 TealTiger installed successfully!${R}
${D}  ─────────────────────────────────────────────${R}

  ${G}Quick start:${R}
    import { TealOpenAI } from 'tealtiger';
    const client = new TealOpenAI({ apiKey: '...' });

  ${G}Docs:${R}        https://github.com/agentguard-ai/tealtiger#quick-start
  ${G}Dashboard:${R}   npx tealtiger dashboard
  ${G}Discord:${R}     https://discord.gg/X2ePf8QAj

  ${T}Got 30 seconds? Tell us what you're building:${R}
  ${B}https://tally.so/r/aQzapZ${R}

${D}  Suppress: TEALTIGER_QUIET=1${R}
`);
