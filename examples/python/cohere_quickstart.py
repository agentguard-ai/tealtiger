"""
TealCohere RAG Quickstart

Shows a minimal Cohere retrieval-augmented generation flow with TealTiger:

    COHERE_API_KEY=... python examples/python/cohere_quickstart.py

What this example demonstrates:
    - TealCohere client setup
    - Cohere Embed for local document retrieval
    - Cohere Chat with retrieved documents
    - PII and prompt-injection guardrails
    - Cost tracking, budget checks, and a printed cost summary
"""

import asyncio
import math
import os
from datetime import datetime, timezone
from typing import Iterable

from tealtiger import (
    BudgetManager,
    CostTracker,
    CostTrackerConfig,
    GuardrailEngine,
    InMemoryCostStorage,
    PIIDetectionGuardrail,
    PromptInjectionGuardrail,
)
from tealtiger.clients import TealCohere, TealCohereConfig


AGENT_ID = "cohere-rag-quickstart-agent"
CHAT_MODEL = "command"

KNOWLEDGE_BASE = [
    {
        "title": "Guardrails",
        "snippet": (
            "TealTiger runs guardrails before model calls so policy failures "
            "can be blocked or redacted before data reaches the provider."
        ),
    },
    {
        "title": "Cost tracking",
        "snippet": (
            "TealTiger records estimated and actual model costs, stores cost "
            "records, and can enforce budgets by agent or workflow."
        ),
    },
    {
        "title": "RAG workflow",
        "snippet": (
            "A retrieval-augmented generation workflow embeds local documents, "
            "searches for the most relevant context, and passes that context "
            "to the chat model as grounded source material."
        ),
    },
]


def build_guardrails() -> GuardrailEngine:
    """Create input/output guardrails for the example flow."""
    engine = GuardrailEngine()
    engine.register_guardrail(
        PIIDetectionGuardrail(
            {
                "name": "pii-detection",
                "enabled": True,
                "action": "redact",
            }
        )
    )
    engine.register_guardrail(
        PromptInjectionGuardrail(
            {
                "name": "prompt-injection",
                "enabled": True,
                "action": "block",
                "sensitivity": "medium",
            }
        )
    )
    return engine


def build_client() -> tuple[TealCohere, InMemoryCostStorage]:
    """Create a guarded TealCohere client with cost tracking enabled."""
    reporting_storage = InMemoryCostStorage()
    budget_storage = InMemoryCostStorage()
    cost_tracker = CostTracker(
        CostTrackerConfig(
            enabled=True,
            persist_records=True,
            enable_budgets=True,
            enable_alerts=True,
        )
    )
    budget_manager = BudgetManager(budget_storage)
    budget_manager.create_budget(
        name="Cohere Quickstart Daily Budget",
        limit=5.0,
        period="daily",
        alert_thresholds=[50, 75, 90],
        action="alert",
        enabled=True,
    )

    client = TealCohere(
        TealCohereConfig(
            api_key=os.getenv("COHERE_API_KEY", "your-cohere-api-key"),
            model=CHAT_MODEL,
            agent_id=AGENT_ID,
            enable_guardrails=True,
            enable_cost_tracking=True,
            guardrail_engine=build_guardrails(),
            cost_tracker=cost_tracker,
            budget_manager=budget_manager,
            cost_storage=reporting_storage,
        )
    )
    return client, reporting_storage


def cosine_similarity(left: Iterable[float], right: Iterable[float]) -> float:
    """Rank embeddings with cosine similarity for a local search step."""
    left_values = list(left)
    right_values = list(right)
    dot_product = sum(a * b for a, b in zip(left_values, right_values))
    left_norm = math.sqrt(sum(a * a for a in left_values))
    right_norm = math.sqrt(sum(b * b for b in right_values))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot_product / (left_norm * right_norm)


def top_documents(
    document_embeddings: list[list[float]],
    query_embedding: list[float],
    limit: int = 2,
) -> list[dict[str, str]]:
    """Select the most relevant local documents for the chat call."""
    ranked = sorted(
        zip(KNOWLEDGE_BASE, document_embeddings),
        key=lambda item: cosine_similarity(item[1], query_embedding),
        reverse=True,
    )
    return [document for document, _ in ranked[:limit]]


async def main() -> None:
    """Run an embed, local search, chat, and cost-summary flow."""
    client, storage = build_client()

    question = (
        "How does TealTiger help a RAG workflow stay safer and easier to "
        "operate?"
    )

    document_response = await client.embed(
        texts=[document["snippet"] for document in KNOWLEDGE_BASE],
        input_type="search_document",
    )
    query_response = await client.embed(
        texts=[question],
        input_type="search_query",
    )

    selected_documents = top_documents(
        document_response.embeddings,
        query_response.embeddings[0],
    )

    response = await client.chat(
        message=question,
        documents=selected_documents,
        temperature=0.2,
        max_tokens=220,
    )

    print("Selected documents:")
    for document in selected_documents:
        print(f"- {document['title']}")

    print("\nAnswer:")
    print(response.text)

    security = response.security
    if security and security.guardrail_result:
        summary = security.guardrail_result.get_summary()
        print(
            "\nGuardrails: "
            f"passed={summary['passed']} "
            f"executed={summary['guardrails_executed']} "
            f"failed={summary['failed_count']}"
        )
    if security and security.cost_record:
        print(f"Chat cost: ${security.cost_record.actual_cost:.6f}")
    if security and security.budget_check:
        budget_allowed = security.budget_check.get("allowed", True)
        print(f"Budget allowed: {budget_allowed}")

    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    summary = await storage.get_summary(start_of_day, now, AGENT_ID)
    print("\nCost summary:")
    print(f"- total requests: {summary.total_requests}")
    print(f"- total cost: ${summary.total_cost:.6f}")
    print(f"- by model: {summary.by_model}")


if __name__ == "__main__":
    asyncio.run(main())
