"""Example: Policy Enforcement Mode with ag2-tealtiger.

Demonstrates how to use TealTigerGuard in ENFORCE mode with a TealEngine
to block unauthorized tool calls. In this mode:
- TealEngine evaluates each tool call against configured policies
- DENY decisions block the tool call and return a visible denial message
- ALLOW decisions pass through transparently
- Engine errors trigger fail-closed behavior (deny by default)
- Per-agent freeze kills all actions immediately

This is the production pattern: define policies, set ENFORCE mode,
and let governance block violations automatically.

Requirements:
    pip install ag2-tealtiger

Usage:
    python policy_enforcement.py
"""

from __future__ import annotations

from typing import Any


# ─── Inline mocks so the example runs without real AG2/TealEngine ────────────


class MockConversableAgent:
    """Minimal AG2 ConversableAgent stub for demonstration."""

    def __init__(self, name: str, **kwargs):
        self.name = name
        self._reply_funcs: list[dict] = []

    def register_reply(self, trigger=None, reply_func=None, position=0, **kwargs):
        self._reply_funcs.insert(position, {
            "trigger": trigger,
            "reply_func": reply_func,
        })

    def simulate_tool_call(self, tool_name: str, arguments: dict) -> str | None:
        """Simulate a tool call flowing through the governance pipeline."""
        messages = [{
            "role": "assistant",
            "content": None,
            "tool_calls": [{
                "id": f"call_{tool_name}",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": arguments,
                },
            }],
        }]

        for entry in self._reply_funcs:
            reply_func = entry["reply_func"]
            should_terminate, reply = reply_func(
                recipient=self,
                messages=messages,
                sender=self,
                config=None,
            )
            if should_terminate:
                return reply
        return None


class MockTealEngine:
    """Mock TealEngine that evaluates tool calls against a simple policy.

    In production, replace this with the real TealEngine:
        from tealtiger import TealEngine
        engine = TealEngine(policies=[...])

    This mock demonstrates the interface TealTigerGuard expects:
    - engine.evaluate(tool_name, args, context) -> dict with action, reason, etc.
    """

    def __init__(self, blocked_tools: list[str] | None = None):
        self.blocked_tools = blocked_tools or []
        self._call_count = 0

    def evaluate(
        self,
        tool_name: str = "",
        tool_args: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Evaluate a tool call against configured policies."""
        self._call_count += 1

        if tool_name in self.blocked_tools:
            return {
                "action": "DENY",
                "reason": f"Tool '{tool_name}' is not on the approved allowlist",
                "reason_codes": ["TOOL_NOT_ALLOWED", "POLICY_VIOLATION"],
                "risk_score": 85,
            }

        return {
            "action": "ALLOW",
            "reason": "Tool call compliant with all configured policies",
            "reason_codes": ["POLICY_COMPLIANT"],
            "risk_score": 0,
        }


# ─── Example: Policy Enforcement ────────────────────────────────────────────


def main() -> None:
    """Demonstrate ENFORCE mode with TealEngine policy evaluation."""
    from ag2_tealtiger import TealTigerGuard, GovernanceMode

    print("=" * 65)
    print("  ag2-tealtiger: Policy Enforcement Mode")
    print("=" * 65)

    # ── Setup: Create engine with a blocked-tools policy ──────────────────
    # Block dangerous tools: shell execution and file deletion
    engine = MockTealEngine(blocked_tools=["execute_shell", "delete_file", "rm_rf"])

    # Create guard in ENFORCE mode — denials BLOCK tool execution
    guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

    # Create and attach agents
    coder = MockConversableAgent(name="coder")
    executor = MockConversableAgent(name="executor")
    guard.attach(coder)
    guard.attach(executor)

    # ── Scenario 1: Allowed tool calls pass through ───────────────────────
    print("\n--- Scenario 1: Allowed tool calls ---\n")

    result = coder.simulate_tool_call("write_code", {"language": "python", "task": "sort list"})
    print(f"  write_code → {'PASSED (None)' if result is None else 'BLOCKED'}")

    result = coder.simulate_tool_call("read_file", {"path": "/src/main.py"})
    print(f"  read_file  → {'PASSED (None)' if result is None else 'BLOCKED'}")

    # ── Scenario 2: Denied tool calls are blocked with visible message ────
    print("\n--- Scenario 2: Denied tool calls (ENFORCE blocks) ---\n")

    result = executor.simulate_tool_call("execute_shell", {"command": "rm -rf /"})
    print(f"  execute_shell → BLOCKED")
    print(f"    Reply: {result}")

    result = executor.simulate_tool_call("delete_file", {"path": "/etc/passwd"})
    print(f"  delete_file   → BLOCKED")
    print(f"    Reply: {result}")

    # Allowed tool still works after denials
    result = executor.simulate_tool_call("read_file", {"path": "/tmp/safe.txt"})
    print(f"\n  read_file (after denials) → {'PASSED (None)' if result is None else 'BLOCKED'}")

    # ── Scenario 3: Per-agent freeze kill switch ──────────────────────────
    print("\n--- Scenario 3: Freeze kill switch ---\n")

    # Freeze the executor mid-conversation
    guard.freeze("executor")
    print(f"  executor frozen: {guard.is_frozen('executor')}")

    # All tool calls blocked for frozen agent
    result = executor.simulate_tool_call("read_file", {"path": "/tmp/harmless.txt"})
    print(f"  executor.read_file → BLOCKED (frozen)")
    print(f"    Reply: {result}")

    # Coder still works — freeze is per-agent
    result = coder.simulate_tool_call("write_code", {"task": "hello world"})
    print(f"  coder.write_code   → {'PASSED (None)' if result is None else 'BLOCKED'}")

    # Unfreeze restores normal governance
    guard.unfreeze("executor")
    print(f"\n  executor unfrozen: {not guard.is_frozen('executor')}")
    result = executor.simulate_tool_call("read_file", {"path": "/tmp/data.csv"})
    print(f"  executor.read_file → {'PASSED (None)' if result is None else 'BLOCKED'}")

    # ── Scenario 4: Budget enforcement ────────────────────────────────────
    print("\n--- Scenario 4: Budget enforcement ---\n")

    # Set a tight budget for the executor
    guard.set_budget("executor", limit=0.001)  # $0.001 budget

    # Pre-load some cost to approach the limit, then trigger denial
    guard._budget_manager.track_cost("executor", 0.0009)  # Near the limit
    budget = guard.get_budget_state("executor")
    print(f"  Pre-loaded cost: spent=${budget.current_spend:.6f} / limit=${budget.budget_limit:.6f}")

    # This call should push over the limit
    result = executor.simulate_tool_call("analyze_data", {"dataset": "large_batch" * 200})
    budget = guard.get_budget_state("executor")
    status = "BLOCKED" if result else "PASSED"
    print(f"  call 1: {status} | spent=${budget.current_spend:.6f} / limit=${budget.budget_limit:.6f}")

    # Now budget is exceeded — next call should be denied
    result = executor.simulate_tool_call("analyze_data", {"dataset": "another_batch"})
    budget = guard.get_budget_state("executor")
    status = "BLOCKED" if result else "PASSED"
    print(f"  call 2: {status} | spent=${budget.current_spend:.6f} / limit=${budget.budget_limit:.6f}")
    if result:
        print(f"    Reply: {result[:80]}...")

    # ── Audit trail shows full governance history ─────────────────────────
    print("\n--- Audit Trail Summary ---\n")

    allows = sum(1 for e in guard.audit_trail if e.action == "ALLOW")
    denies = sum(1 for e in guard.audit_trail if e.action == "DENY")
    print(f"  Total evaluations: {len(guard.audit_trail)}")
    print(f"  Allowed: {allows}")
    print(f"  Denied:  {denies}")
    print(f"\n  Last 3 entries:")
    for entry in guard.audit_trail[-3:]:
        print(
            f"    [{entry.agent_id:<10}] {entry.action:<5} "
            f"tool={entry.tool_name or 'N/A':<14} "
            f"codes={entry.reason_codes}"
        )

    # ── Key takeaways ─────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  Key points:")
    print("  • ENFORCE mode blocks denied tool calls with visible messages")
    print("  • Freeze is a per-agent kill switch (mode-independent)")
    print("  • Budget enforcement denies calls when limit exceeded")
    print("  • Independent governance per agent — same guard, isolated state")
    print("  • Full audit trail with correlation IDs for every evaluation")
    print("=" * 65)


if __name__ == "__main__":
    main()
