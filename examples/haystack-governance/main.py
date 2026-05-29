"""
TealTiger + Haystack RAG governance example.

This example places TealTiger between retrieval and generation:

    Retriever -> TealGovernance -> Generator -> Output

The generator is deterministic by default so the example runs without an LLM
provider key. Replace GovernedAnswerGenerator with a real Haystack generator in
production and keep the governance component on the same edge.
"""

import asyncio
import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List

os.environ.setdefault("HAYSTACK_TELEMETRY_ENABLED", "false")

try:
    from haystack import Document, Pipeline, component  # type: ignore[import-untyped]
    from haystack.components.retrievers.in_memory import (  # type: ignore[import-untyped]
        InMemoryBM25Retriever,
    )
    from haystack.document_stores.in_memory import InMemoryDocumentStore  # type: ignore[import-untyped]
except ImportError as exc:  # pragma: no cover - setup guidance for example users
    raise SystemExit(
        "Haystack is required for this example. Install it with "
        "`pip install 'haystack-ai>=2.21' 'tealtiger==1.3.0'`."
    ) from exc

from tealtiger import (  # type: ignore[import-untyped]
    BudgetManager,
    CostTracker,
    CostTrackerConfig,
    InMemoryCostStorage,
    ModelPricing,
    PIIDetectionGuardrail,
    TokenUsage,
)
from tealtiger.core.engine import ModeConfig, PolicyMode, TealEngine  # type: ignore[import-untyped]
from tealtiger.cost.types import BudgetScope  # type: ignore[import-untyped]


AGENT_ID = "haystack-rag-governance-demo"
DEMO_MODEL = "haystack-demo-generator"
DEFAULT_BUDGET_USD = 0.01


def run_async(coro):
    """Run TealTiger async helpers from this synchronous Haystack demo."""
    return asyncio.run(coro)


def estimate_tokens(*parts: str, output_tokens: int = 160) -> TokenUsage:
    """Small deterministic estimator used before calling a generator."""
    input_tokens = max(1, sum(max(1, len(part)) for part in parts) // 4)
    return TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )


def budget_safe_timestamp(timestamp: str) -> str:
    """Keep records compatible with the SDK in-memory budget windows."""
    return timestamp.replace("+00:00", "")


class SlidingWindowRateLimiter:
    """Minimal in-process rate limiter for the demo component."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.request_times: List[float] = []

    def check(self) -> Dict[str, Any]:
        now = time.time()
        window_start = now - self.window_seconds
        self.request_times = [ts for ts in self.request_times if ts >= window_start]

        if len(self.request_times) >= self.max_requests:
            retry_after = max(0, int(self.window_seconds - (now - self.request_times[0])))
            return {
                "allowed": False,
                "remaining": 0,
                "retry_after_seconds": retry_after,
            }

        self.request_times.append(now)
        return {
            "allowed": True,
            "remaining": self.max_requests - len(self.request_times),
            "retry_after_seconds": 0,
        }


@dataclass
class GovernanceRuntime:
    """Shared TealTiger state for the governance and generator components."""

    agent_id: str
    model: str
    cost_tracker: CostTracker
    storage: InMemoryCostStorage
    budget_manager: BudgetManager

    @classmethod
    def create(cls, budget_limit: float) -> "GovernanceRuntime":
        cost_tracker = CostTracker(
            CostTrackerConfig(
                enabled=True,
                default_provider="custom",
                enable_budgets=True,
            )
        )
        cost_tracker.add_custom_pricing(
            DEMO_MODEL,
            ModelPricing(
                model=DEMO_MODEL,
                provider="custom",
                input_cost_per_1k=0.01,
                output_cost_per_1k=0.02,
                last_updated="2026-05-27",
            ),
        )

        storage = InMemoryCostStorage()
        budget_manager = BudgetManager(storage)
        budget_manager.create_budget(
            name="Haystack RAG daily budget",
            limit=budget_limit,
            period="daily",
            alert_thresholds=[50, 75, 90, 100],
            action="block",
            scope=BudgetScope(type="agent", id=AGENT_ID),
        )

        return cls(
            agent_id=AGENT_ID,
            model=DEMO_MODEL,
            cost_tracker=cost_tracker,
            storage=storage,
            budget_manager=budget_manager,
        )

    def estimate_request_cost(self, query: str, documents: List[Document]) -> float:
        document_text = "\n".join(doc.content or "" for doc in documents)
        estimate = self.cost_tracker.estimate_cost(
            model=self.model,
            provider="custom",
            estimated_tokens=estimate_tokens(query, document_text),
        )
        return estimate.estimated_cost

    def record_generation_cost(self, request_id: str, query: str, reply: str) -> float:
        record = self.cost_tracker.calculate_actual_cost(
            request_id=request_id,
            agent_id=self.agent_id,
            model=self.model,
            provider="custom",
            actual_tokens=estimate_tokens(query, reply, output_tokens=max(1, len(reply) // 4)),
            metadata={"framework": "haystack", "pipeline": "rag"},
        )
        record = record.model_copy(update={"timestamp": budget_safe_timestamp(record.timestamp)})
        run_async(self.storage.store(record))
        run_async(self.budget_manager.record_cost(record))
        return record.actual_cost

    def cost_summary(self) -> Dict[str, Any]:
        summary = run_async(
            self.storage.get_summary(
                start_date=datetime(1970, 1, 1),
                end_date=datetime.utcnow(),
                agent_id=self.agent_id,
            )
        )
        return summary.model_dump()


@component
class TealGovernance:
    """Haystack component that gates retrieved context before generation."""

    def __init__(
        self,
        runtime: GovernanceRuntime,
        max_requests_per_minute: int = 5,
    ) -> None:
        self.runtime = runtime
        self.engine = TealEngine(
            policies={},
            mode=ModeConfig(default=PolicyMode.ENFORCE),
        )
        self.input_guardrail = PIIDetectionGuardrail(
            {
                "action": "block",
                "detect_types": ["email", "phone", "ssn", "credit_card"],
            }
        )
        self.rate_limiter = SlidingWindowRateLimiter(
            max_requests=max_requests_per_minute,
            window_seconds=60,
        )

    @component.output_types(
        query=str,
        documents=List[Document],
        blocked=bool,
        reasons=List[str],
        decision=Dict[str, Any],
        estimated_cost=float,
    )
    def run(self, query: str, documents: List[Document]) -> Dict[str, Any]:
        estimated_cost = self.runtime.estimate_request_cost(query, documents)
        reasons: List[str] = []

        pii_result = run_async(
            self.input_guardrail.evaluate(
                {"text": query},
                {
                    "agent_id": self.runtime.agent_id,
                    "framework": "haystack",
                    "governance_point": "before_generation",
                },
            )
        )
        if not pii_result.passed and pii_result.action == "block":
            reasons.append(pii_result.reason)

        budget_result = run_async(
            self.runtime.budget_manager.check_budget(
                agent_id=self.runtime.agent_id,
                estimated_cost=estimated_cost,
            )
        )
        if not budget_result.allowed:
            budget_name = budget_result.blocked_by.name if budget_result.blocked_by else "budget"
            reasons.append(
                "{0} would be exceeded by estimated cost ${1:.6f}".format(
                    budget_name,
                    estimated_cost,
                )
            )

        rate_limit = self.rate_limiter.check()
        if not rate_limit["allowed"]:
            reasons.append(
                "Rate limit exceeded; retry after {0}s".format(
                    rate_limit["retry_after_seconds"],
                )
            )

        engine_decision = self.engine.evaluate_with_mode(
            {
                "agentId": self.runtime.agent_id,
                "action": "rag.generate",
                "tool": "haystack.generator",
                "metadata": {
                    "framework": "haystack",
                    "provider": "custom",
                    "estimated_cost": estimated_cost,
                },
            }
        )
        if str(engine_decision.action).endswith("DENY"):
            reasons.append(engine_decision.reason or "Denied by TealEngine")

        blocked = bool(reasons)
        decision = {
            "action": "DENY" if blocked else "ALLOW",
            "reasons": reasons,
            "estimated_cost": estimated_cost,
            "rate_limit": rate_limit,
            "pii": pii_result.metadata,
            "engine": {
                "action": str(engine_decision.action),
                "reason_codes": [str(code) for code in engine_decision.reason_codes],
                "correlation_id": engine_decision.correlation_id,
            },
        }

        return {
            "query": "" if blocked else query,
            "documents": [] if blocked else documents,
            "blocked": blocked,
            "reasons": reasons,
            "decision": decision,
            "estimated_cost": estimated_cost,
        }


@component
class GovernedAnswerGenerator:
    """Deterministic generator that skips work when governance denies."""

    def __init__(self, runtime: GovernanceRuntime) -> None:
        self.runtime = runtime
        self.llm_calls = 0

    @component.output_types(
        replies=List[str],
        blocked=bool,
        llm_called=bool,
        governance=Dict[str, Any],
        cost_summary=Dict[str, Any],
    )
    def run(
        self,
        query: str,
        documents: List[Document],
        blocked: bool,
        reasons: List[str],
        decision: Dict[str, Any],
    ) -> Dict[str, Any]:
        if blocked:
            return {
                "replies": ["Blocked by TealTiger: {0}".format("; ".join(reasons))],
                "blocked": True,
                "llm_called": False,
                "governance": decision,
                "cost_summary": self.runtime.cost_summary(),
            }

        self.llm_calls += 1
        context = " ".join((doc.content or "").strip() for doc in documents)
        reply = (
            "Governed answer: {0} "
            "Retrieved context: {1}"
        ).format(query, context[:280])
        actual_cost = self.runtime.record_generation_cost(
            request_id="haystack-demo-{0}".format(self.llm_calls),
            query=query,
            reply=reply,
        )
        decision["actual_cost"] = actual_cost

        return {
            "replies": [reply],
            "blocked": False,
            "llm_called": True,
            "governance": decision,
            "cost_summary": self.runtime.cost_summary(),
        }


def build_pipeline(
    budget_limit: float = DEFAULT_BUDGET_USD,
    max_requests_per_minute: int = 5,
) -> Pipeline:
    """Create a Haystack RAG pipeline with TealTiger governance."""
    document_store = InMemoryDocumentStore()
    document_store.write_documents(
        [
            Document(
                content=(
                    "TealTiger evaluates AI actions before sensitive work, "
                    "including tool calls, retrieval augmented generation, "
                    "budget enforcement, and input guardrails."
                )
            ),
            Document(
                content=(
                    "Haystack pipelines can be composed from retrievers, "
                    "custom components, generators, and output processors."
                )
            ),
            Document(
                content=(
                    "A deny decision should short-circuit the generator so an "
                    "expensive or risky LLM call never happens."
                )
            ),
        ]
    )

    runtime = GovernanceRuntime.create(budget_limit=budget_limit)
    pipeline = Pipeline()
    pipeline.add_component(
        "retriever",
        InMemoryBM25Retriever(document_store=document_store, top_k=2),
    )
    pipeline.add_component(
        "governance",
        TealGovernance(
            runtime=runtime,
            max_requests_per_minute=max_requests_per_minute,
        ),
    )
    pipeline.add_component("generator", GovernedAnswerGenerator(runtime=runtime))

    pipeline.connect("retriever.documents", "governance.documents")
    pipeline.connect("governance.query", "generator.query")
    pipeline.connect("governance.documents", "generator.documents")
    pipeline.connect("governance.blocked", "generator.blocked")
    pipeline.connect("governance.reasons", "generator.reasons")
    pipeline.connect("governance.decision", "generator.decision")
    return pipeline


def run_query(pipeline: Pipeline, query: str) -> Dict[str, Any]:
    """Run one query through retrieval, governance, and generation."""
    return pipeline.run(
        {
            "retriever": {"query": query},
            "governance": {"query": query},
        }
    )


def print_result(label: str, query: str, result: Dict[str, Any]) -> None:
    generator_output = result["generator"]
    governance = generator_output["governance"]
    print("\n=== {0} ===".format(label))
    print("query: {0}".format(query))
    print("decision: {0}".format(governance["action"]))
    print("llm_called: {0}".format(generator_output["llm_called"]))
    print("estimated_cost: ${0:.6f}".format(governance["estimated_cost"]))
    if governance["reasons"]:
        print("reasons: {0}".format("; ".join(governance["reasons"])))
    print("reply: {0}".format(generator_output["replies"][0]))


def main() -> None:
    pipeline = build_pipeline()
    allowed_query = "How should TealTiger govern a Haystack RAG pipeline?"
    pii_query = "Summarize this customer: jane.customer@example.com"

    print_result("Allowed request", allowed_query, run_query(pipeline, allowed_query))
    print_result("PII short-circuit", pii_query, run_query(pipeline, pii_query))

    budget_pipeline = build_pipeline(budget_limit=0.0001)
    budget_query = "Use the full retrieved context to produce a detailed answer"
    print_result(
        "Budget short-circuit",
        budget_query,
        run_query(budget_pipeline, budget_query),
    )

    rate_pipeline = build_pipeline(max_requests_per_minute=1)
    run_query(rate_pipeline, "First request within the rate window")
    print_result(
        "Rate-limit short-circuit",
        "Second request within the same rate window",
        run_query(rate_pipeline, "Second request within the same rate window"),
    )


if __name__ == "__main__":
    main()
