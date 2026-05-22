const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const validatorPath = path.join(repoRoot, 'scripts', 'validate-policy.ts');

function runValidator(policyPath: string) {
  return spawnSync(
    process.execPath,
    ['-r', 'ts-node/register', validatorPath, policyPath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );
}

const validResult = runValidator('test-policies/valid-policy.json');
assert.equal(validResult.status, 0, validResult.stderr || validResult.stdout);
assert.match(validResult.stdout, /Policy is valid/);

const invalidResult = runValidator('test-policies/invalid-policy.json');
assert.equal(invalidResult.status, 1, invalidResult.stderr || invalidResult.stdout);
assert.match(invalidResult.stderr, /Policy is invalid/);
assert.match(invalidResult.stderr, /required property 'allowed'/);
assert.match(invalidResult.stderr, /must be >= 1/);

console.log('Policy validator tests passed.');

export {};
