"""
observe() Quickstart — Python

Zero-config instrumentation for OpenAI and Anthropic clients.
Runs without real API keys: mock adapters simulate LLM responses
so the governance layer (cost tracking, audit log, PII detection)
can be exercised locally.

Run:
    python examples/python/observe_quickstart.py
"""

import asyncio
from tealtiger import observe, freeze, unfreeze


# ---------------------------------------------------------------------------
# Mock clients — stand-ins for real openai / anthropic SDK instances.
# Replace with the real SDK clients and your API keys in production.
# ---------------------------------------------------------------------------

class _MockOpenAICompletions:
    async def create(self, **kwargs):
        return type("Completion", (), {
            "id": "chatcmpl-mock-001",
            "model": kwargs.get("model"),
            "choices": [type("Choice", (), {
                "index": 0,
                "message": type("Msg", (), {
                    "role": "assistant",
                    "content": "[mock] OpenAI response via TealTiger observe()",
                })(),
                "finish_reason": "stop",
            })()],
            "usage": type("Usage", (), {
                "prompt_tokens": 12,
                "completion_tokens": 10,
                "total_tokens": 22,
            })(),
        })()


class _MockOpenAIChat:
    completions = _MockOpenAICompletions()


class MockOpenAI:
    chat = _MockOpenAIChat()


class MockAnthropic:
    class messages:
        @staticmethod
        async def create(**kwargs):
            return type("Message", (), {
                "id": "msg-mock-001",
                "role": "assistant",
                "model": kwargs.get("model"),
                "content": [type("Block", (), {
                    "type": "text",
                    "text": "[mock] Anthropic response via TealTiger observe()",
                })()],
                "stop_reason": "end_turn",
                "usage": type("Usage", (), {
                    "input_tokens": 14,
                    "output_tokens": 11,
                })(),
            })()


# ---------------------------------------------------------------------------
# 1. Zero-config observe() — one line instruments the client
# ---------------------------------------------------------------------------

async def zero_config_example():
    print("\n--- 1. Zero-config observe() ---")

    # observe() wraps the client and auto-enables cost tracking,
    # audit logging, and PII detection with sensible defaults.
    openai = observe(MockOpenAI())

    response = await openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What is TealTiger?"}],
    )
    print("Response:", response.choices[0].message.content)


# ---------------------------------------------------------------------------
# 2. Named agent with session tracking
# ---------------------------------------------------------------------------

async def named_agent_example():
    print("\n--- 2. Named agent + session ID ---")

    # agent_id groups all calls under one logical agent in the audit log.
    # session_id ties calls within a single user conversation together.
    anthropic = observe(MockAnthropic(), agent_id="support-bot", session_id="sess-abc-123")

    response = await anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        messages=[{"role": "user", "content": "Summarise the TealTiger governance model."}],
    )
    print("Response:", response.content[0].text)


# ---------------------------------------------------------------------------
# 3. freeze() / unfreeze() — emergency circuit-breaker
# ---------------------------------------------------------------------------

async def circuit_breaker_example():
    print("\n--- 3. freeze() / unfreeze() ---")

    openai = observe(MockOpenAI(), agent_id="billing-agent")

    # Freeze the agent — all subsequent calls will be blocked until
    # unfreeze() is called. Use when anomalous behaviour is detected.
    freeze("billing-agent")
    print("Agent frozen. Calls will be blocked.")

    try:
        await openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Process payment for order #99"}],
        )
    except Exception as exc:
        # Expected: FrozenAgentError
        print("Blocked as expected:", exc)

    unfreeze("billing-agent")
    print("Agent unfrozen. Resuming normal operation.")

    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Process payment for order #99"}],
    )
    print("Response after unfreeze:", response.choices[0].message.content)


# ---------------------------------------------------------------------------
# 4. Both providers side-by-side (multi-provider setup)
# ---------------------------------------------------------------------------

async def multi_provider_example():
    print("\n--- 4. Multi-provider under one agent_id ---")

    # The same agent_id can span different provider clients.
    # All calls appear together in the governance audit log.
    openai = observe(MockOpenAI(), agent_id="research-agent")
    anthropic = observe(MockAnthropic(), agent_id="research-agent")

    oai_res, ant_res = await asyncio.gather(
        openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Explain tool use in OpenAI."}],
        ),
        anthropic.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=100,
            messages=[{"role": "user", "content": "Explain tool use in Anthropic."}],
        ),
    )

    print("OpenAI:", oai_res.choices[0].message.content)
    print("Anthropic:", ant_res.content[0].text)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    await zero_config_example()
    await named_agent_example()
    await circuit_breaker_example()
    await multi_provider_example()
    print("\nDone. In production, swap mock clients for real SDK instances.")


if __name__ == "__main__":
    asyncio.run(main())
