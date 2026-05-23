const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

const schemaPath = path.resolve(__dirname, '..', 'schemas', 'tealtiger-policy.schema.json');

function printUsage(): void {
  console.log('Usage: npx ts-node scripts/validate-policy.ts <policy.json>');
  console.log('');
  console.log('Validates a TealTiger policy JSON file against schemas/tealtiger-policy.schema.json.');
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read or parse JSON file "${filePath}": ${message}`);
  }
}

function formatInstancePath(instancePath: string): string {
  return instancePath.length > 0 ? instancePath : '<root>';
}

function main(): number {
  const [, , policyFile] = process.argv;

  if (!policyFile || policyFile === '--help' || policyFile === '-h') {
    printUsage();
    return policyFile ? 0 : 1;
  }

  const policyPath = path.resolve(process.cwd(), policyFile);
  const schema = readJsonFile(schemaPath) as Record<string, unknown>;
  const policy = readJsonFile(policyPath);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const isValid = validate(policy);

  if (isValid) {
    console.log(`Policy is valid: ${policyFile}`);
    return 0;
  }

  console.error(`Policy is invalid: ${policyFile}`);
  for (const error of validate.errors ?? []) {
    const location = formatInstancePath(error.instancePath);
    console.error(`- ${location}: ${error.message}`);
  }

  return 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

export {};
