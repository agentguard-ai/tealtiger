import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Action = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'REVISE';

type ArgCondition = {
  pattern?: string;
  contains?: string;
};

type Rule = {
  tool: string;
  action: Action;
  reasonCode: string;
  when?: {
    argPattern?: Record<string, string>;
    argContains?: Record<string, string>;
  };
};

type Policy = {
  policyVersion: string;
  pack: string;
  defaultAction: Action;
  maxBudgetUsd: number;
  toolRules: Rule[];
};

type ToolEntry = {
  name: string;
  risk: 'READ' | 'MUTATING' | 'DESTRUCTIVE';
};

type Grant = {
  tool: string;
  status: 'ALLOW' | 'DENY';
};

type TeecReceipt = {
  tool: string;
  action: Action;
  risk: 'READ' | 'MUTATING' | 'DESTRUCTIVE';
};

type Fixture = {
  name: string;
  request: {
    tool: string;
    args: Record<string, unknown>;
    estimated_cost_usd: number;
  };
  expected: {
    action: Action;
    reasonCodes: string[];
    teec: Omit<TeecReceipt, 'action'> & { action: Action };
  };
  expectedSanitized?: Record<string, unknown>;
};

type EvaluationResult = {
  decision: Action;
  reasonCodes: string[];
  teec: {
    policyVersion: string;
    pack: string;
    tool: string;
    action: Action;
    reasonCodes: string[];
    risk: 'READ' | 'MUTATING' | 'DESTRUCTIVE';
    budgetUsd: number;
    sanitized?: Record<string, unknown>;
  };
};

function parsePolicyYaml(raw: string): Policy {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const policy: Policy = {
    policyVersion: 'unknown',
    pack: 'unknown',
    defaultAction: 'ALLOW',
    maxBudgetUsd: Number.POSITIVE_INFINITY,
    toolRules: [],
  };

  let inRule = false;
  let currentRule: Rule | null = null;
  let inWhen = false;
  let whenKey: 'argPattern' | 'argContains' | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    if (!line.startsWith('  ') && /^[a-zA-Z]/.test(line) && !line.startsWith('- ')) {
      inRule = false;
      inWhen = false;
      whenKey = null;
      const topMatch = line.match(/^(\S+):\s*(.*)$/);
      if (!topMatch) {
        continue;
      }

      const key = topMatch[1];
      const value = parseScalar(topMatch[2]);
      if (key === 'policyVersion') {
        policy.policyVersion = String(value);
      } else if (key === 'pack') {
        policy.pack = String(value);
      } else if (key === 'defaultAction') {
        policy.defaultAction = value as Action;
      } else if (key === 'maxBudgetUsd') {
        policy.maxBudgetUsd = Number(value);
      } else if (key === 'toolRules') {
        inRule = false;
      }
      continue;
    }

    if (/^\s{2}-\s+tool:\s*/.test(line)) {
      const tool = parseScalar(line.replace(/^\s{2}-\s+tool:\s*/, ''));
      currentRule = {
        tool: String(tool),
        action: 'ALLOW',
        reasonCode: 'policy_rule',
      };
      policy.toolRules.push(currentRule);
      inRule = true;
      inWhen = false;
      whenKey = null;
      continue;
    }

    if (!inRule || currentRule === null) {
      continue;
    }

    const actionMatch = line.match(/^\s{4}(action):\s*(.*)$/);
    if (actionMatch) {
      currentRule.action = parseScalar(actionMatch[2]) as Action;
      inWhen = false;
      whenKey = null;
      continue;
    }

    const reasonMatch = line.match(/^\s{4}(reasonCode):\s*(.*)$/);
    if (reasonMatch) {
      currentRule.reasonCode = String(parseScalar(reasonMatch[2]));
      continue;
    }

    const whenMatch = line.match(/^\s{4}when:\s*$/);
    if (whenMatch) {
      currentRule.when = {};
      inWhen = true;
      whenKey = null;
      continue;
    }

    const whenTypeMatch = line.match(/^\s{6}(argPattern|argContains):\s*$/);
    if (inWhen && whenTypeMatch) {
      const nextKey = whenTypeMatch[1] as 'argPattern' | 'argContains';
      currentRule.when = currentRule.when || {};
      currentRule.when[nextKey] = {};
      whenKey = nextKey;
      continue;
    }

    const conditionMatch = line.match(/^\s{8}([A-Za-z0-9_]+):\s*(.*)$/);
    if (inWhen && whenKey && conditionMatch) {
      const conditionField = conditionMatch[1];
      const rawValue = parseScalar(conditionMatch[2]);
      if (!currentRule.when) {
        continue;
      }
      if (whenKey === 'argPattern') {
        currentRule.when.argPattern = currentRule.when.argPattern ?? {};
        currentRule.when.argPattern[conditionField] = String(rawValue);
      } else {
        currentRule.when.argContains = currentRule.when.argContains ?? {};
        currentRule.when.argContains[conditionField] = String(rawValue);
      }
    }
  }

  return policy;
}

function parseScalar(value: string): string | number | boolean {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'ALLOW' || trimmed === 'DENY' || trimmed === 'REQUIRE_APPROVAL' || trimmed === 'REVISE') {
    return trimmed;
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }

  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  return trimmed;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function redactValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return value
    .replace(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi,
      '[REDACTED_EMAIL]',
    )
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_PII]')
    .replace(/\b\d{16}\b/g, '[REDACTED_PAN]')
    .trim();
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      output[key] = redactValue(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = sanitizeArgs(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function evaluateCase(
  policy: Policy,
  catalog: Map<string, ToolEntry>,
  grants: Map<string, Grant['status']>,
  fixture: Fixture,
): EvaluationResult {
  const { request } = fixture;
  const catalogEntry = catalog.get(request.tool);

  const reasonCodes: string[] = [];

  let decision: Action = policy.defaultAction;
  if (!catalogEntry) {
    return {
      decision: 'DENY',
      reasonCodes: ['catalog_unknown_tool'],
      teec: {
        policyVersion: policy.policyVersion,
        pack: policy.pack,
        tool: request.tool,
        action: 'DENY',
        reasonCodes: ['catalog_unknown_tool'],
        risk: 'READ',
        budgetUsd: request.estimated_cost_usd,
      },
    };
  }

  reasonCodes.push('catalog_match');

  const grantStatus = grants.get(request.tool);
  if (grantStatus === 'DENY') {
    decision = 'DENY';
    reasonCodes.push('grant_denied');
  }

  for (const rule of policy.toolRules) {
    if (rule.tool !== request.tool) {
      continue;
    }

    if (!rule.when || matchesCondition(request.args, rule.when)) {
      decision = rule.action;
      reasonCodes.push(rule.reasonCode);
      break;
    }
  }

  if (request.estimated_cost_usd > policy.maxBudgetUsd && decision !== 'DENY') {
    decision = 'DENY';
    reasonCodes.push('budget_exceeded');
  } else {
    reasonCodes.push('catalog_allow');
  }

  const result: EvaluationResult = {
    decision,
    reasonCodes,
    teec: {
      policyVersion: policy.policyVersion,
      pack: policy.pack,
      tool: request.tool,
      action: decision,
      reasonCodes: [...reasonCodes],
      risk: catalogEntry.risk,
      budgetUsd: request.estimated_cost_usd,
    },
  };

  if (decision === 'REVISE') {
    result.teec.sanitized = sanitizeArgs(request.args);
  }

  return result;
}

function matchesCondition(
  args: Record<string, unknown>,
  condition: Rule['when'],
): boolean {
  if (!condition) {
    return true;
  }

  const entries = Object.entries(condition.argPattern ?? {});
  for (const [field, pattern] of entries) {
    const value = String(args[field] ?? '');
    if (!new RegExp(pattern, 'i').test(value)) {
      return false;
    }
  }

  for (const [field, needle] of Object.entries(condition.argContains ?? {})) {
    const value = String(args[field] ?? '');
    if (!value.includes(needle)) {
      return false;
    }
  }

  return true;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function runFixtureBatch(baseDir: string): void {
  const policy = parsePolicyYaml(
    readFileSync(join(baseDir, 'policy.yaml'), 'utf8'),
  );
  const tools = readJsonFile<{ tools: ToolEntry[] }>(join(baseDir, 'tool-catalog.json'));
  const grants = new Map<string, Grant['status']>(
    readJsonFile<Grant[]>(join(baseDir, 'grants.json')).map((grant) => [grant.tool, grant.status]),
  );
  const catalog = new Map<string, ToolEntry>(tools.tools.map((tool) => [tool.name, tool]));

  const fixtures = readdirSync(baseDir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => file !== 'tool-catalog.json')
    .filter((file) => file !== 'grants.json')
    .map((file) => readJsonFile<Fixture>(join(baseDir, file)))
    .sort((a, b) => a.name.localeCompare(b.name));

  let passed = 0;
  const errors: string[] = [];

  for (let i = 0; i < fixtures.length; i += 1) {
    const fixture = fixtures[i];
    const result = evaluateCase(policy, catalog, grants, fixture);
    const expected = fixture.expected;
    const expectedReasonCodes = expected.reasonCodes.slice().sort();
    const gotReasonCodes = result.reasonCodes.slice().sort();
    const teecMatch = expected.teec;
    const gotTeec = result.teec;
    const ok = result.decision === expected.action
      && deepEqual(expectedReasonCodes, gotReasonCodes)
      && gotTeec.tool === teecMatch.tool
      && gotTeec.action === teecMatch.action
      && gotTeec.risk === teecMatch.risk;

    const sanitizedOk = fixture.expectedSanitized
      ? deepEqual(result.teec.sanitized, fixture.expectedSanitized)
      : true;

    const passedCase = ok && sanitizedOk;

    if (passedCase) {
      passed += 1;
      console.log(`✓ [${i + 1}] ${fixture.name}`);
    } else {
      errors.push(`${fixture.name}: expected=${JSON.stringify(expected, null, 2)} got=${JSON.stringify(result, null, 2)}`);
      console.log(`✗ [${i + 1}] ${fixture.name}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} fixture failure(s):`);
    errors.forEach((error) => console.error(`- ${error}`));
    console.error(`\nLoaded policy pack: ${policy.pack}`);
    process.exit(1);
  }

  console.log(`Loaded policy pack: ${policy.pack}`);
  console.log(`✓ ${passed} fixture(s) passed.`);
}

runFixtureBatch(join(process.cwd(), 'docs', 'guides', 'policy-pack-authoring'));
