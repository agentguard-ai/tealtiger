import { generateText, streamText, type ModelMessage } from 'ai';
import {
  createGovernanceHeaders,
  evaluateChatGovernance,
  recordModelUsage,
  summarizeGovernance,
} from '../../../lib/tealtiger-governance';

export const runtime = 'nodejs';

type ChatRouteBody = {
  userId?: string;
  messages?: ModelMessage[];
  prompt?: string;
  stream?: boolean;
};

const MODEL = process.env.AI_MODEL ?? 'openai/gpt-5.4';

function getUserId(req: Request, body: ChatRouteBody): string {
  return body.userId ?? req.headers.get('x-user-id') ?? 'anonymous-user';
}

function getMessages(body: ChatRouteBody): ModelMessage[] {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages;
  }

  if (typeof body.prompt === 'string' && body.prompt.trim()) {
    return [{ role: 'user', content: body.prompt.trim() }];
  }

  return [];
}

export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const body = await req.json() as ChatRouteBody;
  const userId = getUserId(req, body);
  const messages = getMessages(body);

  if (messages.length === 0) {
    return Response.json(
      { error: 'messages or prompt is required' },
      { status: 400 },
    );
  }

  const operation = body.stream ? 'ai.streamText' : 'ai.generateText';
  const governance = await evaluateChatGovernance({
    userId,
    messages,
    model: MODEL,
    operation,
    requestId,
  });
  const headers = createGovernanceHeaders(governance);

  if (!governance.allowed) {
    return Response.json(
      {
        error: 'TealTiger governance denied the request',
        reasons: governance.reasons,
        governance: summarizeGovernance(governance),
      },
      {
        status: 403,
        headers,
      },
    );
  }

  if (body.stream) {
    const result = streamText({
      model: MODEL,
      messages: governance.messages,
      onFinish: async ({ totalUsage }) => {
        await recordModelUsage({
          userId,
          model: MODEL,
          requestId,
          operation,
          usage: totalUsage,
        });
      },
    });

    return result.toTextStreamResponse({ headers });
  }

  const result = await generateText({
    model: MODEL,
    messages: governance.messages,
    onFinish: async ({ totalUsage }) => {
      await recordModelUsage({
        userId,
        model: MODEL,
        requestId,
        operation,
        usage: totalUsage,
      });
    },
  });

  return Response.json(
    {
      text: result.text,
      governance: summarizeGovernance(governance),
    },
    { headers },
  );
}
