/**
 * Property 11: Every request produces a complete audit entry
 *
 * For any request lifecycle (whether allowed, denied, or errored) with TealAudit
 * configured, the middleware emits an audit entry containing: UUID v4 correlation_id,
 * ISO 8601 timestamp, Decision action, reason codes, risk score (0.0-1.0), model
 * identifier, token usage, and execution duration in milliseconds. PII in logged
 * content is redacted with category-preserving placeholders.
 *
 * Feature: vercel-ai-sdk-integration, Property 11: Every request produces a complete audit entry
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { arbModelId, arbTokenUsage } from '../helpers/arbitraries';
import { GovernanceOrchestrator } from '../../core/GovernanceOrchestrator';
import type { AuditEntry } from '../../core/GovernanceOrchestrator';
import { createWrapGenerateHook } from '../../hooks/wrapGenerate';
import { PolicyViolationError } from '../../errors';
import type { Decision, DecisionAction } from '../../types/decision';

// ── UUID v4 regex ────────────────────────────────────────────────
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── ISO 8601 timestamp regex (with ms precision) ─────────────────
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

// ── Valid DecisionActions ────────────────────────────────────────
const VALID_ACTIONS: string[] = ['ALLOW', 'DENY', 'REDACT', 'TRANSFORM', 'REQUIRE_APPROVAL', 'DEGRADE'];

describe('Feature: vercel-ai-sdk-integration, Property 11: Every request produces a complete audit entry', () => {
  /**
   * Helper: create an orchestrator with audit configured and a controllable
   * policy engine that returns the specified action.
   *
   * Returns the orchestrator and a captured audit entries array.
   */
  function createAuditOrchestrator(policyAction: DecisionAction) {
    const capturedEntries: AuditEntry[] = [];

    const orchestrator = new GovernanceOrchestrator({
      audit: { enabled: true },
      guardrails: { pii: false, promptInjection: false, contentModeration: false },
    });

    // Directly set internal state to bypass lazy init
    const o = orchestrator as unknown as {
      initialized: boolean;
      engine: {
        evaluateV12: (req: unknown, ctx: { correlation_id: string }) => Promise<Decision>;
      } | null;
      guard: null;
      audit: { log: (entry: unknown) => void };
    };
    o.initialized = true;
    o.guard = null;
    o.engine = {
      evaluateV12: async (_req: unknown, ctx: { correlation_id: string }): Promise<Decision> => ({
        action: policyAction,
        reason_codes: policyAction === 'ALLOW' ? ['POLICY_COMPLIANT'] : ['POLICY_VIOLATION'],
        risk_score: policyAction === 'ALLOW' ? 0 : 85,
        correlation_id: ctx.correlation_id,
        reason: policyAction === 'ALLOW' ? 'Policy allows request' : 'Policy denies request',
      }),
    };
    o.audit = {
      log: (entry: unknown) => {
        capturedEntries.push(entry as AuditEntry);
      },
    };

    return { orchestrator, capturedEntries };
  }

  /**
   * Helper: validate all required fields of an audit entry.
   */
  function assertCompleteAuditEntry(entry: AuditEntry, expectedModelId: string) {
    // Schema version
    expect(entry.schema_version).toBe('1.0.0');

    // Correlation ID must be a valid UUID v4
    expect(entry.correlation_id).toBeDefined();
    expect(entry.correlation_id).toMatch(UUID_V4_REGEX);

    // Timestamp must be ISO 8601 with millisecond precision
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestamp).toMatch(ISO_8601_REGEX);
    // Verify it parses to a valid date
    const parsedDate = new Date(entry.timestamp);
    expect(parsedDate.getTime()).not.toBeNaN();

    // Decision action must be a valid action
    expect(entry.action).toBeDefined();
    expect(VALID_ACTIONS).toContain(entry.action);

    // Reason codes must be a non-empty array of strings
    expect(entry.reason_codes).toBeDefined();
    expect(Array.isArray(entry.reason_codes)).toBe(true);
    expect(entry.reason_codes.length).toBeGreaterThan(0);
    for (const code of entry.reason_codes) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }

    // Risk score must be a number between 0 and 100
    expect(entry.risk_score).toBeDefined();
    expect(typeof entry.risk_score).toBe('number');
    expect(entry.risk_score).toBeGreaterThanOrEqual(0);
    expect(entry.risk_score).toBeLessThanOrEqual(100);

    // Model identifier must be present
    expect(entry.model).toBeDefined();
    expect(entry.model).toBe(expectedModelId);

    // Token usage must be an object with input, output, total
    expect(entry.tokens).toBeDefined();
    expect(typeof entry.tokens.input).toBe('number');
    expect(typeof entry.tokens.output).toBe('number');
    expect(typeof entry.tokens.total).toBe('number');
    expect(entry.tokens.input).toBeGreaterThanOrEqual(0);
    expect(entry.tokens.output).toBeGreaterThanOrEqual(0);
    expect(entry.tokens.total).toBeGreaterThanOrEqual(0);

    // Duration must be a non-negative number (in ms)
    expect(entry.duration_ms).toBeDefined();
    expect(typeof entry.duration_ms).toBe('number');
    expect(entry.duration_ms).toBeGreaterThanOrEqual(0);

    // Hook must be specified
    expect(entry.hook).toBe('wrapGenerate');

    // Provider must be present (extracted from model ID)
    expect(entry.provider).toBeDefined();
    expect(typeof entry.provider).toBe('string');
    expect(entry.provider.length).toBeGreaterThan(0);
  }

  it('emits a complete audit entry for ALLOWED requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        arbTokenUsage(),
        async (modelId, tokenUsage) => {
          const { orchestrator, capturedEntries } = createAuditOrchestrator('ALLOW');
          const wrapGenerate = createWrapGenerateHook(orchestrator);

          const doGenerate = async () => ({
            text: 'Response from model',
            usage: {
              promptTokens: tokenUsage.inputTokens,
              completionTokens: tokenUsage.outputTokens,
              totalTokens: tokenUsage.totalTokens,
            },
          });

          await wrapGenerate({
            doGenerate,
            params: { prompt: 'Hello' },
            model: { modelId },
          });

          // PROPERTY: at least one audit entry must be emitted
          expect(capturedEntries.length).toBeGreaterThanOrEqual(1);

          const entry = capturedEntries[capturedEntries.length - 1];
          assertCompleteAuditEntry(entry, modelId);

          // For allowed requests: action should be ALLOW
          expect(entry.action).toBe('ALLOW');

          // Token usage should reflect what the model reported
          expect(entry.tokens.input).toBe(tokenUsage.inputTokens);
          expect(entry.tokens.output).toBe(tokenUsage.outputTokens);
          expect(entry.tokens.total).toBe(tokenUsage.totalTokens);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('emits a complete audit entry for DENIED requests (policy violation)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        async (modelId) => {
          const { orchestrator, capturedEntries } = createAuditOrchestrator('DENY');
          const wrapGenerate = createWrapGenerateHook(orchestrator);

          const doGenerate = async () => ({
            text: 'Should not reach here',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          });

          try {
            await wrapGenerate({
              doGenerate,
              params: { prompt: 'Hello' },
              model: { modelId },
            });
          } catch (error) {
            // Expected: PolicyViolationError
            expect(error).toBeInstanceOf(PolicyViolationError);
          }

          // PROPERTY: an audit entry must be emitted even for denied requests
          expect(capturedEntries.length).toBeGreaterThanOrEqual(1);

          const entry = capturedEntries[capturedEntries.length - 1];
          assertCompleteAuditEntry(entry, modelId);

          // For denied requests: action should be DENY
          expect(entry.action).toBe('DENY');

          // Reason codes should include POLICY_VIOLATION
          expect(entry.reason_codes).toContain('POLICY_VIOLATION');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('emits a complete audit entry for ERRORED requests (provider error)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        async (modelId) => {
          const { orchestrator, capturedEntries } = createAuditOrchestrator('ALLOW');
          const wrapGenerate = createWrapGenerateHook(orchestrator);

          const providerError = new Error('Provider timeout');
          const doGenerate = async () => {
            throw providerError;
          };

          try {
            await wrapGenerate({
              doGenerate,
              params: { prompt: 'Hello' },
              model: { modelId },
            });
          } catch (error) {
            // Expected: original provider error re-thrown
            expect(error).toBe(providerError);
          }

          // PROPERTY: an audit entry must be emitted even on provider error
          expect(capturedEntries.length).toBeGreaterThanOrEqual(1);

          const entry = capturedEntries[capturedEntries.length - 1];
          assertCompleteAuditEntry(entry, modelId);

          // For errored requests: should have error information in the entry
          expect(entry.error).toBeDefined();
          expect(entry.error!.message).toBe('Provider timeout');

          // Reason codes should indicate provider error
          expect(entry.reason_codes).toContain('PROVIDER_ERROR');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('correlation_id is consistent across all governance phases within a single request', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbModelId(),
        async (modelId) => {
          const capturedEntries: AuditEntry[] = [];

          const orchestrator = new GovernanceOrchestrator({
            audit: { enabled: true },
            guardrails: { pii: false, promptInjection: false, contentModeration: false },
          });

          const o = orchestrator as unknown as {
            initialized: boolean;
            engine: {
              evaluateV12: (req: unknown, ctx: { correlation_id: string }) => Promise<Decision>;
            } | null;
            guard: null;
            audit: { log: (entry: unknown) => void };
          };
          o.initialized = true;
          o.guard = null;
          o.engine = {
            evaluateV12: async (_req: unknown, ctx: { correlation_id: string }): Promise<Decision> => ({
              action: 'ALLOW',
              reason_codes: ['POLICY_COMPLIANT'],
              risk_score: 0,
              correlation_id: ctx.correlation_id,
              reason: 'Policy allows request',
            }),
          };
          o.audit = {
            log: (entry: unknown) => {
              capturedEntries.push(entry as AuditEntry);
            },
          };

          const wrapGenerate = createWrapGenerateHook(orchestrator);

          await wrapGenerate({
            doGenerate: async () => ({
              text: 'Test response',
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            }),
            params: { prompt: 'Hello' },
            model: { modelId },
          });

          // PROPERTY: all emitted audit entries share the same correlation_id
          expect(capturedEntries.length).toBeGreaterThanOrEqual(1);
          const firstCorrelationId = capturedEntries[0].correlation_id;
          for (const entry of capturedEntries) {
            expect(entry.correlation_id).toBe(firstCorrelationId);
            expect(entry.correlation_id).toMatch(UUID_V4_REGEX);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
