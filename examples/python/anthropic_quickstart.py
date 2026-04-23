"""
TealAnthropic Quickstart

Shortest runnable example of wrapping Anthropic's Claude API with
TealTiger's guardrails and cost tracking. Run with:

    ANTHROPIC_API_KEY=sk-ant-... python examples/python/anthropic_quickstart.py

Claude-specific notes this example demonstrates:
    - system is a top-level field on messages.create(), not a message role
    - models include dates (claude-3-5-sonnet-20241022); pin them in production
    - max_tokens is required
    - streaming uses client.messages.stream(...) rather than a flag
"""

import asyncio
import os

from tealtiger import (
    BudgetConfig,
    BudgetManager,
    ContentModerationGuardrail,
    CostTracker,
    CostTrackerConfig,
    GuardrailEngine,
    InMemoryCostStorage,
    PIIDetectionGuardrail,
    TealAnthropic,
)


async def main() -> None:
    # 1. Guardrails: redact PII, block anything flagged as unsafe content.
    guardrail_engine = GuardrailEngine()
    guardrail_engine.register_guardrail(PIIDetectionGuardrail(
        name="pii-detection",
        enabled=True,
        action="redact",
    ))
    guardrail_engine.register_guardrail(ContentModerationGuardrail(
        name="content-moderation",
        enabled=True,
        action="block",
    ))

    # 2. Cost tracking + a daily $5 budget with alerts at 50 / 75 / 90%.
    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(CostTrackerConfig(
        enabled=True,
        persist_records=True,
        enable_budgets=True,
        enable_alerts=True,
    ))
    budget_manager = BudgetManager(storage)
    budget_manager.create_budget(BudgetConfig(
        name="Quickstart Daily Budget",
        limit=5.0,
        period="daily",
        alert_thresholds=[50, 75, 90],
        action="alert",
        enabled=True,
    ))

    # 3. TealAnthropic is a drop-in wrapper around Anthropic's SDK.
    client = TealAnthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY", "your-anthropic-api-key"),
        agent_id="quickstart-agent",
        guardrail_engine=guardrail_engine,
        cost_tracker=cost_tracker,
        budget_manager=budget_manager,
        cost_storage=storage,
    )

    # 4. Plain message. The shape matches the upstream Anthropic SDK; the
    #    security metadata on the response is added by TealAnthropic.
    basic = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        messages=[
            {"role": "user", "content": "In one sentence, what does TealTiger do?"},
        ],
    )
    print("Basic response:", basic.content[0].text)
    cost = getattr(getattr(basic, "security", None), "cost_record", None)
    if cost:
        print(f"Cost: ${cost.actual_cost:.6f}")

    # 5. System prompt. Claude's API takes `system` as a top-level field,
    #    not as a message with role="system" like OpenAI does.
    systemed = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        system="You answer as a concise security engineer. Three sentences max.",
        messages=[
            {"role": "user", "content": "Why redact PII before sending prompts to a model?"},
        ],
    )
    print("\nSystem-primed response:", systemed.content[0].text)

    # 6. Streaming. messages.stream yields events; text_delta events carry
    #    the incremental text.
    print("\nStreaming response:")
    async with client.messages.stream(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        messages=[
            {"role": "user", "content": "Count to five, one number per line."},
        ],
    ) as stream:
        async for event in stream:
            if (
                getattr(event, "type", None) == "content_block_delta"
                and getattr(getattr(event, "delta", None), "type", None) == "text_delta"
            ):
                print(event.delta.text, end="", flush=True)
    print()


if __name__ == "__main__":
    asyncio.run(main())
