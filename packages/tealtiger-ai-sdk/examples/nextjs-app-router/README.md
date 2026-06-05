# TealTiger AI SDK with Next.js App Router

This example shows how to use `tealtiger-ai-sdk` with the Vercel AI SDK in a
Next.js App Router chat application.

It demonstrates:

- zero-config governance in `app/api/chat/route.ts`
- `wrapLanguageModel` with `tealtigerMiddleware()`
- `useChat` rendering streamed assistant messages
- TealTiger governance metadata surfaced on the client message

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `AI_GATEWAY_API_KEY` in `.env.local`. The example defaults to
`openai/gpt-4o-mini` through the Vercel AI Gateway; set `AI_MODEL` to use a
different AI SDK model identifier.

The example installs the core TealTiger SDK with an npm alias:
`"tealtiger-sdk": "npm:tealtiger@^1.3.0"`. This satisfies the
`tealtiger-ai-sdk` peer/import name while using the currently published
`tealtiger` package.

Open <http://localhost:3000> and send a message. Assistant responses include a
governance panel with the model, TealTiger correlation ID, whether governance
ran, whether content was modified, and final token usage when the stream
finishes.

## How It Works

The route creates a TealTiger middleware instance and wraps the model:

```ts
import { gateway } from '@ai-sdk/gateway';
import { wrapLanguageModel } from 'ai';
import tealtigerMiddleware from 'tealtiger-ai-sdk';

const model = wrapLanguageModel({
  model: gateway(process.env.AI_MODEL ?? 'openai/gpt-4o-mini'),
  middleware: tealtigerMiddleware({
    audit: { enabled: true, outputs: [{ type: 'console' }] },
    costTracking: { enabled: true },
  }),
});
```

For display purposes, the route wraps `transformParams` to capture the TealTiger
metadata that the middleware stores on `providerMetadata.tealtiger`. It then
passes that data through `toUIMessageStreamResponse({ messageMetadata })`, so the
client can render it from `message.metadata.governance`.

Audit logging remains server-side. The client only receives non-sensitive
correlation and status metadata.
