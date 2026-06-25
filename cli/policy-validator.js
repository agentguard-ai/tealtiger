'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

const DEFAULT_SCHEMA_PATH = path.resolve(__dirname, '..', 'schemas', 'tealtiger-policy.schema.json');

function validatePolicyFile(policyFile, options = {}) {
  const cwd = options.cwd || process.cwd();
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const schemaPath = options.schemaPath || DEFAULT_SCHEMA_PATH;
  const policyPath = path.resolve(cwd, policyFile);

  const schema = readStructuredFile(schemaPath);
  const policy = readStructuredFile(policyPath);
  const validate = createValidator(schema);
  const isValid = validate(policy);

  if (isValid) {
    stdout.write(`Policy is valid: ${policyFile}\n`);
    return 0;
  }

  stderr.write(`Policy is invalid: ${policyFile}\n`);
  for (const error of validate.errors ?? []) {
    stderr.write(`- ${formatInstancePath(error.instancePath)}: ${error.message}\n`);
  }

  return 1;
}

function createValidator(schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

function readStructuredFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const extension = path.extname(filePath).toLowerCase();

  try {
    if (extension === '.yaml' || extension === '.yml') {
      return require('yaml').parse(source);
    }
    return JSON.parse(source);
  } catch (error) {
    const format = extension === '.yaml' || extension === '.yml' ? 'YAML' : 'JSON';
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${format} file "${filePath}": ${message}`);
  }
}

function formatInstancePath(instancePath) {
  return instancePath.length > 0 ? instancePath : '<root>';
}

module.exports = {
  DEFAULT_SCHEMA_PATH,
  formatInstancePath,
  readStructuredFile,
  validatePolicyFile,
};
