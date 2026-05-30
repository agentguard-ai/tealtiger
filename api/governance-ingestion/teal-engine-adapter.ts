import type { GovernanceIngestionPipeline } from './pipeline';

type EngineLike = Record<string, unknown>;
type EngineMethod = (...args: unknown[]) => unknown;

export interface TealEngineIngestionOptions {
  methods?: string[];
}

export function attachTealEngineIngestion(
  engine: EngineLike,
  pipeline: GovernanceIngestionPipeline,
  options: TealEngineIngestionOptions = {},
): () => void {
  const methods = options.methods ?? ['evaluateV12', 'evaluateWithMode', 'evaluate'];
  const originals = new Map<string, EngineMethod>();

  for (const method of methods) {
    const current = engine[method];
    if (typeof current !== 'function') {
      continue;
    }

    const original = current as EngineMethod;
    originals.set(method, original);
    engine[method] = function ingestedEvaluation(this: EngineLike, ...args: unknown[]): unknown {
      const result = original.apply(this, args);
      if (isPromiseLike(result)) {
        return result.then((decision) => {
          pipeline.ingestDecision(decision, args[0]);
          return decision;
        });
      }
      pipeline.ingestDecision(result, args[0]);
      return result;
    };
  }

  return () => {
    for (const [method, original] of originals) {
      engine[method] = original;
    }
  };
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof (value as Promise<unknown>).then === 'function');
}

