"""
observe() Quickstart — Python

Zero-config instrumentation for OpenAI and Anthropic clients.
Uses mock clients so it runs without API keys.

Run:
    python examples/observe_quickstart.py
"""

import asyncio

from tealtiger.observe import observe, freeze, unfreeze, FrozenAgentError
from tealtiger.observe.freeze_registry import FreezeRegistry


# ---------------------------------------------------------------------------
# Mock clients — stand-ins for real openai / anthropic SDK instances.
# Replace with the real SDK clients and your API keys in production.
#
# Duck-type compatible with the observe() provider detector:
#   - Mock OpenAI: has chat.completions.create() method and base_url attribute
#   - Mock Anthropic: has messages.create() method
# ---------------------------------------------------------------------------


class _MockCompletions:
    """Simulates openai.resources.chat.Completions."""

    def create(self, **kwargs):
        """Sync chat completion — returns an OpenAI-shaped response."""
        return _make_openai_response(kwargs.get("model", "gpt-4o-mini"))

    async def acreate(self, **kwargs):
        """Async chat completion — same shape, awaitable."""
        return _make_openai_response(kwargs.get("model", "gpt-4o-mini"))


class _MockChat:
    """Simulates openai.resources.Chat (has .completions)."""

    def __init__(self):
        self.completions = _MockCompletions()


class MockOpenAI:
    """Mock OpenAI client — duck-type compatible with provider detector.

    Detector checks: has `chat.completions.create` and `base_url` attribute.
    """

    def __init__(self):
        self.chat = _MockChat()
        self.base_url = "https://api.openai.com/v1"


class _MockMessages:
    """Simulates anthropic.resources.Messages."""

    def create(self, **kwargs):
        """Sync message creation — returns an Anthropic-shaped response."""
        return _make_anthropic_response(kwargs.get("model", "claude-3-5-sonnet-20241022"))

    async def acreate(self, **kwargs):
        """Async message creation — same shape, awaitable."""
        return _make_anthropic_response(kwargs.get("model", "claude-3-5-sonnet-20241022"))


class MockAnthropic:
    """Mock Anthropic client — duck-type compatible with provider detector.

    Detector checks: has `messages.create` method.
    """

    def __init__(self):
        self.messages = _MockMessages()


# ---------------------------------------------------------------------------
# Response factories — build mock provider responses with usage metadata
# ---------------------------------------------------------------------------


class _Namespace:
    """Generic namespace that converts kwargs to attributes."""

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self):
        attrs = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"_Namespace({attrs})"


def _make_openai_response(model: str):
    """Create a mock OpenAI ChatCompletion response object."""
    return _Namespace(
        id="chatcmpl-mock-001",
        object="chat.completion",
        model=model,
        choices=[
            _Namespace(
                index=0,
                message=_Namespace(
                    role="assistant",
                    content="[mock] OpenAI response via TealTiger observe()",
                    tool_calls=None,
                ),
                finish_reason="stop",
            )
        ],
        usage=_Namespace(
            prompt_tokens=12,
            completion_tokens=10,
            total_tokens=22,
        ),
    )


def _make_anthropic_response(model: str):
    """Create a mock Anthropic message response object."""
    return _Namespace(
        id="msg-mock-001",
        type="message",
        role="assistant",
        model=model,
        content=[
            _Namespace(type="text", text="[mock] Anthropic response via TealTiger observe()")
        ],
        stop_reason="end_turn",
        usage=_Namespace(
            input_tokens=14,
            output_tokens=11,
        ),
    )


# ---------------------------------------------------------------------------
# 1. Zero-config observe() — one line instruments the client
# ---------------------------------------------------------------------------


def example_zero_config():
    """Demonstrates the simplest usage: observe() with no options."""
    print("\n--- 1. Zero-config observe() ---")

    # observe() wraps the client and auto-enables cost tracking,
    # audit logging, and PII detection with sensible defaults.
    openai = observe(MockOpenAI())

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What is TealTiger?"}],
    )

    print(f"Response: {response.choices[0].message.content}")
    print(f"Agent ID: {openai.get_agent_id()}")
    print(f"Cost: {openai.get_cost()}")


# ---------------------------------------------------------------------------
# 2. Named agent with session tracking
# ---------------------------------------------------------------------------


def example_named_agent():
    """Demonstrates observe() with explicit agentId and sessionId."""
    print("\n--- 2. Named agent + session ID ---")

    # agent_id groups all calls under one logical agent in the audit log.
    # session_id ties calls within a single user conversation together.
    anthropic = observe(
        MockAnthropic(),
        agent_id="support-bot",
        session_id="sess-abc-123",
    )

    response = anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        messages=[{"role": "user", "content": "Summarise the TealTiger governance model."}],
    )

    print(f"Response: {response.content[0].text}")
    print(f"Agent ID: {anthropic.get_agent_id()}")
    print(f"Session ID: {anthropic.get_session_id()}")


# ---------------------------------------------------------------------------
# 3. freeze() / unfreeze() — emergency circuit-breaker (kill switch)
# ---------------------------------------------------------------------------


def example_circuit_breaker():
    """Demonstrates the freeze/unfreeze kill switch."""
    print("\n--- 3. freeze() / unfreeze() ---")

    openai = observe(MockOpenAI(), agent_id="billing-agent")

    # Freeze the agent immediately — all subsequent calls will be blocked
    # until unfreeze() is called. Use this when you detect anomalous behaviour
    # or want to halt an agent during an incident.
    freeze("billing-agent")
    print("Agent frozen. Calls will be blocked.")

    try:
        openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Process payment for order #99"}],
        )
    except FrozenAgentError as err:
        # Expected: FrozenAgentError
        print(f"Blocked as expected: {err}")

    # Unfreeze when the incident is resolved.
    unfreeze("billing-agent")
    print("Agent unfrozen. Resuming normal operation.")

    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Process payment for order #99"}],
    )
    print(f"Response after unfreeze: {response.choices[0].message.content}")


# ---------------------------------------------------------------------------
# 4. Both providers side-by-side (multi-provider setup)
# ---------------------------------------------------------------------------


def example_multi_provider():
    """Demonstrates using the same agentId across multiple providers."""
    print("\n--- 4. Multi-provider under one agentId ---")

    # The same agent_id can be applied to different provider clients.
    # All calls appear together in the governance audit log.
    openai = observe(MockOpenAI(), agent_id="research-agent")
    anthropic = observe(MockAnthropic(), agent_id="research-agent")

    oai_res = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Explain tool use in OpenAI."}],
    )
    ant_res = anthropic.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=100,
        messages=[{"role": "user", "content": "Explain tool use in Anthropic."}],
    )

    print(f"OpenAI:    {oai_res.choices[0].message.content}")
    print(f"Anthropic: {ant_res.content[0].text}")


# ---------------------------------------------------------------------------
# 5. Async usage patterns
# ---------------------------------------------------------------------------


class _MockAsyncCompletions:
    """Async-native mock completions (coroutine function detected by observe)."""

    async def create(self, **kwargs):
        return _make_openai_response(kwargs.get("model", "gpt-4o-mini"))


class _MockAsyncChat:
    def __init__(self):
        self.completions = _MockAsyncCompletions()


class MockAsyncOpenAI:
    """Mock async OpenAI client — same duck-type shape."""

    def __init__(self):
        self.chat = _MockAsyncChat()
        self.base_url = "https://api.openai.com/v1"


class _MockAsyncMessages:
    """Async-native mock messages."""

    async def create(self, **kwargs):
        return _make_anthropic_response(kwargs.get("model", "claude-3-5-sonnet-20241022"))


class MockAsyncAnthropic:
    """Mock async Anthropic client — same duck-type shape."""

    def __init__(self):
        self.messages = _MockAsyncMessages()


async def async_main():
    """Async equivalents of the sync examples above."""
    print("\n\n========== ASYNC EXAMPLES ==========")

    # Reset FreezeRegistry to avoid cross-contamination from sync examples
    FreezeRegistry.get_instance()._reset()

    # --- Async zero-config ---
    print("\n--- Async: Zero-config observe() ---")
    openai = observe(MockAsyncOpenAI())
    response = await openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What is TealTiger? (async)"}],
    )
    print(f"Response: {response.choices[0].message.content}")

    # --- Async named agent ---
    print("\n--- Async: Named agent + session ID ---")
    anthropic = observe(
        MockAsyncAnthropic(),
        agent_id="async-support-bot",
        session_id="sess-async-001",
    )
    response = await anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        messages=[{"role": "user", "content": "Explain observe() in async mode."}],
    )
    print(f"Response: {response.content[0].text}")

    # --- Async freeze/unfreeze ---
    print("\n--- Async: freeze() / unfreeze() ---")
    openai = observe(MockAsyncOpenAI(), agent_id="async-billing-agent")

    freeze("async-billing-agent")
    try:
        await openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Process async payment"}],
        )
    except FrozenAgentError as err:
        print(f"Blocked as expected: {err}")

    unfreeze("async-billing-agent")
    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Process async payment"}],
    )
    print(f"Response after unfreeze: {response.choices[0].message.content}")

    # --- Async multi-provider ---
    print("\n--- Async: Multi-provider ---")
    openai = observe(MockAsyncOpenAI(), agent_id="async-research-agent")
    anthropic = observe(MockAsyncAnthropic(), agent_id="async-research-agent")

    oai_res, ant_res = await asyncio.gather(
        openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Async OpenAI call"}],
        ),
        anthropic.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=100,
            messages=[{"role": "user", "content": "Async Anthropic call"}],
        ),
    )
    print(f"OpenAI:    {oai_res.choices[0].message.content}")
    print(f"Anthropic: {ant_res.content[0].text}")

    print("\nDone (async). In production, swap mock clients for real SDK instances.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    """Run all sync examples."""
    # Reset FreezeRegistry singleton to avoid cross-contamination between runs
    FreezeRegistry.get_instance()._reset()

    print("========== SYNC EXAMPLES ==========")

    example_zero_config()
    example_named_agent()
    example_circuit_breaker()
    example_multi_provider()

    print("\nDone (sync). In production, swap mock clients for real SDK instances.")


if __name__ == "__main__":
    main()
    asyncio.run(async_main())
