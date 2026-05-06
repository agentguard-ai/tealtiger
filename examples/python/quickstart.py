"""
TealOpenAI Quickstart

Shortest runnable example of wrapping OpenAI's API with TealTiger's
guardrails, prompt-injection detection, and cost tracking. Run with:

    OPENAI_API_KEY=sk-... python examples/python/quickstart.py

What this example demonstrates:
    - PII detection (redact mode) so e.g. emails / phone numbers in user
      prompts are scrubbed before they reach the model
    - Prompt-injection detection (block mode) so jailbreak-style prompts
      are stopped before billing kicks in
    - A daily $5 budget with alerts at 50 / 75 / 90% thresholds
    - The `response.security` envelope that TealOpenAI adds on top of
      OpenAI's normal chat-completion response (guardrail outcome, cost
      record, budget check)
"""

import asyncio
import os

from tealtiger import (
    BudgetConfig,
    BudgetManager,
    CostTracker,
    CostTrackerConfig,
    GuardrailEngine,
    InMemoryCostStorage,
    PIIDetectionGuardrail,
    PromptInjectionGuardrail,
    TealOpenAI,
)


async def main() -> None:
    """Build a TealOpenAI client, send one chat completion, print metadata."""
    # 1. Guardrails: redact PII, block obvious prompt-injection attempts.
    guardrail_engine = GuardrailEngine()
    guardrail_engine.register_guardrail(PIIDetectionGuardrail(
        name="pii-detection",
        enabled=True,
        action="redact",
    ))
    guardrail_engine.register_guardrail(PromptInjectionGuardrail(
        name="prompt-injection",
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

    # 3. TealOpenAI is a drop-in wrapper around the upstream OpenAI SDK;
    #    method shapes (`client.chat.completions.create(...)`) match.
    client = TealOpenAI(
        api_key=os.getenv("OPENAI_API_KEY", "your-openai-api-key"),
        agent_id="quickstart-agent",
        guardrail_engine=guardrail_engine,
        cost_tracker=cost_tracker,
        budget_manager=budget_manager,
        cost_storage=storage,
    )

    # 4. One chat completion. The user message contains an email so the
    #    PII guardrail has something to redact in its pre-flight pass; the
    #    redacted text is what actually reaches OpenAI.
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=120,
        messages=[
            {"role": "system", "content": "You answer in one sentence."},
            {
                "role": "user",
                "content": (
                    "My email is jane@example.com — in one sentence, what "
                    "does TealTiger do?"
                ),
            },
        ],
    )

    # 5. Plain-OpenAI fields work as usual.
    print("Response:", response.choices[0].message.content)

    # 6. The `security` attribute is what TealOpenAI adds on top.
    security = getattr(response, "security", None)
    if security is None:
        return
    if security.guardrail_result is not None:
        print(f"Guardrails passed: {security.guardrail_result.passed}")
    if security.cost_record is not None:
        print(f"Cost: ${security.cost_record.actual_cost:.6f}")
    if security.budget_check is not None:
        print(f"Budget allowed: {security.budget_check.allowed}")


if __name__ == "__main__":
    asyncio.run(main())
