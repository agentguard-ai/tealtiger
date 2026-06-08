"""Example: TealTiger Governance Guard for Pydantic AI Agents.

Demonstrates zero-config, policy mode, kill switch, tool allowlist,
and budget limits for the TealTigerGuard with Pydantic AI agents.

Requirements:
    pip install pydanticai-tealtiger pydantic-ai

Usage:
    python governance_example.py
"""

from __future__ import annotations

from unittest.mock import MagicMock


# ─── Example 1: Zero-Config Mode ────────────────────────────────────────────


def zero_config_example() -> None:
    """Run agents with zero-config governance (observe mode).

    In this mode, TealTiger:
    - Allows all tool calls through unchanged
    - Tracks estimated cost per call and per tool
    - Detects PII in tool arguments and results
    - Produces structured audit entries with correlation IDs
    - Adds <2ms latency per evaluation
    """
    from pydanticai_tealtiger import TealTigerGuard

    print("=" * 60)
    print("Example 1: Zero-Config Mode (Observe)")
    print("=" * 60)

    # Create guard — zero configuration needed
    guard = TealTigerGuard()

    # Simulate tool calls (as you would in a Pydantic AI tool function)
    print("\n--- Tool: search ---")
    d1 = guard.evaluate(tool="search", args={"query": "AI safety research"})
    print(f"  evaluate: {d1['action']} | cost: ${d1['cost_tracked']:.6f}")

    guard.post_call(
        tool_name="search",
        result="Found 15 relevant papers on AI safety...",
        token_usage={"prompt_tokens": 200, "completion_tokens": 150},
    )

    # Tool call with PII
    print("\n--- Tool with PII in args ---")
    d2 = guard.evaluate(
        tool="send_email",
        args={"to": "john.doe@company.com", "body": "SSN: 123-45-6789"},
    )
    print(f"  evaluate: {d2['action']} | PII: {len(d2['pii_detected'])} findings")
    print(f"  Risk score: {d2['risk_score']}")
    print(f"  Reason: {d2['reason']}")

    # Another tool
    print("\n--- Tool: compute ---")
    d3 = guard.evaluate(
        tool="compute",
        args={"expression": "2 + 2", "precision": "high"},
    )
    print(f"  evaluate: {d3['action']} | tool: compute")

    # Print summary
    print(f"\n--- Session Summary ---")
    print(f"  Session ID: {guard.session_id}")
    print(f"  Total cost: ${guard.cumulative_cost:.6f}")
    print(f"  Audit trail entries: {len(guard.audit_trail)}")
    for tool_name, summary in guard.summary.items():
        print(
            f"  {tool_name}: {summary.call_count} calls, "
            f"${summary.total_cost:.6f}, "
            f"{summary.pii_findings_count} PII findings"
        )


# ─── Example 2: Policy Mode with TealEngine ─────────────────────────────────


def policy_mode_example() -> None:
    """Run agents with TealEngine policy enforcement.

    In this mode, TealTiger evaluates configured policies and can
    block tool calls that violate governance rules.
    """
    from pydanticai_tealtiger import GovernanceDenyError, TealTigerGuard

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

    guard = TealTigerGuard(engine=engine, mode="ENFORCE")

    # Allowed call
    print("\n--- Allowed tool call ---")
    decision = guard.evaluate(
        tool="search",
        args={"query": "AI safety 2024"},
        agent_id="researcher-001",
    )
    print(f"  Action: {decision['action']}")
    print(f"  TEEC session: {decision['teec']['session_id']}")

    # Simulate DENY decision (cost limit)
    engine.evaluate.return_value = {
        "action": "DENY",
        "reason": "Session cost limit exceeded: $5.00/$5.00",
        "reason_codes": ["COST_LIMIT_EXCEEDED"],
        "risk_score": 80,
    }

    print("\n--- Denied tool call (ENFORCE mode) ---")
    try:
        guard.evaluate(
            tool="gpt4_analyze",
            args={"data": "expensive payload"},
            agent_id="researcher-001",
        )
    except GovernanceDenyError as e:
        print(f"  BLOCKED: {e}")
        print(f"  Reason codes: {e.decision['reason_codes']}")
        print(f"  Risk score: {e.decision['risk_score']}")


# ─── Example 3: Kill Switch ─────────────────────────────────────────────────


def kill_switch_example() -> None:
    """Demonstrate the freeze/unfreeze kill switch."""
    from pydanticai_tealtiger import GovernanceDenyError, TealTigerGuard

    print("\n" + "=" * 60)
    print("Example 3: Kill Switch (Freeze/Unfreeze)")
    print("=" * 60)

    guard = TealTigerGuard(mode="ENFORCE")

    # Tool call works normally
    print("\n--- Before freeze ---")
    d = guard.evaluate(tool="search", args={"query": "normal"})
    print(f"  Action: {d['action']}")

    # Freeze the guard (kill switch)
    guard.freeze()
    print("\n--- After freeze (kill switch active) ---")

    try:
        guard.evaluate(tool="search", args={"query": "blocked"})
    except GovernanceDenyError as e:
        print(f"  BLOCKED: {e}")

    try:
        guard.evaluate(tool="compute", args={"x": 1})
    except GovernanceDenyError as e:
        print(f"  BLOCKED again: {e}")

    # Unfreeze
    guard.unfreeze()
    print("\n--- After unfreeze ---")
    d = guard.evaluate(tool="search", args={"query": "back in action"})
    print(f"  Action: {d['action']}")


# ─── Example 4: Tool Allowlist ───────────────────────────────────────────────


def tool_allowlist_example() -> None:
    """Demonstrate tool allowlist enforcement."""
    from pydanticai_tealtiger import GovernanceDenyError, TealTigerGuard

    print("\n" + "=" * 60)
    print("Example 4: Tool Allowlist")
    print("=" * 60)

    guard = TealTigerGuard(
        mode="ENFORCE",
        tool_allowlist=["search", "compute", "read_file"],
    )

    # Allowed tool
    print("\n--- Allowed tool: 'search' ---")
    d = guard.evaluate(tool="search", args={"query": "test"})
    print(f"  Action: {d['action']}")

    # Denied tool
    print("\n--- Denied tool: 'delete_all' ---")
    try:
        guard.evaluate(tool="delete_all", args={"target": "/"})
    except GovernanceDenyError as e:
        print(f"  BLOCKED: {e}")
        print(f"  Reason codes: {e.decision['reason_codes']}")


# ─── Example 5: Budget Limit ────────────────────────────────────────────────


def budget_limit_example() -> None:
    """Demonstrate budget limit enforcement."""
    from pydanticai_tealtiger import GovernanceDenyError, TealTigerGuard

    print("\n" + "=" * 60)
    print("Example 5: Budget Limit")
    print("=" * 60)

    guard = TealTigerGuard(
        mode="ENFORCE",
        budget_limit=0.05,  # $0.05 max per session
        cost_per_1k_tokens=0.01,
    )

    # Make several calls until budget exceeded
    print("\n--- Calling until budget exceeded ---")
    for i in range(10):
        try:
            d = guard.evaluate(
                tool="search",
                args={"query": "x" * 2000},  # ~500 tokens per call
            )
            print(f"  Call {i + 1}: {d['action']} | cumulative: ${guard.cumulative_cost:.4f}")
        except GovernanceDenyError as e:
            print(f"  Call {i + 1}: BLOCKED — {e.decision['reason']}")
            break


# ─── Example 6: Pydantic AI Integration Pattern ─────────────────────────────


def pydantic_ai_pattern_example() -> None:
    """Show how TealTigerGuard works as a Pydantic AI dependency.

    Note: This example shows the pattern without actually running
    a Pydantic AI agent (which requires an LLM API key).
    """
    from pydanticai_tealtiger import TealTigerGuard

    print("\n" + "=" * 60)
    print("Example 6: Pydantic AI Integration Pattern")
    print("=" * 60)

    print("""
    # In your Pydantic AI application:

    from pydantic_ai import Agent
    from pydanticai_tealtiger import TealTigerGuard

    guard = TealTigerGuard(
        mode="ENFORCE",
        tool_allowlist=["search", "compute"],
        budget_limit=1.00,
    )

    agent = Agent('openai:gpt-4', deps_type=TealTigerGuard)

    @agent.tool
    async def search(ctx, query: str) -> str:
        # Governance check before execution
        ctx.deps.evaluate(tool="search", args={"query": query})

        result = perform_search(query)

        # Record cost after execution
        ctx.deps.post_call(tool_name="search", result=result)
        return result

    # Run the agent
    result = await agent.run("Find papers on AI safety", deps=guard)
    """)

    # Simulate what happens inside the tool
    guard = TealTigerGuard(
        mode="ENFORCE",
        tool_allowlist=["search", "compute"],
        budget_limit=1.00,
    )

    print("--- Simulating tool execution ---")
    decision = guard.evaluate(tool="search", args={"query": "AI safety papers"})
    print(f"  Pre-call: {decision['action']}")

    guard.post_call(
        tool_name="search",
        result="Found 10 papers...",
        token_usage={"total_tokens": 500},
    )
    print(f"  Post-call recorded. Cumulative cost: ${guard.cumulative_cost:.6f}")
    print(f"  Audit trail: {len(guard.audit_trail)} entries")


# ─── Main ────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    zero_config_example()
    policy_mode_example()
    kill_switch_example()
    tool_allowlist_example()
    budget_limit_example()
    pydantic_ai_pattern_example()
