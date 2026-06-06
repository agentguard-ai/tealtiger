'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import type { GovernedChatMessage } from '@/app/types';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat<GovernedChatMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  return (
    <main className="shell">
      <section className="chat">
        <header className="header">
          <div>
            <p className="eyebrow">TealTiger AI SDK</p>
            <h1>Governed App Router Chat</h1>
          </div>
          <span className="status">{status}</span>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="role">{message.role}</div>
              <div className="content">
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return <p key={`${message.id}-${index}`}>{part.text}</p>;
                  }
                  return null;
                })}
              </div>
              {message.metadata?.governance ? (
                <GovernancePanel metadata={message.metadata.governance} />
              ) : null}
            </article>
          ))}

          {messages.length === 0 ? (
            <div className="empty">
              Ask a question. The API route wraps the model with TealTiger and streams
              governance metadata back with the assistant message.
            </div>
          ) : null}
        </div>

        {error ? <p className="error">{error.message}</p> : null}

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            const text = input.trim();
            if (!text || isBusy) return;
            sendMessage({ text });
            setInput('');
          }}
        >
          <input
            aria-label="Message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about governed AI responses"
          />
          <button disabled={isBusy || input.trim().length === 0} type="submit">
            Send
          </button>
        </form>
      </section>
    </main>
  );
}

function GovernancePanel({
  metadata,
}: {
  metadata: NonNullable<GovernedChatMessage['metadata']>['governance'];
}) {
  if (!metadata) return null;

  return (
    <dl className="governance">
      <div>
        <dt>Governed</dt>
        <dd>{metadata.governanceApplied ? 'yes' : 'pending'}</dd>
      </div>
      <div>
        <dt>Correlation ID</dt>
        <dd>{metadata.correlationId ?? 'not emitted yet'}</dd>
      </div>
      <div>
        <dt>Model</dt>
        <dd>{metadata.model}</dd>
      </div>
      <div>
        <dt>Content Modified</dt>
        <dd>{metadata.contentModified ? 'yes' : 'no'}</dd>
      </div>
      {metadata.totalTokens !== undefined ? (
        <div>
          <dt>Total Tokens</dt>
          <dd>{metadata.totalTokens}</dd>
        </div>
      ) : null}
    </dl>
  );
}
