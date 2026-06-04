/**
 * Property 3: PII detected in input is always redacted before forwarding
 *
 * For any request content containing PII patterns (emails, phone numbers, SSNs, etc.),
 * the transformParams hook SHALL produce output content where every detected PII entity
 * is replaced with a redaction placeholder, and the original PII value does not appear
 * in the forwarded parameters.
 *
 * Feature: vercel-ai-sdk-integration, Property 3: PII redacted in transformParams
 *
 * **Validates: Requirements 2.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbContentWithPii } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import { createTransformParamsHook } from '../../hooks/transformParams';
import type { Decision } from '../../types/decision';

// ── PII Redaction Placeholders ───────────────────────────────────

const PII_PLACEHOLDERS: Record<string, string> = {
  email: '[REDACTED:EMAIL]',
  phone: '[REDACTED:PHONE]',
  ssn: '[REDACTED:SSN]',
  creditCard: '[REDACTED:CREDIT_CARD]',
};

// ── PII-Detecting Guard Mock ─────────────────────────────────────

/**
 * Creates a mock TealGuard that detects PII patterns and returns redacted content.
 * This simulates realistic PII detection + redaction behavior for property testing.
 */
function createPiiRedactingGuard() {
  const PII_REGEX_MAP: Record<string, RegExp> = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\(\d{3}\)\s?\d{3}-\d{4}/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    creditCard: /\d{4}-\d{4}-\d{4}-\d{4}/g,
  };

  return {
    async check(input: string, _context?: unknown): Promise<Decision> {
      let redactedContent = input;
      let piiDetected = false;
      const detectedTypes: string[] = [];

      for (const [type, regex] of Object.entries(PII_REGEX_MAP)) {
        const matches = input.match(regex);
        if (matches && matches.length > 0) {
          piiDetected = true;
          detectedTypes.push(type);
          const placeholder = PII_PLACEHOLDERS[type] ?? `[REDACTED:${type.toUpperCase()}]`;
          redactedContent = redactedContent.replace(regex, placeholder);
        }
      }

      if (piiDetected) {
        return {
          action: 'REDACT',
          reason_codes: ['PII_DETECTED'],
          risk_score: 60,
          correlation_id: '',
          reason: 'PII detected and redacted',
          metadata: {
            redactedContent,
            pii_types: detectedTypes,
          },
        };
      }

      return {
        action: 'ALLOW',
        reason_codes: ['POLICY_COMPLIANT'],
        risk_score: 0,
        correlation_id: '',
        reason: 'No PII detected',
      };
    },
  };
}

// ── Extract PII Value from Generated Content ─────────────────────

/**
 * Extracts the actual PII value embedded in generated content based on PII type.
 */
function extractPiiValue(content: string, piiType: string): string | null {
  const patterns: Record<string, RegExp> = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phone: /\(\d{3}\)\s?\d{3}-\d{4}/,
    ssn: /\d{3}-\d{2}-\d{4}/,
    creditCard: /\d{4}-\d{4}-\d{4}-\d{4}/,
  };

  const regex = patterns[piiType];
  if (!regex) return null;

  const match = content.match(regex);
  return match ? match[0] : null;
}

// ── Property Test ────────────────────────────────────────────────

describe('Feature: vercel-ai-sdk-integration, Property 3: PII redacted in transformParams', () => {
  it('PII detected in input is always redacted before forwarding', async () => {
    await fc.assert(
      fc.asyncProperty(arbContentWithPii(), async ({ content, piiType }) => {
        // Set up orchestrator with PII-redacting guard injected
        const orchestrator = new GovernanceOrchestrator({});

        // Inject the PII-redacting mock guard directly
        const guard = createPiiRedactingGuard();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (orchestrator as any).guard = guard;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (orchestrator as any).initialized = true;

        // Create the transformParams hook
        const transformParams = createTransformParamsHook(orchestrator);

        // Build params with the PII-containing content as a user message
        const params: Record<string, unknown> = {
          modelId: 'openai/gpt-4',
          prompt: [
            { role: 'user', content },
          ],
        };

        // Extract the actual PII value from the content
        const piiValue = extractPiiValue(content, piiType);
        expect(piiValue).not.toBeNull();

        // Execute the transformParams hook
        const result = await transformParams({ params });

        // Extract the output content from the transformed params
        const outputMessages = result.prompt as Array<{ role: string; content: string }>;
        const outputContent = outputMessages
          .filter((m) => m.role === 'user')
          .map((m) => m.content)
          .join('\n');

        // PROPERTY: The original PII value must NOT appear in the output
        expect(outputContent).not.toContain(piiValue!);

        // PROPERTY: A redaction placeholder must appear in the output
        const expectedPlaceholder = PII_PLACEHOLDERS[piiType];
        expect(outputContent).toContain(expectedPlaceholder);

        // PROPERTY: The content modification metadata must be set
        const metadata = result.providerMetadata as Record<string, unknown>;
        const tealtigerMeta = metadata?.tealtiger as Record<string, unknown>;
        expect(tealtigerMeta?.contentModified).toBe(true);
        expect(tealtigerMeta?.governanceApplied).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
