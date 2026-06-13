"""GovernedGroupChat — GroupChat extension with governance-enforced speaker selection.

Wraps AG2's GroupChat to apply governance policies to speaker selection.
Frozen agents, over-budget agents, and policy-denied agents are skipped
during speaker selection without disrupting the conversation flow.

Each selection round is recorded in a SpeakerSelectionAuditEntry for
full auditability of who was considered, what decision was made for each
candidate, and who was ultimately selected.

Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 15.1, 15.3, 18.6
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from ag2_tealtiger.types import (
    GovernanceAction,
    SpeakerSelectionAuditEntry,
)


class GovernedGroupChat:
    """GroupChat with governance-enforced speaker selection.

    Wraps the standard speaker selection strategy to evaluate
    candidates against TealEngine policies before granting turns.

    Speaker selection proceeds through candidates in order:
    1. Frozen agents are skipped without TealEngine invocation (AGENT_FROZEN)
    2. Over-budget agents are skipped without TealEngine invocation (BUDGET_EXCEEDED)
    3. Remaining candidates are evaluated via TealEngine:
       - ALLOW: agent is selected as speaker
       - DENY: agent is skipped
       - REFER: agent action is suspended, continue with others
    4. If no candidate is eligible, the round terminates with ALL_SPEAKERS_DENIED

    Each selection round produces a SpeakerSelectionAuditEntry recording
    the full evaluation trace.
    """

    def __init__(
        self,
        agents: list[Any] | None = None,
        guard: Any | None = None,
        messages: list[dict[str, Any]] | None = None,
        max_round: int = 10,
        speaker_selection_method: str = "auto",
        group_chat_id: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Initialize GovernedGroupChat.

        Args:
            agents: List of ConversableAgent instances participating in the group.
            guard: TealTigerGuard instance for governance evaluation.
            messages: Initial messages for the group chat.
            max_round: Maximum number of conversation rounds.
            speaker_selection_method: AG2 speaker selection strategy (auto, round_robin, etc.)
            group_chat_id: Optional explicit group chat ID. Auto-generated if not provided.
            **kwargs: Additional kwargs passed to parent GroupChat.
        """
        self.agents = agents or []
        self.guard = guard
        self.messages = messages or []
        self.max_round = max_round
        self.speaker_selection_method = speaker_selection_method
        self.group_chat_id = group_chat_id or str(uuid.uuid4())
        self._speaker_selection_audit: list[SpeakerSelectionAuditEntry] = []
        self._kwargs = kwargs

    @property
    def speaker_selection_audit(self) -> list[SpeakerSelectionAuditEntry]:
        """Return the ordered list of speaker selection audit entries.

        Each entry records one selection round including:
        - All candidates evaluated with their decisions
        - The final selected speaker (or None if all denied)
        - Reason codes summarizing the round outcome

        Returns:
            Ordered list of SpeakerSelectionAuditEntry objects.

        Requirements: 3.4
        """
        return list(self._speaker_selection_audit)

    def select_speaker(
        self,
        last_speaker: Any = None,
        selector: Any = None,
    ) -> Any | None:
        """Select the next speaker with governance evaluation.

        Evaluates each candidate agent against governance policies:
        1. Skip frozen agents (AGENT_FROZEN) - no TealEngine call
        2. Skip over-budget agents (BUDGET_EXCEEDED) - no TealEngine call
        3. Evaluate via TealEngine for remaining candidates
        4. Select first ALLOW candidate
        5. Terminate with ALL_SPEAKERS_DENIED if none eligible

        Records a SpeakerSelectionAuditEntry for each round.

        Args:
            last_speaker: The agent who spoke last (used for round-robin, etc.)
            selector: The agent performing the selection (GroupChatManager).

        Returns:
            The selected ConversableAgent, or None if all candidates denied.

        Requirements: 3.1, 3.2, 3.3, 3.5, 15.1, 15.3, 18.6
        """
        round_id = str(uuid.uuid4())
        timestamp_ms = time.time() * 1000
        candidates_evaluated: list[dict[str, Any]] = []
        selected_speaker: str | None = None
        selected_agent: Any | None = None
        round_reason_codes: list[str] = []

        # Get candidate ordering (exclude last_speaker if applicable)
        candidates = self._get_candidates(last_speaker)

        for agent in candidates:
            agent_id = self._get_agent_id(agent)

            # Step 1: Check frozen state — skip without TealEngine call
            if self.guard and self.guard.is_frozen(agent_id):
                candidates_evaluated.append({
                    "agent_id": agent_id,
                    "decision": GovernanceAction.DENY.value,
                    "reason": "AGENT_FROZEN",
                })
                if "AGENT_FROZEN" not in round_reason_codes:
                    round_reason_codes.append("AGENT_FROZEN")
                continue

            # Step 2: Check budget state — skip without TealEngine call
            if self.guard and self._is_over_budget(agent_id):
                candidates_evaluated.append({
                    "agent_id": agent_id,
                    "decision": GovernanceAction.DENY.value,
                    "reason": "BUDGET_EXCEEDED",
                })
                if "BUDGET_EXCEEDED" not in round_reason_codes:
                    round_reason_codes.append("BUDGET_EXCEEDED")
                continue

            # Step 3: Evaluate via TealEngine (if available and in policy mode)
            if self.guard and self._has_engine():
                decision = self._evaluate_candidate(agent_id)
                action = decision.get("action", GovernanceAction.ALLOW.value)
                reason = decision.get("reason", "")
                reason_codes = decision.get("reason_codes", [])

                if action == GovernanceAction.ALLOW.value:
                    candidates_evaluated.append({
                        "agent_id": agent_id,
                        "decision": GovernanceAction.ALLOW.value,
                        "reason": reason or "SPEAKER_ALLOWED",
                    })
                    selected_speaker = agent_id
                    selected_agent = agent
                    break

                elif action == GovernanceAction.DENY.value:
                    deny_reason = reason_codes[0] if reason_codes else "POLICY_DENIED"
                    candidates_evaluated.append({
                        "agent_id": agent_id,
                        "decision": GovernanceAction.DENY.value,
                        "reason": deny_reason,
                    })
                    if "POLICY_DENIED" not in round_reason_codes:
                        round_reason_codes.append("POLICY_DENIED")
                    continue

                elif action == GovernanceAction.REFER.value:
                    candidates_evaluated.append({
                        "agent_id": agent_id,
                        "decision": GovernanceAction.REFER.value,
                        "reason": reason or "REQUIRES_REVIEW",
                    })
                    if "REFER_SUSPENDED" not in round_reason_codes:
                        round_reason_codes.append("REFER_SUSPENDED")
                    continue

                else:
                    # Unknown action — treat as deny for safety
                    candidates_evaluated.append({
                        "agent_id": agent_id,
                        "decision": GovernanceAction.DENY.value,
                        "reason": f"UNKNOWN_ACTION_{action}",
                    })
                    continue
            else:
                # No engine / observe mode — allow the candidate
                candidates_evaluated.append({
                    "agent_id": agent_id,
                    "decision": GovernanceAction.ALLOW.value,
                    "reason": "NO_ENGINE_PASSTHROUGH",
                })
                selected_speaker = agent_id
                selected_agent = agent
                break

        # If no speaker selected, all candidates were denied
        if selected_speaker is None:
            if "ALL_SPEAKERS_DENIED" not in round_reason_codes:
                round_reason_codes.append("ALL_SPEAKERS_DENIED")

        # Record the speaker selection audit entry
        audit_entry = SpeakerSelectionAuditEntry(
            round_id=round_id,
            timestamp_ms=timestamp_ms,
            candidates_evaluated=candidates_evaluated,
            selected_speaker=selected_speaker,
            reason_codes=round_reason_codes,
            group_chat_id=self.group_chat_id,
        )
        self._speaker_selection_audit.append(audit_entry)

        return selected_agent

    def _get_candidates(self, last_speaker: Any = None) -> list[Any]:
        """Get the candidate agents for speaker selection.

        Filters based on the speaker_selection_method. For simplicity,
        returns all agents except the last speaker when in round_robin
        or auto mode.

        Args:
            last_speaker: The agent who spoke last.

        Returns:
            Ordered list of candidate agents.
        """
        if last_speaker is None:
            return list(self.agents)

        # Exclude last speaker from candidates (standard GroupChat behavior)
        last_id = self._get_agent_id(last_speaker)
        return [a for a in self.agents if self._get_agent_id(a) != last_id]

    def _get_agent_id(self, agent: Any) -> str:
        """Extract agent identity string from an agent object.

        Supports both AG2 ConversableAgent (has .name) and
        mock agents used in testing.

        Args:
            agent: Agent object with a name attribute or string identity.

        Returns:
            Agent identity string.
        """
        if hasattr(agent, "name"):
            return agent.name
        return str(agent)

    def _has_engine(self) -> bool:
        """Check if the guard has a TealEngine configured.

        Returns:
            True if the guard has an engine (policy mode), False otherwise.
        """
        if self.guard is None:
            return False
        return getattr(self.guard, "engine", None) is not None

    def _is_over_budget(self, agent_id: str) -> bool:
        """Check if an agent has exceeded its budget limit.

        Args:
            agent_id: The agent identity to check.

        Returns:
            True if the agent's cumulative cost exceeds its budget limit.
        """
        if self.guard is None:
            return False
        budget_state = self.guard.get_budget_state(agent_id)
        if budget_state.budget_limit is None:
            return False
        return budget_state.current_spend >= budget_state.budget_limit

    def _evaluate_candidate(self, agent_id: str) -> dict[str, Any]:
        """Evaluate a candidate speaker against TealEngine policies.

        Calls the guard's engine to evaluate whether this agent is
        permitted to speak next.

        Args:
            agent_id: The candidate agent identity.

        Returns:
            Decision dict with action, reason, reason_codes, risk_score.
        """
        if self.guard is None or not self._has_engine():
            return {"action": GovernanceAction.ALLOW.value, "reason": "no_engine"}

        engine = getattr(self.guard, "engine", None)
        if engine is None:
            return {"action": GovernanceAction.ALLOW.value, "reason": "no_engine"}

        try:
            result = engine.evaluate(
                tool_name=None,
                args=None,
                context={
                    "agent_id": agent_id,
                    "action_kind": "speaker_selection",
                    "group_chat_id": self.group_chat_id,
                    "framework": "ag2",
                },
            )
            return result
        except Exception:
            # On engine error, apply guard's fail behavior
            from ag2_tealtiger.types import GovernanceMode

            mode = getattr(self.guard, "mode", GovernanceMode.OBSERVE)
            if mode == GovernanceMode.ENFORCE:
                # Fail-closed in ENFORCE mode
                return {
                    "action": GovernanceAction.DENY.value,
                    "reason": "Engine error during speaker evaluation",
                    "reason_codes": ["ENGINE_ERROR", "FAIL_CLOSED"],
                    "risk_score": 100,
                }
            else:
                # Fail-open in MONITOR/OBSERVE mode
                return {
                    "action": GovernanceAction.ALLOW.value,
                    "reason": "Engine error, failing open",
                    "reason_codes": ["ENGINE_ERROR", "FAIL_OPEN"],
                    "risk_score": 0,
                }
