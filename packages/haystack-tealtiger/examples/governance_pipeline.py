"""Example: TealTiger Governance in a Haystack Pipeline.

Demonstrates both zero-config and policy modes for the
TealTigerGovernanceComponent in a Haystack pipeline.

Requirements:
    pip install tealtiger-haystack haystack-ai

Usage:
    python governance_pipeline.py
"""

from __future__ import annotations

from haystack import Pipeline, component


# ─── Mock LLM for demonstration (replace with real generator) ────────────────


@component
class MockGenerator:
    """Mock text generator for demonstration purposes."""

    @component.output_types(replies=list)
    def run(self, prompt: str) -> dict:
        """Generate a mock response."""
        return {"replies": [f"[Mock LLM response to: {prompt[:50]}...]"]}


# ─── Example 1: Zero-Config Mode ────────────────────────────────────────────


def zero_config_pipeline() -> None:
    """Run a pipeline with zero-config governance (observe mode).

    In this mode, TealTiger:
    - Passes all text through unchanged
    - Tracks estimated cost per evaluation
    - Detects PII in input text
    - Produces structured audit entries with correlation IDs
    - Adds <2ms latency
    """
    from haystack_integrations.components.connectors.tealtiger import (
        TealTigerGovernanceComponent,
    )

    # Build pipeline
    pipeline = Pipeline()
    pipeline.add_component("governance", TealTigerGovernanceComponent())
    pipeline.add_component("llm", MockGenerator())
    pipeline.connect("governance.text", "llm.prompt")

    # Run with clean text
    print("=" * 60)
    print("Example 1: Zero-Config Mode (Observe)")
    print("=" * 60)

    result = pipeline.run({"governance": {"text": "What is the capital of France?"}})
    print(f"\nLLM Response: {result['llm']['replies'][0]}")
    print(f"Decision: {result['governance']['decision']['action']}")
    print(f"Cost: ${result['governance']['decision']['cost_tracked']:.6f}")
    print(f"PII Detected: {len(result['governance']['decision']['pii_detected'])}")
    print(f"Correlation ID: {result['governance']['decision']['correlation_id']}")

    # Run with PII in input
    print("\n--- With PII in input ---")
    result = pipeline.run(
        {"governance": {"text": "My email is john@example.com and SSN is 123-45-6789"}}
    )
    print(f"Decision: {result['governance']['decision']['action']}")
    print(f"PII Findings: {result['governance']['decision']['pii_detected']}")
    print(f"Risk Score: {result['governance']['decision']['risk_score']}")
    print(f"Reason: {result['governance']['decision']['reason']}")


# ─── Example 2: Policy Mode with TealEngine ─────────────────────────────────


def policy_mode_pipeline() -> None:
    """Run a pipeline with TealEngine policy enforcement.

    In this mode, TealTiger evaluates configured policies and can
    block requests that violate governance rules.
    """
    from unittest.mock import MagicMock

    from haystack_integrations.components.connectors.tealtiger import (
        TealTigerGovernanceComponent,
    )
    from haystack_integrations.components.connectors.tealtiger.governance_component import (
        GovernanceDenyError,
    )

    print("\n" + "=" * 60)
    print("Example 2: Policy Mode (Enforce)")
    print("=" * 60)

    # Create a mock TealEngine (replace with real TealEngine in production)
    # from tealtiger import TealEngine
    # engine = TealEngine(policies=[...])
    engine = MagicMock()

    # Simulate ALLOW decision
    engine.evaluate.return_value = {
        "action": "ALLOW",
        "reason": "Request compliant with all policies",
        "reason_codes": ["POLICY_COMPLIANT"],
        "risk_score": 0,
    }

    pipeline = Pipeline()
    pipeline.add_component(
        "governance",
        TealTigerGovernanceComponent(engine=engine, mode="ENFORCE"),
    )
    pipeline.add_component("llm", MockGenerator())
    pipeline.connect("governance.text", "llm.prompt")

    # Allowed request
    result = pipeline.run({"governance": {"text": "Summarize this document"}})
    print(f"\nAllowed request:")
    print(f"  LLM Response: {result['llm']['replies'][0]}")
    print(f"  Decision: {result['governance']['decision']['action']}")

    # Simulate DENY decision (e.g., cost limit exceeded)
    engine.evaluate.return_value = {
        "action": "DENY",
        "reason": "Session cost limit exceeded: $5.00/$5.00",
        "reason_codes": ["COST_LIMIT_EXCEEDED"],
        "risk_score": 80,
    }

    print(f"\nDenied request (raise_on_deny=True):")
    try:
        pipeline.run({"governance": {"text": "Another expensive request"}})
    except GovernanceDenyError as e:
        print(f"  Blocked: {e}")
        print(f"  Reason codes: {e.decision['reason_codes']}")

    # Non-raising deny mode
    pipeline2 = Pipeline()
    pipeline2.add_component(
        "governance",
        TealTigerGovernanceComponent(engine=engine, mode="ENFORCE", raise_on_deny=False),
    )
    pipeline2.add_component("llm", MockGenerator())
    pipeline2.connect("governance.text", "llm.prompt")

    print(f"\nDenied request (raise_on_deny=False):")
    result = pipeline2.run({"governance": {"text": "Blocked request"}})
    print(f"  Text output: '{result['governance']['decision']['action']}'")
    print(f"  LLM received empty prompt, response: {result['llm']['replies'][0]}")


# ─── Example 3: Audit Trail ─────────────────────────────────────────────────


def audit_trail_example() -> None:
    """Demonstrate the structured audit trail with correlation IDs."""
    from haystack_integrations.components.connectors.tealtiger import (
        TealTigerGovernanceComponent,
    )

    print("\n" + "=" * 60)
    print("Example 3: Audit Trail")
    print("=" * 60)

    gov = TealTigerGovernanceComponent(agent_id="demo-pipeline-001")

    # Run multiple evaluations
    texts = [
        "What is machine learning?",
        "Contact me at user@company.com",
        "My card number is 4111-1111-1111-1111",
    ]

    for text in texts:
        gov.run(text=text)

    # Print audit trail
    print(f"\nTotal evaluations: {gov.evaluation_count}")
    print(f"Cumulative cost: ${gov.cumulative_cost:.6f}")
    print(f"\nAudit Trail:")
    for entry in gov.audit_trail:
        print(f"  [{entry.correlation_id[:8]}...] {entry.action} | "
              f"PII: {len(entry.pii_detected)} | "
              f"Risk: {entry.risk_score} | "
              f"Time: {entry.evaluation_time_ms:.2f}ms")

    # Reset for next pipeline run
    gov.reset()
    print(f"\nAfter reset — evaluations: {gov.evaluation_count}, cost: ${gov.cumulative_cost:.2f}")


# ─── Main ────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    zero_config_pipeline()
    policy_mode_pipeline()
    audit_trail_example()
