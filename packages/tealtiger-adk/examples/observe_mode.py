"""Observe mode example — zero-config visibility for Google ADK agents.

In OBSERVE mode, TealTiger logs all governance decisions but never blocks
tool calls. Perfect for understanding agent behavior before enabling enforcement.
"""

from tealtiger_adk import TealTigerCallback


def main():
    """Demonstrate observe mode — log everything, block nothing."""

    decisions_log = []

    governance = TealTigerCallback(
        policies=[
            {"type": "pii_block", "categories": ["ssn", "credit_card"]},
            {"type": "cost_limit", "max_per_session": 1.00},
        ],
        mode="OBSERVE",  # Never blocks, only observes
        on_decision=lambda d: decisions_log.append(d),
    )

    # Simulate tool calls — even violations pass through in OBSERVE mode
    governance.before_tool(None, "search", {"query": "SSN 123-45-6789"})
    governance.before_tool(None, "search", {"query": "normal query"})
    governance.before_tool(None, "write_file", {"path": "/tmp/data.csv"})

    print("OBSERVE mode — all calls allowed, decisions logged:")
    print()
    for d in decisions_log:
        status = "⚠️" if d["action"] == "DENY" else "✓"
        print(f"  {status} {d['tool_name']:20s} action={d['action']:5s} risk={d['risk_score']}")
        if d["reason_codes"] != ["POLICY_ALLOW"]:
            print(f"    reasons: {d['reason_codes']}")
    print()
    print(f"Would-be denials: {governance.deny_count} (but none blocked in OBSERVE)")
    print(f"Use ENFORCE mode to actually block these violations.")


if __name__ == "__main__":
    main()
