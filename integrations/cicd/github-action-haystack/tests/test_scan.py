"""Unit tests for the TealTiger Haystack Pipeline Security Scanner."""

from __future__ import annotations

import ast
import textwrap
import sys
from pathlib import Path

# Allow running tests without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent))

from scan import (  # noqa: E402
    Finding,
    _check_agent_loop,
    _check_unguarded_generator,
    _imported_and_referenced_names,
    _is_haystack_file,
    scan_file,
)


def _parse(source: str) -> tuple[ast.Module, set[str]]:
    source = textwrap.dedent(source)
    tree = ast.parse(source)
    return tree, _imported_and_referenced_names(tree)


# ---------------------------------------------------------------------------
# _is_haystack_file
# ---------------------------------------------------------------------------


def test_detects_haystack_import():
    tree, _ = _parse(
        """
        from haystack import Pipeline, component
        from haystack.components.generators.openai import OpenAIGenerator
        """
    )
    assert _is_haystack_file(tree)


def test_ignores_non_haystack_file():
    tree, _ = _parse(
        """
        import os
        from pathlib import Path
        """
    )
    assert not _is_haystack_file(tree)


# ---------------------------------------------------------------------------
# unguarded-generator check
# ---------------------------------------------------------------------------


def test_flags_unguarded_openai_generator():
    tree, names = _parse(
        """
        from haystack import Pipeline, component
        from haystack.components.generators.openai import OpenAIGenerator

        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
        pipe.run({"llm": {"prompt": "Hello"}})
        """
    )
    findings = _check_unguarded_generator("<test>", tree, names)
    assert len(findings) == 1
    assert findings[0].check == "unguarded-generator"
    assert "OpenAIGenerator" in findings[0].message


def test_no_false_positive_when_tealtiger_guard_present():
    tree, names = _parse(
        """
        from haystack import Pipeline, component
        from haystack.components.generators.openai import OpenAIGenerator
        from tealtiger import BudgetManager, PIIDetectionGuardrail

        budget = BudgetManager(limit=0.50)
        pii = PIIDetectionGuardrail({})
        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
        """
    )
    findings = _check_unguarded_generator("<test>", tree, names)
    assert findings == []


def test_no_false_positive_with_teal_governance():
    tree, names = _parse(
        """
        from haystack import Pipeline, component
        from haystack.components.generators.openai import OpenAIGenerator

        class TealGovernance:
            pass

        pipe = Pipeline()
        pipe.add_component("guard", TealGovernance())
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
        """
    )
    findings = _check_unguarded_generator("<test>", tree, names)
    assert findings == []


def test_no_false_positive_when_no_generator():
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.retrievers.in_memory import InMemoryBM25Retriever

        pipe = Pipeline()
        pipe.add_component("retriever", InMemoryBM25Retriever(document_store=None))
        """
    )
    findings = _check_unguarded_generator("<test>", tree, names)
    assert findings == []


def test_flags_multiple_generators():
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator
        from haystack_integrations.components.generators.anthropic import AnthropicChatGenerator

        pipe = Pipeline()
        pipe.add_component("llm1", OpenAIGenerator(model="gpt-4o"))
        pipe.add_component("llm2", AnthropicChatGenerator(model="claude-opus-4-8"))
        """
    )
    findings = _check_unguarded_generator("<test>", tree, names)
    assert len(findings) == 2


def test_no_false_positive_plain_rag_pipeline():
    """A standard RAG pipeline (retriever + generator) without governance should warn."""
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator
        from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
        from haystack.document_stores.in_memory import InMemoryDocumentStore

        store = InMemoryDocumentStore()
        pipe = Pipeline()
        pipe.add_component("retriever", InMemoryBM25Retriever(document_store=store))
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
        pipe.connect("retriever.documents", "llm.documents")
        result = pipe.run({"retriever": {"query": "What is AI?"}})
        """
    )
    findings = _check_unguarded_generator("<test>", tree, names)
    # Standard RAG pipelines ARE warned — they lack governance
    assert len(findings) == 1
    assert findings[0].check == "unguarded-generator"


# ---------------------------------------------------------------------------
# agent-loop check
# ---------------------------------------------------------------------------


def test_flags_while_true_with_pipeline_run_no_guard():
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator

        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))

        while True:
            result = pipe.run({"llm": {"prompt": "Next step"}})
        """
    )
    findings = _check_agent_loop("<test>", tree, names)
    assert len(findings) == 1
    assert findings[0].check == "agent-loop"


def test_no_false_positive_single_pipeline_run():
    """A single pipe.run() outside any loop must not trigger agent-loop."""
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator

        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
        result = pipe.run({"llm": {"prompt": "Hello"}})
        """
    )
    findings = _check_agent_loop("<test>", tree, names)
    assert findings == []


def test_no_false_positive_while_true_with_budget_guard():
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator
        from tealtiger import BudgetManager

        budget = BudgetManager(limit=0.50)
        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))

        while True:
            ok = budget.check()
            if not ok:
                break
            result = pipe.run({"llm": {"prompt": "Next step"}})
        """
    )
    findings = _check_agent_loop("<test>", tree, names)
    assert findings == []


def test_no_false_positive_bounded_for_loop():
    """A for-loop (not while True) must not trigger agent-loop."""
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator

        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))

        for query in ["a", "b", "c"]:
            result = pipe.run({"llm": {"prompt": query}})
        """
    )
    findings = _check_agent_loop("<test>", tree, names)
    assert findings == []


def test_no_false_positive_while_condition():
    """while some_condition: (not True) must not trigger agent-loop."""
    tree, names = _parse(
        """
        from haystack import Pipeline
        from haystack.components.generators.openai import OpenAIGenerator

        pipe = Pipeline()
        pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
        done = False
        while not done:
            result = pipe.run({"llm": {"prompt": "Step"}})
            done = True
        """
    )
    findings = _check_agent_loop("<test>", tree, names)
    assert findings == []


# ---------------------------------------------------------------------------
# scan_file integration
# ---------------------------------------------------------------------------


def test_scan_file_non_haystack_returns_empty(tmp_path: Path):
    f = tmp_path / "utils.py"
    f.write_text("import os\n\ndef helper():\n    return 42\n")
    assert scan_file(str(f), {"unguarded-generator", "agent-loop"}) == []


def test_scan_file_syntax_error_returns_empty(tmp_path: Path):
    f = tmp_path / "broken.py"
    f.write_text("def broken(\n")
    assert scan_file(str(f), {"unguarded-generator", "agent-loop"}) == []


def test_scan_file_respects_disabled_checks(tmp_path: Path):
    f = tmp_path / "pipeline.py"
    f.write_text(
        textwrap.dedent(
            """
            from haystack import Pipeline
            from haystack.components.generators.openai import OpenAIGenerator

            pipe = Pipeline()
            pipe.add_component("llm", OpenAIGenerator(model="gpt-4o"))
            while True:
                pipe.run({"llm": {"prompt": "x"}})
            """
        )
    )
    # Only run agent-loop check, not unguarded-generator
    findings = scan_file(str(f), {"agent-loop"})
    checks_seen = {fw.check for fw in findings}
    assert "unguarded-generator" not in checks_seen
    assert "agent-loop" in checks_seen
