"""Example: GovernedGroupChat with Speaker Selection.

Demonstrates how GovernedGroupChat applies governance policies to speaker
selection in multi-agent conversations. In a governed group chat:
- Frozen agents are skipped without invoking TealEngine
- Over-budget agents are skipped without invoking TealEngine
- Remaining candidates are evaluated via TealEngine before getting a turn
- If all speakers are denied, the round terminates with ALL_SPEAKERS_DENIED
- REFER decisions suspend an agent while others continue

This is the pattern for multi-agent orchestration with governance guardrails.

Requirements:
    pip install ag2-tealtiger

Usage:
    python governed_groupchat.py
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

    def __repr__(self) -> str:
        return f"Agent({self.name})"


class MockTealEngine:
    """Mock TealEngine with per-agent speaker selection policies.

    Simulates governance evaluation for speaker candidacy. In production,
    replace with a real TealEngine and configure policies that determine
    which agents can speak based on role, context, or risk level.

        from tealtiger import TealEngine
        engine = TealEngine(policies=[speaker_policy, role_policy, ...])
    """

    def __init__(self, denied_speakers: list[str] | None = None):
        """
        Args:
            denied_speakers: List of agent names that should be denied
                when evaluated for speaker candidacy.
        """
        self.denied_speakers = denied_speakers or []
        self.evaluation_count = 0

    def evaluate(
        self,
        tool_name: str = "",
        tool_args: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Evaluate a speaker candidacy or tool call."""
        self.evaluation_count += 1
        agent_id = (context or {}).get("agent_id", "")

        if agent_id in self.denied_speakers:
            return {
                "action": "DENY",
                "reason": f"Agent '{agent_id}' not authorized to speak in this round",
                "reason_codes": ["SPEAKER_DENIED", "ROLE_RESTRICTION"],
                "risk_score": 60,
            }

        return {
            "action": "ALLOW",
            "reason": "Agent authorized for this conversation round",
            "reason_codes": ["SPEAKER_ALLOWED"],
            "risk_score": 0,
        }


# ─── Example: GovernedGroupChat Speaker Selection ────────────────────────────


def main() -> None:
    """Demonstrate GovernedGroupChat with governance-enforced speaker selection."""
    from ag2_tealtiger import TealTigerGuard, GovernedGroupChat, GovernanceMode

    print("=" * 65)
    print("  ag2-tealtiger: GovernedGroupChat Speaker Selection")
    print("=" * 65)

    # ── Setup: Create agents for a coding team ────────────────────────────
    planner = MockConversableAgent(name="planner")
    coder = MockConversableAgent(name="coder")
    reviewer = MockConversableAgent(name="reviewer")
    executor = MockConversableAgent(name="executor")

    # Create engine that denies the executor from speaking (role restriction)
    engine = MockTealEngine(denied_speakers=["executor"])

    # Create guard in ENFORCE mode
    guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)

    # Attach guard to all agents (for tool call governance)
    for agent in [planner, coder, reviewer, executor]:
        guard.attach(agent)

    # Create the governed group chat
    group_chat = GovernedGroupChat(
        agents=[planner, coder, reviewer, executor],
        guard=guard,
        max_round=10,
        speaker_selection_method="round_robin",
    )

    # ── Scenario 1: Normal speaker selection with policy filtering ────────
    print("\n--- Scenario 1: Policy-based speaker selection ---\n")

    selected = group_chat.select_speaker(last_speaker=planner)
    print(f"  After planner spoke → selected: {selected}")
    print(f"  (executor is denied by policy, so it gets skipped)")

    selected = group_chat.select_speaker(last_speaker=coder)
    print(f"  After coder spoke   → selected: {selected}")

    # ── Scenario 2: Frozen agent is skipped without engine call ───────────
    print("\n--- Scenario 2: Frozen agent skipped ---\n")

    guard.freeze("coder")
    print(f"  Froze 'coder' — is_frozen: {guard.is_frozen('coder')}")

    # Engine should NOT be called for frozen agents
    engine.evaluation_count = 0
    selected = group_chat.select_speaker(last_speaker=planner)
    print(f"  Selected speaker: {selected}")
    print(f"  Engine evaluations: {engine.evaluation_count} (frozen agent skipped)")

    guard.unfreeze("coder")
    print(f"  Unfroze 'coder'")

    # ── Scenario 3: Over-budget agent is skipped ──────────────────────────
    print("\n--- Scenario 3: Over-budget agent skipped ---\n")

    # Set a low budget for reviewer and exceed it
    guard.set_budget("reviewer", limit=0.0001)
    # Simulate cost accumulation to exceed budget
    guard._budget_manager.track_cost("reviewer", 0.001)

    engine.evaluation_count = 0
    selected = group_chat.select_speaker(last_speaker=planner)
    print(f"  Selected speaker: {selected}")
    print(f"  (reviewer over budget, executor denied by policy)")

    # Check the speaker selection audit
    audit = group_chat.speaker_selection_audit
    latest = audit[-1] if audit else None
    if latest:
        print(f"\n  Speaker selection audit (last round):")
        for candidate in latest.candidates_evaluated:
            print(
                f"    {candidate['agent_id']:<10} → "
                f"{candidate['decision']:<6} "
                f"reason={candidate.get('reason', 'N/A')}"
            )

    # ── Scenario 4: All speakers denied → round terminates ───────────────
    print("\n--- Scenario 4: All speakers denied ---\n")

    # Freeze everyone except executor (who is policy-denied)
    guard.freeze("planner")
    guard.freeze("coder")
    # reviewer is already over budget

    selected = group_chat.select_speaker(last_speaker=planner)
    print(f"  Selected speaker: {selected}")
    print(f"  (All agents either frozen, over-budget, or policy-denied)")

    # Check the termination audit entry
    audit = group_chat.speaker_selection_audit
    latest = audit[-1] if audit else None
    if latest:
        print(f"  Reason codes: {latest.reason_codes}")

    # Clean up freezes
    guard.unfreeze("planner")
    guard.unfreeze("coder")
    guard.reset_budget("reviewer")

    # ── Scenario 5: Full audit trail across selection rounds ──────────────
    print("\n--- Speaker Selection Audit Trail ---\n")

    all_audits = group_chat.speaker_selection_audit
    print(f"  Total selection rounds: {len(all_audits)}")
    for i, entry in enumerate(all_audits, 1):
        print(
            f"  Round {i}: selected={entry.selected_speaker or 'NONE':<10} "
            f"candidates={len(entry.candidates_evaluated)} "
            f"codes={entry.reason_codes}"
        )

    # ── Key takeaways ─────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  Key points:")
    print("  • GovernedGroupChat evaluates speakers against policies")
    print("  • Frozen/over-budget agents skipped without engine calls")
    print("  • Policy-denied agents skipped, next candidate evaluated")
    print("  • ALL_SPEAKERS_DENIED terminates the round safely")
    print("  • Full speaker selection audit trail per round")
    print("  • Per-agent governance isolation in multi-agent groups")
    print("=" * 65)


if __name__ == "__main__":
    main()
