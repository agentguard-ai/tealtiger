"""
Strands Agents + TealTiger Governance Demo

Demonstrates deterministic governance for Strands tool calls:
1. Tool allowlist enforcement (delete_tool blocked)
2. PII detection in tool arguments (SSN blocked)
3. Cost budget enforcement
4. Kill switch (freeze/unfreeze)

No API keys needed — runs in deterministic demo mode.

Usage:
    pip install strands-agents tealtiger
    python strands_governance_demo.py
"""

from __future__ import annotations

from strands import Agent, tool
from strands_governance import TealTigerGovernanceHook


# --- Define tools ---

@tool
def search_docs(query: str) -> str:
    """Search the documentation for relevant information."""
    return f"Found 3 results for: {query}"


@tool
def write_report(title: str, content: str) -> str:
    """Write a report to the system."""
    return f"Report '{title}' saved successfully."


@tool
def delete_customer(customer_id: str) -> str:
    """Delete a customer record permanently."""
    return f"Customer {customer_id} deleted."


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a recipient."""
    return f"Email sent to {to}: {subject}"


# --- Configure governance ---

governance = TealTigerGovernanceHook(
    mode="enforce",
    policies=[
        # Only allow search and write — delete is blocked
        {"type": "tool_allowlist", "allowed": ["search_docs", "write_report", "send_email"]},
        # Block PII in tool arguments
        {"type": "pii_block", "categories": ["ssn", "credit_card", "email"]},
        # Session budget: $5.00
        {"type": "cost_limit", "max_per_session": 5.00},
    ],
    budget=5.00,
    agent_id="research-agent-prod",
)


# --- Create governed agent ---

agent = Agent(
    tools=[search_docs, write_report, delete_customer, send_email],
    hooks=[governance],
    system_prompt="You are a research assistant. Use tools to help users.",
)


# --- Demo: Simulate governance scenarios ---

def demo():
    """Run governance scenarios without calling an LLM."""
    from strands.hooks import BeforeToolCallEvent
    from unittest.mock import MagicMock

    print("=" * 60)
    print("  Strands Agents + TealTiger Governance Demo")
    print("=" * 60)
    print()

    # Scenario 1: Allowed tool call
    print("--- Scenario 1: search_docs (ALLOWED) ---")
    event1 = MagicMock(spec=BeforeToolCallEvent)
    event1.tool_use = {"name": "search_docs", "input": {"query": "project requirements"}}
    event1.cancel_tool = None
    governance.evaluate_tool_call(event1)
    print(f"  cancel_tool = {event1.cancel_tool}")
    print()

    # Scenario 2: Blocked tool (not in allowlist)
    print("--- Scenario 2: delete_customer (BLOCKED - not in allowlist) ---")
    event2 = MagicMock(spec=BeforeToolCallEvent)
    event2.tool_use = {"name": "delete_customer", "input": {"customer_id": "cust-123"}}
    event2.cancel_tool = None
    governance.evaluate_tool_call(event2)
    print(f"  cancel_tool = {event2.cancel_tool}")
    print()

    # Scenario 3: PII detected in arguments
    print("--- Scenario 3: send_email with SSN (BLOCKED - PII) ---")
    event3 = MagicMock(spec=BeforeToolCallEvent)
    event3.tool_use = {
        "name": "send_email",
        "input": {
            "to": "manager",
            "subject": "Customer info",
            "body": "SSN is 123-45-6789",
        },
    }
    event3.cancel_tool = None
    governance.evaluate_tool_call(event3)
    print(f"  cancel_tool = {event3.cancel_tool}")
    print()

    # Scenario 4: Kill switch
    print("--- Scenario 4: Freeze agent (kill switch) ---")
    governance.freeze()
    event4 = MagicMock(spec=BeforeToolCallEvent)
    event4.tool_use = {"name": "search_docs", "input": {"query": "anything"}}
    event4.cancel_tool = None
    governance.evaluate_tool_call(event4)
    print(f"  cancel_tool = {event4.cancel_tool}")
    print()

    # Scenario 5: Unfreeze
    print("--- Scenario 5: Unfreeze agent ---")
    governance.unfreeze()
    event5 = MagicMock(spec=BeforeToolCallEvent)
    event5.tool_use = {"name": "search_docs", "input": {"query": "project status"}}
    event5.cancel_tool = None
    governance.evaluate_tool_call(event5)
    print(f"  cancel_tool = {event5.cancel_tool}")
    print()

    # --- Report ---
    print("=" * 60)
    print("  Governance Session Report")
    print("=" * 60)
    report = governance.report()
    for key, value in report.items():
        print(f"  {key}: {value}")
    print()

    # --- Audit trail ---
    print("=" * 60)
    print("  Audit Trail")
    print("=" * 60)
    for d in governance.audit_trail:
        status = "✓ ALLOW" if d.action == "allow" else "✗ DENY "
        print(f"  {status} | {d.tool:20s} | {d.reason[:50]}")


if __name__ == "__main__":
    demo()
