"""Basic usage of tealtiger-phoenix with Phoenix tracing.

Shows how governance decisions appear as spans in the Phoenix trace viewer.
"""

import os
from tealtiger_phoenix import PhoenixGovernanceSpanExporter


def main():
    """Demonstrate governance span export to Phoenix."""

    # In production, you'd first register Phoenix:
    # from phoenix.otel import register
    # tracer_provider = register(project_name="governed-agent")

    # Create the exporter
    exporter = PhoenixGovernanceSpanExporter(
        record_allows=True,   # Record all decisions
        include_cost=True,    # Include cost attributes
    )

    # Simulate governance decisions (normally from TealTiger's on_decision callback)
    decisions = [
        {
            "action": "ALLOW",
            "correlation_id": "dec-001",
            "tool_name": "google_search",
            "agent_id": "research-agent",
            "mode": "ENFORCE",
            "reason_codes": ["POLICY_ALLOW"],
            "risk_score": 0,
            "evaluation_time_ms": 0.3,
            "cost_tracked": 0.002,
            "cumulative_cost": 0.002,
        },
        {
            "action": "DENY",
            "correlation_id": "dec-002",
            "tool_name": "send_email",
            "agent_id": "research-agent",
            "mode": "ENFORCE",
            "reason_codes": ["PII_DETECTED:ssn", "PII_DETECTED:email"],
            "risk_score": 90,
            "evaluation_time_ms": 0.8,
            "cost_tracked": 0.0,
            "cumulative_cost": 0.002,
        },
        {
            "action": "ALLOW",
            "correlation_id": "dec-003",
            "tool_name": "code_execution",
            "agent_id": "research-agent",
            "mode": "ENFORCE",
            "reason_codes": ["POLICY_ALLOW"],
            "risk_score": 0,
            "evaluation_time_ms": 0.2,
            "cost_tracked": 0.002,
            "cumulative_cost": 0.004,
        },
    ]

    # Export all decisions
    exporter.export_batch(decisions)

    # Print summary
    print(f"Exported {exporter.decision_count} governance decisions to Phoenix")
    print(f"  Denied: {exporter.deny_count}")
    print(f"  Allowed: {exporter.decision_count - exporter.deny_count}")
    print()
    print("Open Phoenix at http://localhost:6006 to see governance spans")
    print("DENY decisions appear as red ERROR spans in the trace timeline")


if __name__ == "__main__":
    main()
