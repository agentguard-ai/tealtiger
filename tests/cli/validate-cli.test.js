'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = resolve(__dirname, '..', '..');
const cliPath = join(repoRoot, 'bin', 'tealtiger.js');

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('validate command accepts a valid JSON policy', () => {
  const result = runCli(['validate', 'test-policies/valid-policy.json']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Policy is valid/);
});

test('validate command rejects a policy with missing required fields', () => {
  const result = runCli(['validate', 'test-policies/invalid-policy.json']);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /Policy is invalid/);
  assert.match(result.stderr, /required property 'allowed'/);
  assert.match(result.stderr, /must be >= 1/);
});

test('validate command rejects unknown policy fields', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-policy-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const policyPath = join(directory, 'unknown-field.json');
  writeFileSync(policyPath, JSON.stringify({ unknown: true }), 'utf8');

  const result = runCli(['validate', policyPath]);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /must NOT have additional properties/);
});

test('validate command accepts YAML policy files', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tealtiger-policy-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const policyPath = join(directory, 'valid-policy.yaml');
  writeFileSync(policyPath, [
    'tools:',
    '  search_docs:',
    '    allowed: true',
    'identity:',
    '  agentId: support-agent',
    '  role: customer-support',
    '  permissions:',
    '    - search:docs',
    '',
  ].join('\n'), 'utf8');

  const result = runCli(['validate', policyPath]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Policy is valid/);
});
