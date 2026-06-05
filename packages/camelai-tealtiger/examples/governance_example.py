"""Example: TealTiger Governance Hook for CAMEL-AI Multi-Agent Systems.

Demonstrates zero-config, policy mode, kill switch, and role validation
for the TealTigerAgentHook with CAMEL-AI agents.

Requirements:
    pip install camelai-tealtiger camel-ai

Usage:
    python governance_example.py
"""

from __future__ import annotations

from unittest.mock import MagicMock


# ─── Example 1: Zero-Config Mode ────────────────────────────────────────────


def zero_config_example() -> None:
    """Run agents with zero-config governance (observe mode).

    In this mode, TealTiger:
    - Allows all agent steps through unchanged
    - Tracks estimated cost per step and per agent
    - Detects PII in step content and results
    - Produces structured audit entries with correlation IDs
    - Adds <2ms latency per evaluation
    """
    from camelai_tealtiger import TealTigerAgentHook

    print("=" * 60)
    print("Example 1: Zero-Config Mode (Observe)")
    print("=" * 60)

    # Create hook — zero configuration needed
    hook = TealTigerAgentHook()

    # Simulate agent steps
    print("\n--- Agent 'assistant' performing steps ---")
    d1 = hook.pre_step(
        agent_id="assistant-001",
        step_content="Summarize the following document about AI safety...",
        agent_role="assistant",
        role_type="assistant",
    )
    print(f"  pre_step: {d1['action']} | cost: ${d1['cost_tracked']:.6f}")

    hook.post_step(
        agent_id="assistant-001",
        step_result="The document discusses three key aspects of AI safety...",
        token_usage={"prompt_tokens": 200, "completion_tokens": 150},
    )

    # Step with PII
    print("\n--- Agent with PII in content ---")
    d2 = hook.pre_step(
        agent_id="assistant-001",
        step_content="Contact john.doe@company.com about SSN 123-45-6789",
        agent_role="assistant",
    )
    print(f"  pre_step: {d2['action']} | PII: {len(d2['pii_detected'])} findings")
    print(f"  Risk score: {d2['risk_score']}")
    print(f"  Reason: {d2['reason']}")

    # Another agent
    print("\n--- Agent 'critic' performing steps ---")
    d3 = hook.pre_step(
        agent_id="critic-001",
        step_content="Review the assistant's summary for accuracy...",
        tool_name="evaluate_response",
        tool_args={"criteria": "accuracy"},
        agent_role="critic",
        role_type="critic",
    )
    print(f"  pre_step: {d3['action']} | tool: evaluate_response")

    # Print summary
    print(f"\n--- Session Summary ---")
    print(f"  Session ID: {hook.session_id}")
    print(f"  Total cost: ${hook.cumulative_cost:.6f}")
    print(f"  Audit trail entries: {len(hook.audit_trail)}")
    for agent_id, summary in hook.summary.items():
        print(
            f"  {agent_id}: {summary.step_count} steps, "
            f"${summary.total_cost:.6f}, "
            f"{summary.pii_findings_count} PII findings"
        )


# ─── Example 2: Policy Mode with TealEngine ─────────────────────────────────


def policy_mode_example() -> None:
    """Run agents with TealEngine policy enforcement.

    In this mode, TealTiger evaluates configured policies and can
    block agent steps that violate governance rules.
    """
    from camelai_tealtiger import GovernanceDenyError, TealTigerAgentHook

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

    hook = TealTigerAgentHook(
        engine=engine,
        mode="ENFORCE",
        task_prompt="Research AI safety papers and summarize findings",
        society_id="research-team-001",
    )

    # Allowed step
    print("\n--- Allowed step ---")
    decision = hook.pre_step(
        agent_id="researcher-001",
        step_content="Search for recent AI safety papers",
        tool_name="arxiv_search",
        tool_args={"query": "AI safety 2024"},
        agent_role="researcher",
    )
    print(f"  Action: {decision['action']}")
    print(f"  TEEC session: {decision['teec']['session_id']}")
    print(f"  TEEC society: {decision['teec']['society_id']}")

    # Simulate DENY decision (cost limit)
    engine.evaluate.return_value = {
        "action": "DENY",
        "reason": "Session cost limit exceeded: $5.00/$5.00",
        "reason_codes": ["COST_LIMIT_EXCEEDED"],
        "risk_score": 80,
    }

    print("\n--- Denied step (ENFORCE mode) ---")
    try:
        hook.pre_step(
            agent_id="researcher-001",
            step_content="Expensive API call to process data",
            tool_name="gpt4_analyze",
            agent_role="researcher",
        )
    except GovernanceDenyError as e:
        print(f"  BLOCKED: {e}")
        print(f"  Reason codes: {e.decision['reason_codes']}")
        print(f"  Risk score: {e.decision['risk_score']}")


# ─── Example 3: Kill Switch ─────────────────────────────────────────────────


def kill_switch_example() -> None:
    """Demonstrate the freeze/unfreeze kill switch."""
    from camelai_tealtiger import GovernanceDenyError, TealTigerAgentHook

    print("\n" + "=" * 60)
    print("Example 3: Kill Switch (Freeze/Unfreeze)")
    print("=" * 60)

    hook = TealTigerAgentHook(mode="ENFORCE")

    # Agent works normally
    print("\n--- Before freeze ---")
    d = hook.pre_step(agent_id="rogue-agent", step_content="Normal step")
    print(f"  Action: {d['action']}")

    # Freeze the agent (kill switch)
    hook.freeze("rogue-agent")
    print("\n--- After freeze (kill switch active) ---")

    try:
        hook.pre_step(agent_id="rogue-agent", step_content="Trying to act")
    except GovernanceDenyError as e:
        print(f"  BLOCKED: {e}")

    try:
        hook.pre_step(agent_id="rogue-agent", step_content="Still trying")
    except GovernanceDenyError as e:
        print(f"  BLOCKED again: {e}")

    # Other agents unaffected
    d = hook.pre_step(agent_id="good-agent", step_content="I'm fine")
    print(f"\n  Other agent (good-agent): {d['action']}")

    # Unfreeze
    hook.unfreeze("rogue-agent")
    print("\n--- After unfreeze ---")
    d = hook.pre_step(agent_id="rogue-agent", step_content="Back in action")
    print(f"  Action: {d['action']}")


# ─── Example 4: Role Validation ─────────────────────────────────────────────


def role_validation_example() -> None:
    """Demonstrate role-based access control with allowlist."""
    from camelai_tealtiger import GovernanceDenyError, TealTigerAgentHook

    print("\n" + "=" * 60)
    print("Example 4: Role Validation")
    print("=" * 60)

    hook = TealTigerAgentHook(
        mode="ENFORCE",
        role_allowlist=["assistant", "critic", "researcher"],
    )

    # Allowed role
    print("\n--- Allowed role: 'assistant' ---")
    d = hook.pre_step(
        agent_id="agent-1",
        step_content="Summarize this",
        agent_role="assistant",
    )
    print(f"  Action: {d['action']}")

    # Denied role
    print("\n--- Denied role: 'admin' ---")
    try:
        hook.pre_step(
            agent_id="agent-2",
            step_content="Delete all records",
            agent_role="admin",
        )
    except GovernanceDenyError as e:
        print(f"  BLOCKED: {e}")
        print(f"  Reason codes: {e.decision['reason_codes']}")


# ─── Example 5: Behavioral Baseline ─────────────────────────────────────────


def baseline_example() -> None:
    """Demonstrate behavioral baseline generation."""
    from camelai_tealtiger import TealTigerAgentHook

    print("\n" + "=" * 60)
    print("Example 5: Behavioral Baseline")
    print("=" * 60)

    hook = TealTigerAgentHook()

    # Simulate multiple steps
    for i in range(5):
        hook.pre_step(
            agent_id="agent-1",
            step_content=f"Research step {i}: analyzing paper...",
            tool_name="web_search" if i % 2 == 0 else "summarize",
            agent_role="researcher",
        )
        hook.post_step(
            agent_id="agent-1",
            step_result=f"Found {i + 1} relevant papers",
            token_usage={"total_tokens": 200 + i * 50},
        )

    hook.pre_step(
        agent_id="agent-2",
        step_content="Contact user@example.com about results",
        agent_role="communicator",
    )

    # Get baseline
    baseline = hook.get_baseline()
    print(f"\n--- Baseline ---")
    for agent_id, entry in baseline.items():
        print(f"\n  Agent: {agent_id}")
        print(f"    Steps: {entry.total_steps}")
        print(f"    Avg cost/step: ${entry.avg_cost_per_step:.6f}")
        print(f"    Total cost: ${entry.total_cost:.6f}")
        print(f"    PII frequency: {entry.pii_frequency:.2f}")
        print(f"    Common tools: {entry.common_tools}")


# ─── Main ────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    zero_config_example()
    policy_mode_example()
    kill_switch_example()
    role_validation_example()
    baseline_example()
