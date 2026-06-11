"""Example: Zero-Config Observe Mode with ag2-tealtiger.

Demonstrates how to add governance to AG2 agents with zero configuration.
In observe mode, TealTiger:
- Tracks cumulative cost estimates per agent
- Detects PII in tool call arguments
- Records all tool names, call counts, and argument summaries
- Produces structured audit entries with TEEC correlation
- Never blocks — all tool calls and messages pass through
- Adds <5ms latency per evaluation

This is the easiest way to get started: just create a TealTigerGuard()
with no engine and attach it to any agent.

Requirements:
    pip install ag2-tealtiger

Usage:
    python zero_config_observe.py
"""

from __future__ import annotations


# ─── Inline mocks so the example runs without AG2 installed ──────────────────


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
        """Simulate a tool call message flowing through the reply pipeline."""
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

        # Trigger the first reply hook (the governance interceptor)
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

    def simulate_message(self, content: str) -> str | None:
        """Simulate a message flowing through the reply pipeline."""
        messages = [{
            "role": "assistant",
            "content": content,
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


# ─── Example: Zero-Config Observe Mode ──────────────────────────────────────


def main() -> None:
    """Demonstrate zero-config observe mode with TealTigerGuard."""
    from ag2_tealtiger import TealTigerGuard, TealTigerAuditAgent

    print("=" * 65)
    print("  ag2-tealtiger: Zero-Config Observe Mode")
    print("=" * 65)

    # ── Option A: Attach guard to an existing agent ───────────────────────
    print("\n--- Option A: Attach TealTigerGuard to existing agent ---\n")

    agent = MockConversableAgent(name="code_executor")
    guard = TealTigerGuard()  # No engine = observe mode
    guard.attach(agent)

    # Simulate tool calls
    agent.simulate_tool_call("run_python", {"code": "print('hello world')"})
    agent.simulate_tool_call("web_search", {"query": "Python asyncio tutorial"})
    agent.simulate_tool_call("write_file", {"path": "/tmp/out.txt", "content": "data"})

    # Simulate a message with PII
    agent.simulate_tool_call("send_email", {
        "to": "alice@example.com",
        "body": "Call me at 555-123-4567, my SSN is 123-45-6789",
    })

    # Check the audit trail
    print(f"Total audit entries: {len(guard.audit_trail)}")
    print()

    for entry in guard.audit_trail:
        pii_count = len(entry.pii_detected)
        print(
            f"  [{entry.teec.decision_id[:8]}...] "
            f"tool={entry.tool_name or 'message':<14} "
            f"action={entry.action:<6} "
            f"cost=${entry.cost_tracked:.6f} "
            f"PII={pii_count} "
            f"time={entry.evaluation_time_ms:.2f}ms"
        )

    # Budget state (tracked even without explicit limits)
    budget = guard.get_budget_state("code_executor")
    print(f"\n  Cumulative cost for 'code_executor': ${budget.current_spend:.6f}")

    # ── Option B: Use TealTigerAuditAgent convenience class ───────────────
    print("\n\n--- Option B: TealTigerAuditAgent (zero-config) ---\n")

    audit_agent = TealTigerAuditAgent(name="researcher")

    # Simulate some tool calls through the audit agent
    messages_with_tools = [{
        "role": "assistant",
        "content": None,
        "tool_calls": [{
            "id": "call_1",
            "type": "function",
            "function": {
                "name": "web_search",
                "arguments": {"query": "latest AI papers 2026"},
            },
        }],
    }]

    # Trigger the reply hook directly (simulating AG2's internal flow)
    for entry in audit_agent._reply_funcs:
        entry["reply_func"](
            recipient=audit_agent,
            messages=messages_with_tools,
            sender=audit_agent,
            config=None,
        )

    messages_with_tools_2 = [{
        "role": "assistant",
        "content": None,
        "tool_calls": [{
            "id": "call_2",
            "type": "function",
            "function": {
                "name": "web_search",
                "arguments": {"query": "TealTiger governance framework"},
            },
        }],
    }]
    for entry in audit_agent._reply_funcs:
        entry["reply_func"](
            recipient=audit_agent,
            messages=messages_with_tools_2,
            sender=audit_agent,
            config=None,
        )

    # Access the summary
    summary = audit_agent.summary
    print(f"  Total calls: {summary['total_calls']}")
    print(f"  Total cost:  ${summary['total_cost']:.6f}")
    print(f"  Tools used:")
    for tool, stats in summary["tools"].items():
        print(f"    {tool}: {stats['calls']} calls, ${stats['cost']:.6f}")

    print(f"\n  Audit trail length: {len(audit_agent.audit_trail)}")
    print(f"  All decisions: {set(e.action for e in audit_agent.audit_trail)}")
    print(f"  Reason codes:  {audit_agent.audit_trail[0].reason_codes}")

    # ── Key takeaways ─────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  Key points:")
    print("  • No engine needed — just TealTigerGuard() and attach()")
    print("  • All tool calls pass through (ALLOW + OBSERVE_PASSTHROUGH)")
    print("  • Cost, PII, and tool usage tracked automatically")
    print("  • Structured audit trail with TEEC correlation IDs")
    print("  • Sub-5ms overhead per evaluation")
    print("=" * 65)


if __name__ == "__main__":
    main()
