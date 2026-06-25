const { validatePolicyFile } = require('../cli/policy-validator');

function printUsage(): void {
  console.log('Usage: npx ts-node scripts/validate-policy.ts <policy.json|policy.yaml>');
  console.log('');
  console.log('Validates a TealTiger policy JSON or YAML file against schemas/tealtiger-policy.schema.json.');
}

function main(): number {
  const [, , policyFile] = process.argv;

  if (!policyFile || policyFile === '--help' || policyFile === '-h') {
    printUsage();
    return policyFile ? 0 : 1;
  }

  return validatePolicyFile(policyFile);
}

try {
  process.exitCode = main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

export {};
