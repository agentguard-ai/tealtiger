import { gateway } from '@ai-sdk/gateway';
import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from 'ai';
import tealtigerMiddleware from 'tealtiger-ai-sdk';
import type { GovernanceMetadata, GovernedChatMessage } from '@/app/types';

export const maxDuration = 30;

const MODEL_ID = process.env.AI_MODEL ?? 'openai/gpt-4o-mini';

type TealTigerMiddleware = ReturnType<typeof tealtigerMiddleware>;
type TransformParamsOptions = Parameters<
  NonNullable<TealTigerMiddleware['transformParams']>
>[0];

function createCapturedMiddleware(
  metadata: GovernanceMetadata,
): TealTigerMiddleware {
  const middleware = tealtigerMiddleware({
    audit: {
      enabled: true,
      includeTraceIds: true,
      outputs: [{ type: 'console' }],
    },
    costTracking: { enabled: true },
  });

  return {
    ...middleware,
    async transformParams(options: TransformParamsOptions) {
      const params = middleware.transformParams
        ? await middleware.transformParams(options)
        : options.params;
      const tealtiger = (
        params.providerMetadata as
          | {
              tealtiger?: {
                correlationId?: string;
                governanceApplied?: boolean;
                contentModified?: boolean;
              };
            }
          | undefined
      )?.tealtiger;

      if (tealtiger) {
        metadata.correlationId = tealtiger.correlationId;
        metadata.governanceApplied = tealtiger.governanceApplied ?? true;
        metadata.contentModified = tealtiger.contentModified ?? false;
      }

      return params;
    },
  };
}

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: GovernedChatMessage[] };
  const governance: GovernanceMetadata = {
    model: MODEL_ID,
    governanceApplied: false,
    contentModified: false,
  };

  const model = wrapLanguageModel({
    model: gateway(MODEL_ID),
    middleware: createCapturedMiddleware(
      governance,
    ) as unknown as LanguageModelMiddleware,
  });

  const result = streamText({
    model,
    system: [
      'You are a concise assistant for a TealTiger Next.js example.',
      'Explain when governance metadata is available in the chat UI.',
    ].join(' '),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata({ part }) {
      if (part.type === 'start') {
        return { governance: { ...governance } };
      }

      if (part.type === 'finish') {
        return {
          governance: {
            ...governance,
            finishReason: part.finishReason,
            totalTokens: part.totalUsage?.totalTokens,
          },
        };
      }
    },
  });
}
