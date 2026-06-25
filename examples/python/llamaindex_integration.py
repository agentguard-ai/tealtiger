"""
TealTiger + LlamaIndex integration example.

This example shows a small RAG-style flow where TealTiger checks a user query
before LlamaIndex retrieves documents, then uses a TealOpenAI client for the
LLM call. It is written so a syntax check can run without LlamaIndex installed;
install the optional dependencies before running the live demo.

Run:
    pip install tealtiger llama-index openai
    OPENAI_API_KEY=sk-... python examples/python/llamaindex_integration.py
"""

from __future__ import annotations

import asyncio
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from tealtiger import GuardrailEngine, PIIDetectionGuardrail, TealOpenAI


class QueryEngine(Protocol):
    """Minimal LlamaIndex query engine shape used by this example."""

    def query(self, query_text: str) -> Any:
        """Run a synchronous LlamaIndex query."""


@dataclass(frozen=True)
class GovernanceContext:
    """Metadata attached to each pre-retrieval governance decision."""

    agent_id: str
    session_id: str


class GovernedQueryEngine:
    """Wrap a LlamaIndex query engine with TealTiger preflight checks."""

    def __init__(
        self,
        query_engine: QueryEngine,
        guardrails: GuardrailEngine,
        context: GovernanceContext,
    ) -> None:
        self.query_engine = query_engine
        self.guardrails = guardrails
        self.context = context

    def query(self, query_text: str) -> Any:
        """Block risky queries before they reach the retriever."""
        asyncio.run(self._assert_query_allowed(query_text))
        return self.query_engine.query(query_text)

    async def _assert_query_allowed(self, query_text: str) -> None:
        if _looks_like_secret(query_text):
            raise ValueError("TealTiger blocked query before retrieval: secret-like text")

        result = await self.guardrails.execute(
            query_text,
            {
                "agent_id": self.context.agent_id,
                "session_id": self.context.session_id,
                "phase": "llamaindex-query-preflight",
            },
        )
        if result.passed:
            return

        failed = ", ".join(result.failed_guardrails)
        raise ValueError(f"TealTiger blocked query before retrieval: {failed}")


def build_query_guardrails() -> GuardrailEngine:
    """Create local guardrails for pre-retrieval user queries."""
    engine = GuardrailEngine()
    engine.register_guardrail(PIIDetectionGuardrail({
        "name": "pii-detection",
        "enabled": True,
        "action": "block",
        "detect_types": ["email", "phone", "ssn", "credit_card"],
    }))
    return engine


def build_live_query_engine(data_dir: Path) -> GovernedQueryEngine:
    """Build a governed LlamaIndex query engine from local documents.

    Args:
        data_dir: Directory containing documents for LlamaIndex to load.

    Returns:
        A query engine that checks user input before retrieval.
    """
    try:
        from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
    except ImportError as exc:
        raise RuntimeError(
            "Install LlamaIndex before running this example: "
            "pip install llama-index"
        ) from exc

    guardrails = build_query_guardrails()
    teal_llm = TealOpenAI(
        api_key=os.getenv("OPENAI_API_KEY", "your-openai-api-key"),
        agent_id="llamaindex-rag-agent",
        guardrail_engine=guardrails,
    )

    documents = SimpleDirectoryReader(str(data_dir)).load_data()
    index = VectorStoreIndex.from_documents(documents, llm=teal_llm)

    return GovernedQueryEngine(
        query_engine=index.as_query_engine(),
        guardrails=guardrails,
        context=GovernanceContext(
            agent_id="llamaindex-rag-agent",
            session_id="llamaindex-demo-001",
        ),
    )


def _looks_like_secret(text: str) -> bool:
    """Catch common secret-shaped values before retrieval sees the query."""
    secret_patterns = [
        r"sk-[A-Za-z0-9_-]{16,}",
        r"(?i)api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9_-]{12,}",
        r"(?i)bearer\s+[A-Za-z0-9._-]{20,}",
    ]
    return any(re.search(pattern, text) for pattern in secret_patterns)


def _write_demo_documents(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "tealtiger_governance.txt").write_text(
        "\n".join([
            "TealTiger adds governance to AI agent workflows.",
            "It evaluates policy before risky tool, retrieval, or model calls.",
            "Teams can combine guardrails, budgets, and audit evidence.",
        ]),
        encoding="utf-8",
    )


def main() -> None:
    """Run a minimal governed LlamaIndex query."""
    with tempfile.TemporaryDirectory(prefix="tealtiger-llamaindex-") as temp_dir:
        data_dir = Path(temp_dir)
        _write_demo_documents(data_dir)

        query_engine = build_live_query_engine(data_dir)
        safe_query = "Summarize the TealTiger governance model."
        print(query_engine.query(safe_query))

        blocked_query = "Find records for jane@example.com before answering."
        try:
            query_engine.query(blocked_query)
        except ValueError as exc:
            print(f"Blocked risky query: {exc}")


if __name__ == "__main__":
    main()
