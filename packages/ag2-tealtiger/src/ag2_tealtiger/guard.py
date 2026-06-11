"""TealTigerGuard — core register_reply interceptor for AG2.

Deterministic governance interceptor for AG2 ConversableAgent.
Attaches via AG2's register_reply mechanism to intercept tool calls
and inter-agent messages before execution.

Supports three operating modes:
- OBSERVE: Zero-config tracking (cost, PII, tool usage) with no policy evaluation
- MONITOR: Policy evaluation with logging only (fail-open)
- ENFORCE: Policy evaluation with blocking (fail-closed)

Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.4, 4.5, 4.6, 7.1, 7.2, 7.5, 7.6, 14.3, 15.1, 15.2, 15.8
"""

from __future__ import annotations

import dataclasses
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from ag2_tealtiger.budget_manager import BudgetStateManager
from ag2_tealtiger.decision_manager import DecisionReceiptManager
from ag2_tealtiger.pii import detect_pii
from ag2_tealtiger.teec_builder import TEECContextBuilder
from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    BudgetState,
    DenialMessage,
    EscalationReceipt,
    GovernanceAction,
    GovernanceMode,
    TEECContext,
)

logger = logging.getLogger(__name__)


class TealTigerGuard:
    """Deterministic governance interceptor for AG2 ConversableAgent.

    Attaches via AG2's register_reply mechanism to intercept tool calls
    and inter-agent messages before execution.

    The guard evaluates governance policies in the configured mode:
    - OBSERVE: Track cost, PII, and tool usage without blocking
    - MONITOR: Evaluate policies, log decisions, but allow all through
    - ENFORCE: Evaluate policies and block denied actions

    Zero LLM in the governance path — all evaluation is deterministic,
    targeting sub-5ms latency with in-process evaluation.

    Usage:
        # Zero-config observe mode
        guard = TealTigerGuard()
        guard.attach(my_agent)

        # Policy enforcement
        guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
        guard.attach(agent_a)
        guard.attach(agent_b)

        # Detach when done
        guard.detach(agent_a)
    """

    def __init__(
        self,
        engine: Any | None = None,
        mode: GovernanceMode = GovernanceMode.OBSERVE,
        cost_per_1k_tokens: float = 0.002,
        default_expiry_seconds: int = 3600,
        fail_closed: bool = True,
    ) -> None:
        """Initialize the TealTigerGuard interceptor.

        Args:
            engine: Optional TealEngine instance for policy evaluation.
                If None, the guard operates in observe mode regardless
                of the mode parameter.
            mode: Governance operating mode (ENFORCE, MONITOR, or OBSERVE).
                Defaults to OBSERVE for zero-config usage.
            cost_per_1k_tokens: Cost rate used for token-based cost estimation
                in observe mode. Defaults to $0.002 per 1K tokens.
            default_expiry_seconds: Default expiry duration in seconds for
                decision receipts when not specified by policy. Defaults to 3600 (1 hour).
            fail_closed: Whether to deny on engine errors in ENFORCE mode.
                If True (default), engine exceptions result in DENY.
                If False, engine exceptions result in ALLOW.
        """
        self.engine = engine
        self.mode = mode
        self.cost_per_1k_tokens = cost_per_1k_tokens
        self.default_expiry_seconds = default_expiry_seconds
        self.fail_closed = fail_closed

        # ── Internal State ────────────────────────────────────────────────
        # Per-agent frozen state (kill switch)
        self._frozen_agents: set[str] = set()

        # Ordered audit entries for all governance evaluations
        self._audit_trail: list[AuditEntry] = []

        # Per-agent budget tracking
        self._budget_manager: BudgetStateManager = BudgetStateManager()

        # Decision receipt lifecycle management
        self._decision_manager: DecisionReceiptManager = DecisionReceiptManager(
            default_expiry_seconds=default_expiry_seconds,
        )

        # TEEC context builder for correlation and telemetry
        self._teec_builder: TEECContextBuilder = TEECContextBuilder()

        # Monotonically increasing turn counter for _reply_hook invocations
        self._turn_counter: int = 0

        # Track which agents are currently attached (agent_name -> agent reference)
        self._attached_agents: dict[str, Any] = {}

        # Decision outcome cache for retry idempotency
        # Maps decision_id -> outcome dict (action, reason_codes, risk_score, etc.)
        # Enables same decision_id retries to return prior outcome without re-evaluation
        self._decision_outcomes: dict[str, dict[str, Any]] = {}

    # ── Attach / Detach ───────────────────────────────────────────────────────

    def attach(self, agent: Any) -> None:
        """Attach governance to an agent via register_reply.

        Registers the interceptor reply function at the highest priority
        position (position=0) in the agent's reply pipeline. This ensures
        governance evaluation occurs before any other reply processing.

        The same guard can be attached to multiple agents — each maintains
        independent governance state per agent identity.

        Args:
            agent: An AG2 ConversableAgent instance to govern.
                Must have a `name` attribute and `register_reply` method.

        Raises:
            ValueError: If the agent is already attached to this guard.
        """
        agent_name: str = agent.name

        if agent_name in self._attached_agents:
            raise ValueError(
                f"Agent '{agent_name}' is already attached to this guard. "
                f"Call detach() first to re-attach."
            )

        # Register the reply hook at highest priority (position=0)
        agent.register_reply(
            trigger=None,
            reply_func=self._reply_hook,
            position=0,
        )

        # Track the attached agent
        self._attached_agents[agent_name] = agent

    def detach(self, agent: Any) -> None:
        """Remove governance from an agent.

        Removes the registered reply function from the agent's reply pipeline
        and clears the agent from the attached tracking dict.

        Args:
            agent: An AG2 ConversableAgent instance to detach.
                Must have a `name` attribute and `_reply_funcs` list.

        Raises:
            ValueError: If the agent is not currently attached to this guard.
        """
        agent_name: str = agent.name

        if agent_name not in self._attached_agents:
            raise ValueError(
                f"Agent '{agent_name}' is not attached to this guard."
            )

        # Remove the reply hook from the agent's reply function list
        # AG2 stores reply funcs in _reply_funcs as a list of dicts
        if hasattr(agent, "_reply_funcs"):
            agent._reply_funcs = [
                entry
                for entry in agent._reply_funcs
                if entry.get("reply_func") != self._reply_hook
            ]

        # Remove from tracking
        del self._attached_agents[agent_name]

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def audit_trail(self) -> list[AuditEntry]:
        """Return the ordered list of audit entries for all governed agents."""
        return self._audit_trail

    @property
    def attached_agents(self) -> dict[str, Any]:
        """Return the dict of currently attached agents (name -> reference)."""
        return dict(self._attached_agents)

    def export_audit_trail(self, path: str, format: str = "jsonl") -> int:
        """Export the audit trail to a file in the specified format.

        Writes each AuditEntry as one JSON line to the file (JSONL format).
        Handles nested dataclasses (TEECContext) via dataclasses.asdict.

        Args:
            path: File path to write the audit trail to.
            format: Export format. Currently only "jsonl" is supported.

        Returns:
            The number of entries written.

        Raises:
            ValueError: If an unsupported format is specified.

        Requirements: 12.1, 12.3, 12.4, 12.5, 13.5
        """
        if format != "jsonl":
            raise ValueError(f"Unsupported export format: {format!r}. Only 'jsonl' is supported.")

        entries_written = 0
        with open(path, "w", encoding="utf-8") as f:
            for entry in self._audit_trail:
                entry_dict = dataclasses.asdict(entry)
                line = json.dumps(entry_dict, ensure_ascii=False, default=str)
                f.write(line + "\n")
                entries_written += 1

        return entries_written

    # ── Per-Agent Kill Switch ─────────────────────────────────────────────────

    def freeze(self, agent_id: str) -> None:
        """Freeze an agent — block all subsequent tool calls and message sends.

        A frozen agent receives DENY with reason_code "AGENT_FROZEN" and
        risk_score 100 regardless of governance mode. Freeze is mode-independent:
        it always blocks even in OBSERVE or MONITOR mode.

        Records a freeze event in the audit trail with a timestamp.

        Args:
            agent_id: The identity of the agent to freeze.

        Requirements: 4.1, 4.6
        """
        start_time = time.time()
        self._frozen_agents.add(agent_id)
        evaluation_time_ms = (time.time() - start_time) * 1000

        # Record freeze event in audit trail
        correlation_id = str(uuid.uuid4())
        decision_id = str(uuid.uuid4())
        timestamp_ms = time.time() * 1000

        teec = TEECContext(
            namespace="teec.ag2",
            conversation_id=self._teec_builder.conversation_id,
            turn_id=self._teec_builder.current_turn_id,
            agent_role=agent_id,
            decision_id=decision_id,
            decision_source="default_mode",
        )

        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=decision_id,
            timestamp_ms=timestamp_ms,
            action=GovernanceAction.DENY.value,
            action_kind=ActionKind.FREEZE.value,
            mode=self.mode.value,
            agent_id=agent_id,
            reason=f"Agent '{agent_id}' frozen",
            reason_codes=["AGENT_FROZEN"],
            risk_score=100,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
        )
        self._audit_trail.append(entry)

    def unfreeze(self, agent_id: str) -> None:
        """Unfreeze a previously frozen agent — restore normal governance evaluation.

        After unfreezing, the agent's subsequent tool calls and messages will be
        evaluated against policies normally (not auto-denied).

        Records an unfreeze event in the audit trail with a timestamp.

        Args:
            agent_id: The identity of the agent to unfreeze.

        Requirements: 4.4, 4.6
        """
        start_time = time.time()
        self._frozen_agents.discard(agent_id)
        evaluation_time_ms = (time.time() - start_time) * 1000

        # Record unfreeze event in audit trail
        correlation_id = str(uuid.uuid4())
        decision_id = str(uuid.uuid4())
        timestamp_ms = time.time() * 1000

        teec = TEECContext(
            namespace="teec.ag2",
            conversation_id=self._teec_builder.conversation_id,
            turn_id=self._teec_builder.current_turn_id,
            agent_role=agent_id,
            decision_id=decision_id,
            decision_source="default_mode",
        )

        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=decision_id,
            timestamp_ms=timestamp_ms,
            action=GovernanceAction.ALLOW.value,
            action_kind=ActionKind.FREEZE.value,
            mode=self.mode.value,
            agent_id=agent_id,
            reason=f"Agent '{agent_id}' unfrozen",
            reason_codes=["AGENT_UNFROZEN"],
            risk_score=0,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
        )
        self._audit_trail.append(entry)

    def is_frozen(self, agent_id: str) -> bool:
        """Check whether an agent is currently frozen.

        Args:
            agent_id: The identity of the agent to check.

        Returns:
            True if the agent is frozen, False otherwise.
        """
        return agent_id in self._frozen_agents

    # ── Budget Management ─────────────────────────────────────────────────────

    def set_budget(self, agent_id: str, limit: float) -> None:
        """Set a budget limit for an agent.

        Delegates to the internal BudgetStateManager. When the agent's
        cumulative cost exceeds this limit, subsequent tool calls will be
        denied with reason_code "BUDGET_EXCEEDED" in ENFORCE mode.

        Args:
            agent_id: The identity of the agent.
            limit: The budget limit to set (must be > 0).

        Raises:
            ValueError: If limit is not positive.

        Requirements: 18.3, 18.7
        """
        self._budget_manager.set_limit(agent_id, limit)

    def get_budget_state(self, agent_id: str) -> BudgetState:
        """Get the current budget state for an agent.

        Returns per-agent budget state including current_spend, budget_limit,
        and remaining_budget through the audit trail and summary properties.

        Args:
            agent_id: The identity of the agent.

        Returns:
            BudgetState with current spend, limit, and remaining budget.

        Requirements: 18.4
        """
        return self._budget_manager.get_state(agent_id)

    def reset_budget(self, agent_id: str) -> None:
        """Reset an agent's budget spend to zero.

        Preserves the configured budget_limit but resets current_spend
        and warning state. Records the reset in the audit trail.

        Args:
            agent_id: The identity of the agent to reset.

        Requirements: 18.7, 18.8
        """
        self._budget_manager.reset(agent_id)

        # Record budget reset in audit trail
        correlation_id = str(uuid.uuid4())
        decision_id = str(uuid.uuid4())
        timestamp_ms = time.time() * 1000

        teec = TEECContext(
            namespace="teec.ag2",
            conversation_id=self._teec_builder.conversation_id,
            turn_id=self._teec_builder.current_turn_id,
            agent_role=agent_id,
            decision_id=decision_id,
            decision_source="default_mode",
        )

        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=decision_id,
            timestamp_ms=timestamp_ms,
            action=GovernanceAction.ALLOW.value,
            action_kind=ActionKind.BUDGET_CHANGE.value,
            mode=self.mode.value,
            agent_id=agent_id,
            reason=f"Budget reset for agent '{agent_id}'",
            reason_codes=["BUDGET_RESET"],
            risk_score=0,
            evaluation_time_ms=0.0,
            teec=teec,
        )
        self._audit_trail.append(entry)

    # ── Decision Resolution ───────────────────────────────────────────────────

    def resolve_refer(
        self, decision_id: str, resolution: str, approval_id: str
    ) -> dict[str, Any]:
        """Resolve a REFER escalation — resume or deny the suspended action.

        Looks up the decision receipt by decision_id, applies the resolution,
        and records an audit entry. Handles retry idempotency: if the same
        decision_id has already been resolved, returns the prior outcome
        without duplicating side effects.

        Args:
            decision_id: The decision_id of the REFER escalation to resolve.
            resolution: One of "ALLOW" or "DENY" indicating the reviewer's decision.
            approval_id: Identifier linking the reviewer's decision to the original.

        Returns:
            A dict with the resolution outcome:
            {
                "decision_id": str,
                "action": str,
                "approval_id": str,
                "reason_codes": list[str],
                "already_resolved": bool,
            }

        Raises:
            KeyError: If the decision_id is not found in the decision receipt store.
            ValueError: If the resolution is not "ALLOW" or "DENY".

        Requirements: 11.1, 11.5, 15.5, 15.6
        """
        # ── Retry idempotency: return prior outcome if already resolved ───
        # A REFER decision with pending status is NOT yet resolved, so we
        # allow the resolution to proceed. Only return early if the decision
        # was already resolved (action is ALLOW or DENY after resolution).
        if decision_id in self._decision_outcomes:
            prior = self._decision_outcomes[decision_id]
            if prior.get("action") != GovernanceAction.REFER.value:
                # Already resolved — return the prior resolution outcome
                return {**prior, "already_resolved": True}

        # ── Validate resolution ───────────────────────────────────────────
        resolution_upper = resolution.upper()
        if resolution_upper not in ("ALLOW", "DENY"):
            raise ValueError(
                f"Invalid resolution '{resolution}'. Must be 'ALLOW' or 'DENY'."
            )

        # ── Look up the decision receipt ──────────────────────────────────
        receipt = self._decision_manager.get_receipt(decision_id)
        if receipt is None:
            raise KeyError(f"Decision receipt not found: {decision_id}")

        # ── Apply resolution ──────────────────────────────────────────────
        start_time = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        timestamp_ms = time.time() * 1000

        teec = TEECContext(
            namespace="teec.ag2",
            conversation_id=self._teec_builder.conversation_id,
            turn_id=self._teec_builder.current_turn_id,
            decision_id=decision_id,
            decision_source="human_reviewer",
            approval_id=approval_id,
        )

        if resolution_upper == "ALLOW":
            # Mark receipt with approval_id, record audit entry
            receipt.approval_id = approval_id
            receipt.execution_outcome = "approved"
            receipt.is_expired = False

            action = GovernanceAction.ALLOW.value
            reason_codes = ["REFER_RESOLVED"]
            reason = f"REFER resolved: ALLOW by reviewer (approval_id={approval_id})"

        else:  # DENY
            # Expire the receipt with REFER_DENIED reason
            self._decision_manager.expire(decision_id, "REFER_DENIED")

            action = GovernanceAction.DENY.value
            reason_codes = ["REFER_DENIED"]
            reason = f"REFER resolved: DENY by reviewer (approval_id={approval_id})"

        evaluation_time_ms = (time.perf_counter() - start_time) * 1000

        # Record audit entry
        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=decision_id,
            timestamp_ms=timestamp_ms,
            action=action,
            action_kind=ActionKind.TOOL_CALL.value,
            mode=self.mode.value,
            agent_id="system",  # Resolution is a system-level action
            reason=reason,
            reason_codes=reason_codes,
            risk_score=0 if resolution_upper == "ALLOW" else 100,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
        )
        self._audit_trail.append(entry)

        # ── Store outcome for retry idempotency ───────────────────────────
        outcome: dict[str, Any] = {
            "decision_id": decision_id,
            "action": action,
            "approval_id": approval_id,
            "reason_codes": reason_codes,
            "already_resolved": False,
        }
        self._decision_outcomes[decision_id] = outcome

        return outcome

    def get_prior_outcome(self, decision_id: str) -> dict[str, Any] | None:
        """Look up a previously recorded decision outcome by decision_id.

        Used for retry idempotency — callers can check if a decision has
        already been evaluated and retrieve the prior result without
        triggering duplicate evaluation or side effects.

        Args:
            decision_id: The decision identifier to look up.

        Returns:
            The prior outcome dict if found, None otherwise.

        Requirements: 11.1, 11.5
        """
        return self._decision_outcomes.get(decision_id)

    # ── Internal: Reply Hook ──────────────────────────────────────────────────

    def _reply_hook(
        self,
        recipient: Any,
        messages: list[dict[str, Any]] | None,
        sender: Any,
        config: Any,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """AG2 reply hook — governance interception point.

        This method matches AG2's expected reply function signature:
            (recipient, messages, sender, config) -> (bool, reply_or_none)

        Flow:
        1. Start performance timer
        2. Increment turn_id
        3. Determine agent_id from recipient
        4. Check frozen state — if frozen, deny immediately (mode-independent)
        5. Extract tool calls from latest message
        6. Route to observe mode or policy mode based on engine presence
        7. Record AuditEntry and return governance decision

        Returns:
            A tuple of (should_terminate, reply_message):
            - (False, None): Let the agent continue to the next reply function
            - (True, message): Terminate with this reply (used for denials)

        Requirements covered: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
        """
        start_time = time.perf_counter()

        # Determine agent identity from recipient
        agent_id: str = getattr(recipient, "name", "unknown")

        # Increment turn_id for this invocation
        self._turn_counter += 1
        turn_id = self._turn_counter

        # Handle None/empty messages gracefully
        if not messages:
            return (False, None)

        # ── Frozen check (mode-independent kill switch) ───────────────────
        # Frozen agents are blocked for both tool calls and messages.
        # We also check if the sender is frozen (Req 4.5: originating agent identity).
        sender_id: str = getattr(sender, "name", "unknown")

        if self.is_frozen(agent_id):
            evaluation_time_ms = (time.perf_counter() - start_time) * 1000
            correlation_id = str(uuid.uuid4())

            # Determine action_kind based on message content
            last_msg = messages[-1] if messages else {}
            has_tool_calls = bool(last_msg.get("tool_calls"))
            frozen_action_kind = (
                ActionKind.TOOL_CALL.value if has_tool_calls else ActionKind.MESSAGE.value
            )

            teec = self._teec_builder.build(
                agent_id=agent_id,
                turn_id=turn_id,
            )

            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.DENY.value,
                action_kind=frozen_action_kind,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=f"Agent '{agent_id}' is frozen",
                reason_codes=["AGENT_FROZEN"],
                risk_score=100,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
            )
            self._audit_trail.append(entry)

            # Frozen always blocks regardless of mode
            return (True, f"[GOVERNANCE DENIAL] Agent '{agent_id}' is frozen. All actions blocked.")

        # Check if sender is frozen (Req 4.5, 17.4: frozen agent sending through another)
        if self.is_frozen(sender_id):
            evaluation_time_ms = (time.perf_counter() - start_time) * 1000
            correlation_id = str(uuid.uuid4())

            teec = self._teec_builder.build(
                agent_id=sender_id,
                turn_id=turn_id,
            )

            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.DENY.value,
                action_kind=ActionKind.MESSAGE.value,
                mode=self.mode.value,
                agent_id=sender_id,
                reason=f"Sender '{sender_id}' is frozen",
                reason_codes=["AGENT_FROZEN"],
                risk_score=100,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
            )
            self._audit_trail.append(entry)

            # Frozen sender always blocks regardless of mode
            return (True, f"[GOVERNANCE DENIAL] Sender '{sender_id}' is frozen. Message blocked.")

        # ── Budget check (after freeze, before engine evaluation) ─────────
        budget_result = self._budget_manager.check_budget(agent_id)
        if budget_result.exceeded:
            if self.mode == GovernanceMode.ENFORCE:
                # Deny with BUDGET_EXCEEDED in ENFORCE mode
                evaluation_time_ms = (time.perf_counter() - start_time) * 1000
                correlation_id = str(uuid.uuid4())

                teec = self._teec_builder.build(
                    agent_id=agent_id,
                    turn_id=turn_id,
                )

                budget_state = self._budget_manager.get_state(agent_id)
                entry = AuditEntry(
                    correlation_id=correlation_id,
                    decision_id=teec.decision_id,
                    timestamp_ms=time.time() * 1000,
                    action=GovernanceAction.DENY.value,
                    action_kind=ActionKind.TOOL_CALL.value,
                    mode=self.mode.value,
                    agent_id=agent_id,
                    reason=f"Agent '{agent_id}' budget exceeded (spent: {budget_state.current_spend:.4f}, limit: {budget_state.budget_limit})",
                    reason_codes=["BUDGET_EXCEEDED"],
                    risk_score=80,
                    evaluation_time_ms=evaluation_time_ms,
                    teec=teec,
                    cumulative_cost=budget_state.current_spend,
                )
                self._audit_trail.append(entry)

                denial = DenialMessage(
                    tool_name="unknown",
                    action=GovernanceAction.DENY.value,
                    reason=f"Budget exceeded for agent '{agent_id}'",
                    risk_score=80,
                    reason_codes=["BUDGET_EXCEEDED"],
                    correlation_id=correlation_id,
                    decision_id=teec.decision_id,
                )
                return (True, denial.to_reply_string())
            else:
                # MONITOR / OBSERVE: log warning but allow through
                logger.warning(
                    "BUDGET_EXCEEDED for agent '%s' (mode=%s) — allowing through",
                    agent_id,
                    self.mode.value,
                )

        # ── Extract tool calls from latest message ────────────────────────
        last_message = messages[-1]
        tool_calls = last_message.get("tool_calls", [])

        # ── Observe mode (no engine) ─────────────────────────────────────
        if self.engine is None:
            return self._observe_mode(
                agent_id=agent_id,
                turn_id=turn_id,
                last_message=last_message,
                tool_calls=tool_calls,
                start_time=start_time,
                sender=sender,
                recipient=recipient,
            )

        # ── Policy mode (engine present) ────────────────────────────────
        return self._policy_mode(
            agent_id=agent_id,
            turn_id=turn_id,
            last_message=last_message,
            tool_calls=tool_calls,
            start_time=start_time,
            sender=sender,
            recipient=recipient,
        )

    # ── Observe Mode Logic ────────────────────────────────────────────────────

    def _observe_mode(
        self,
        agent_id: str,
        turn_id: int,
        last_message: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        start_time: float,
        sender: Any = None,
        recipient: Any = None,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Handle observe mode — track cost, PII, tools without blocking.

        In observe mode (no TealEngine configured):
        - Estimate cost from token usage / text length heuristics
        - Detect PII in tool call arguments
        - Record tool names, call counts, and argument summaries
        - Produce AuditEntry with action=ALLOW and reason_codes=["OBSERVE_PASSTHROUGH"]
        - Differentiate action_kind between "tool_call" and "message"
        - Never block: always return (False, None)

        Requirements covered: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 17.2, 17.7
        """
        # ── Cost estimation ───────────────────────────────────────────────
        # Heuristic: chars / 4 = approx tokens, then * cost_per_1k / 1000
        text_content = last_message.get("content") or ""
        total_chars = len(text_content)

        # Include tool call arguments in the cost estimation
        for tc in tool_calls:
            func_info = tc.get("function", {})
            args = func_info.get("arguments", {})
            if isinstance(args, str):
                total_chars += len(args)
            elif isinstance(args, dict):
                total_chars += len(json.dumps(args))

        estimated_tokens = total_chars / 4.0
        cost = (estimated_tokens * self.cost_per_1k_tokens) / 1000.0

        # Track cost for this agent
        self._budget_manager.track_cost(agent_id, cost)
        budget_state = self._budget_manager.get_state(agent_id)

        # ── PII detection in tool call arguments ──────────────────────────
        pii_findings: list[dict[str, Any]] = []
        for tc in tool_calls:
            func_info = tc.get("function", {})
            args = func_info.get("arguments", {})
            if isinstance(args, str):
                # Try to parse JSON string arguments
                try:
                    parsed_args = json.loads(args)
                    pii_findings.extend(detect_pii(parsed_args))
                except (ValueError, TypeError):
                    pii_findings.extend(detect_pii(args))
            elif isinstance(args, dict):
                pii_findings.extend(detect_pii(args))

        # ── Record tool names and argument summaries ──────────────────────
        tool_name: str | None = None
        tool_args_summary: dict[str, Any] | None = None

        if tool_calls:
            # Record the first tool call (primary tool)
            first_tc = tool_calls[0]
            func_info = first_tc.get("function", {})
            tool_name = func_info.get("name")
            raw_args = func_info.get("arguments", {})

            # Build argument summary (keys and types, not full values)
            if isinstance(raw_args, str):
                try:
                    parsed = json.loads(raw_args)
                    if isinstance(parsed, dict):
                        tool_args_summary = {
                            k: type(v).__name__ for k, v in parsed.items()
                        }
                    else:
                        tool_args_summary = {"_raw": type(parsed).__name__}
                except (ValueError, TypeError):
                    tool_args_summary = {"_raw": "str"}
            elif isinstance(raw_args, dict):
                tool_args_summary = {
                    k: type(v).__name__ for k, v in raw_args.items()
                }

        # ── Build TEEC context ────────────────────────────────────────────
        # Resolve tool_args for params_hash computation
        resolved_tool_args: dict[str, Any] | None = None
        if tool_calls:
            first_tc = tool_calls[0]
            func_info = first_tc.get("function", {})
            raw_args = func_info.get("arguments", {})
            if isinstance(raw_args, str):
                try:
                    resolved_tool_args = json.loads(raw_args)
                    if not isinstance(resolved_tool_args, dict):
                        resolved_tool_args = None
                except (ValueError, TypeError):
                    resolved_tool_args = None
            elif isinstance(raw_args, dict):
                resolved_tool_args = raw_args

        teec = self._teec_builder.build(
            agent_id=agent_id,
            turn_id=turn_id,
            tool_name=tool_name,
            tool_args=resolved_tool_args,
        )

        # ── Produce AuditEntry ────────────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        correlation_id = str(uuid.uuid4())

        # Determine action_kind: "tool_call" if tool_calls present, "message" otherwise
        action_kind = (
            ActionKind.TOOL_CALL.value if tool_calls else ActionKind.MESSAGE.value
        )

        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=teec.decision_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.ALLOW.value,
            action_kind=action_kind,
            mode=GovernanceMode.OBSERVE.value,
            agent_id=agent_id,
            reason="Observe mode — passthrough",
            reason_codes=["OBSERVE_PASSTHROUGH"],
            risk_score=0,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            tool_name=tool_name,
            tool_args_summary=tool_args_summary,
            pii_detected=pii_findings,
            cost_tracked=cost,
            cumulative_cost=budget_state.current_spend,
        )
        self._audit_trail.append(entry)

        # ── Always allow in observe mode ──────────────────────────────────
        return (False, None)

    # ── Inter-Agent Message Governance ────────────────────────────────────────

    def _message_governance(
        self,
        agent_id: str,
        turn_id: int,
        last_message: dict[str, Any],
        sender: Any,
        recipient: Any,
        start_time: float,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Evaluate inter-agent message sends against TealEngine policies.

        When the latest message contains no tool_calls (plain text), this method
        evaluates the message content as a governed action_kind="message".

        The engine receives:
        - tool_name=None
        - args={"content": message_content, "sender": sender_name, "recipient": recipient_name}
        - context with action_kind="message"

        Each message governance decision gets its own independent decision_id,
        separate from any tool governance decisions in the same turn.

        Requirements covered: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
        """
        sender_name: str = getattr(sender, "name", "unknown") if sender else "unknown"
        recipient_name: str = getattr(recipient, "name", "unknown") if recipient else "unknown"
        message_content: str = last_message.get("content") or ""

        # ── Build TEEC context with independent decision_id ───────────────
        teec = self._teec_builder.build(
            agent_id=agent_id,
            turn_id=turn_id,
        )

        # ── Build framework context for TealEngine ────────────────────────
        budget_state = self._budget_manager.get_state(agent_id)
        framework_context: dict[str, Any] = {
            "framework": "ag2",
            "agent_id": agent_id,
            "conversation_id": teec.conversation_id,
            "cumulative_cost": budget_state.current_spend,
            "action_kind": ActionKind.MESSAGE.value,
        }

        # ── Build message args for TealEngine evaluation ──────────────────
        message_args: dict[str, Any] = {
            "content": message_content,
            "sender": sender_name,
            "recipient": recipient_name,
        }

        # ── Call TealEngine.evaluate() with error handling ─────────────────
        try:
            decision = self.engine.evaluate(
                tool_name=None,
                args=message_args,
                context=framework_context,
            )
        except Exception as exc:
            # Engine threw an exception — apply fail-closed or fail-open
            return self._handle_engine_error(
                exc=exc,
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=None,
                tool_args_summary={"content": "str", "sender": "str", "recipient": "str"},
                teec=teec,
                start_time=start_time,
            )

        action_str: str = decision.get("action", "DENY")
        risk_score: int = decision.get("risk_score", 0)
        reason_codes: list[str] = decision.get("reason_codes", [])
        reason: str = decision.get("reason", "Message policy evaluation")

        # ── Compute evaluation time ───────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        correlation_id = str(uuid.uuid4())

        # ── Handle decision based on action ───────────────────────────────
        if action_str == GovernanceAction.ALLOW.value:
            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.ALLOW.value,
                action_kind=ActionKind.MESSAGE.value,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=reason,
                reason_codes=reason_codes,
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
            )
            self._audit_trail.append(entry)

            self._decision_manager.create_receipt(
                decision_id=teec.decision_id,
                action=GovernanceAction.ALLOW,
            )

            return (False, None)

        elif action_str == GovernanceAction.DENY.value:
            # Record audit entry with action_kind="message"
            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.DENY.value,
                action_kind=ActionKind.MESSAGE.value,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=reason,
                reason_codes=reason_codes if "MESSAGE_DENIED" in reason_codes else reason_codes + ["MESSAGE_DENIED"],
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
            )
            self._audit_trail.append(entry)

            self._decision_manager.create_receipt(
                decision_id=teec.decision_id,
                action=GovernanceAction.DENY,
            )

            if self.mode == GovernanceMode.ENFORCE:
                # Block the message delivery
                return (
                    True,
                    f"[GOVERNANCE DENIAL] Message from '{sender_name}' to '{recipient_name}' blocked. "
                    f"Reason: {reason} | Codes: {','.join(entry.reason_codes)} | "
                    f"Decision: {teec.decision_id}",
                )
            elif self.mode == GovernanceMode.MONITOR:
                # Log but allow through
                logger.info(
                    "MONITOR mode MESSAGE_DENIED: agent=%s sender=%s recipient=%s reason=%s",
                    agent_id,
                    sender_name,
                    recipient_name,
                    reason,
                )
                return (False, None)

            return (False, None)

        else:
            # REFER or unknown — log and allow for messages
            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=action_str,
                action_kind=ActionKind.MESSAGE.value,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=reason,
                reason_codes=reason_codes,
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
            )
            self._audit_trail.append(entry)
            return (False, None)

    # ── Policy Mode Logic ─────────────────────────────────────────────────────

    def _policy_mode(
        self,
        agent_id: str,
        turn_id: int,
        last_message: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        start_time: float,
        sender: Any = None,
        recipient: Any = None,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Handle policy mode — evaluate tool calls and messages against TealEngine policies.

        When a TealEngine is configured, this method:
        1. Determines if this is a tool call or a plain message
        2. For tool calls: extracts tool_name and args, evaluates via TealEngine
        3. For plain messages: routes to _message_governance for inter-agent evaluation
        4. Routes to the appropriate handler based on the decision

        Returns:
            A tuple of (should_terminate, reply_message):
            - (False, None): Let the agent continue
            - (True, message): Terminate with denial or escalation reply

        Requirements covered: 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.5, 7.6, 15.1, 15.2, 15.8, 17.1, 17.6, 17.7
        """
        # ── Route: If no tool_calls, handle as inter-agent message governance ──
        if not tool_calls:
            return self._message_governance(
                agent_id=agent_id,
                turn_id=turn_id,
                last_message=last_message,
                sender=sender,
                recipient=recipient,
                start_time=start_time,
            )
        # ── Extract tool_name and args from latest message ────────────────
        tool_name: str | None = None
        tool_args: dict[str, Any] | None = None
        tool_args_summary: dict[str, Any] | None = None

        if tool_calls:
            first_tc = tool_calls[0]
            func_info = first_tc.get("function", {})
            tool_name = func_info.get("name")
            raw_args = func_info.get("arguments", {})

            # Resolve args to dict
            if isinstance(raw_args, str):
                try:
                    parsed = json.loads(raw_args)
                    if isinstance(parsed, dict):
                        tool_args = parsed
                        tool_args_summary = {
                            k: type(v).__name__ for k, v in parsed.items()
                        }
                    else:
                        tool_args = {}
                        tool_args_summary = {"_raw": type(parsed).__name__}
                except (ValueError, TypeError):
                    tool_args = {}
                    tool_args_summary = {"_raw": "str"}
            elif isinstance(raw_args, dict):
                tool_args = raw_args
                tool_args_summary = {
                    k: type(v).__name__ for k, v in raw_args.items()
                }
            else:
                tool_args = {}

        if tool_args is None:
            tool_args = {}

        # ── Compute params_hash with non-serializable handling ────────────
        # If tool_args contain non-serializable values, catch TypeError/ValueError
        # and continue with params_hash=None (Requirements 7.3, 7.4)
        params_hash: str | None = None
        if tool_args:
            try:
                from ag2_tealtiger.idempotency import compute_params_hash
                params_hash = compute_params_hash(tool_args)
            except (TypeError, ValueError) as exc:
                logger.warning(
                    "Non-serializable tool args for '%s' (agent=%s): %s. "
                    "Continuing evaluation without params_hash.",
                    tool_name,
                    agent_id,
                    exc,
                )
                params_hash = None

        # ── Build TEEC context ────────────────────────────────────────────
        teec = self._teec_builder.build(
            agent_id=agent_id,
            turn_id=turn_id,
            tool_name=tool_name,
            tool_args=tool_args if params_hash is not None else None,
        )

        # ── Build framework context for TealEngine ────────────────────────
        budget_state = self._budget_manager.get_state(agent_id)
        framework_context: dict[str, Any] = {
            "framework": "ag2",
            "agent_id": agent_id,
            "conversation_id": teec.conversation_id,
            "cumulative_cost": budget_state.current_spend,
            "action_kind": ActionKind.TOOL_CALL.value,
        }

        # ── Call TealEngine.evaluate() with error handling ─────────────────
        # Requirements 7.3, 7.4: Fail-closed in ENFORCE, fail-open in MONITOR/OBSERVE
        try:
            decision = self.engine.evaluate(
                tool_name=tool_name,
                args=tool_args,
                context=framework_context,
            )
        except Exception as exc:
            # Engine threw an exception — apply fail-closed or fail-open
            return self._handle_engine_error(
                exc=exc,
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args_summary=tool_args_summary,
                teec=teec,
                start_time=start_time,
            )

        action_str: str = decision.get("action", "DENY")
        risk_score: int = decision.get("risk_score", 0)
        reason_codes: list[str] = decision.get("reason_codes", [])
        reason: str = decision.get("reason", "Policy evaluation")

        # ── Compute evaluation time ───────────────────────────────────────
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        correlation_id = str(uuid.uuid4())

        # ── Handle decision based on action ───────────────────────────────
        if action_str == GovernanceAction.ALLOW.value:
            return self._handle_allow(
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args_summary=tool_args_summary,
                teec=teec,
                correlation_id=correlation_id,
                reason=reason,
                reason_codes=reason_codes,
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
            )

        elif action_str == GovernanceAction.DENY.value:
            return self._handle_deny(
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args_summary=tool_args_summary,
                teec=teec,
                correlation_id=correlation_id,
                reason=reason,
                reason_codes=reason_codes,
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
            )

        elif action_str == GovernanceAction.REFER.value:
            return self._handle_refer(
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args=tool_args,
                tool_args_summary=tool_args_summary,
                teec=teec,
                correlation_id=correlation_id,
                reason=reason,
                reason_codes=reason_codes,
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
                framework_context=framework_context,
            )

        else:
            # Unknown action — treat as DENY in ENFORCE, ALLOW in MONITOR
            logger.warning(
                "Unknown governance action '%s' from TealEngine, treating as DENY",
                action_str,
            )
            return self._handle_deny(
                agent_id=agent_id,
                turn_id=turn_id,
                tool_name=tool_name,
                tool_args_summary=tool_args_summary,
                teec=teec,
                correlation_id=correlation_id,
                reason=f"Unknown action: {action_str}",
                reason_codes=reason_codes + ["UNKNOWN_ACTION"],
                risk_score=risk_score,
                evaluation_time_ms=evaluation_time_ms,
            )

    # ── Decision Handlers ─────────────────────────────────────────────────────

    def _handle_allow(
        self,
        agent_id: str,
        turn_id: int,
        tool_name: str | None,
        tool_args_summary: dict[str, Any] | None,
        teec: TEECContext,
        correlation_id: str,
        reason: str,
        reason_codes: list[str],
        risk_score: int,
        evaluation_time_ms: float,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Handle ALLOW decision — pass through and record audit entry.

        Requirements: 1.3, 7.5
        """
        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=teec.decision_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.ALLOW.value,
            action_kind=ActionKind.TOOL_CALL.value,
            mode=self.mode.value,
            agent_id=agent_id,
            reason=reason,
            reason_codes=reason_codes,
            risk_score=risk_score,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            tool_name=tool_name,
            tool_args_summary=tool_args_summary,
        )
        self._audit_trail.append(entry)

        # Track cost after tool execution is allowed (Requirements: 18.1, 18.8)
        # Use a small estimated cost per tool call (based on text length heuristic)
        estimated_cost = self.cost_per_1k_tokens / 1000.0 * 50  # ~50 tokens per call
        track_result = self._budget_manager.track_cost(agent_id, estimated_cost)

        # Emit BUDGET_WARNING audit entry if threshold crossed
        if track_result.warning:
            budget_state = self._budget_manager.get_state(agent_id)
            warning_entry = AuditEntry(
                correlation_id=str(uuid.uuid4()),
                decision_id=str(uuid.uuid4()),
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.ALLOW.value,
                action_kind=ActionKind.BUDGET_CHANGE.value,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=f"Agent '{agent_id}' approaching budget limit (80% threshold)",
                reason_codes=["BUDGET_WARNING"],
                risk_score=0,
                evaluation_time_ms=0.0,
                teec=teec,
                cumulative_cost=budget_state.current_spend,
            )
            self._audit_trail.append(warning_entry)

        # Store decision receipt
        self._decision_manager.create_receipt(
            decision_id=teec.decision_id,
            action=GovernanceAction.ALLOW,
        )

        # Cache outcome for retry idempotency (Requirements: 11.1, 11.5)
        self._decision_outcomes[teec.decision_id] = {
            "decision_id": teec.decision_id,
            "action": GovernanceAction.ALLOW.value,
            "reason_codes": reason_codes,
            "risk_score": risk_score,
        }

        return (False, None)

    def _handle_deny(
        self,
        agent_id: str,
        turn_id: int,
        tool_name: str | None,
        tool_args_summary: dict[str, Any] | None,
        teec: TEECContext,
        correlation_id: str,
        reason: str,
        reason_codes: list[str],
        risk_score: int,
        evaluation_time_ms: float,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Handle DENY decision — block in ENFORCE, log in MONITOR.

        In ENFORCE mode: block the tool call and return a DenialMessage.
        In MONITOR mode: log the denial and allow the tool call to proceed.

        Requirements: 1.4, 1.5, 7.1, 7.2, 7.6
        """
        # Record audit entry regardless of mode
        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=teec.decision_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.DENY.value,
            action_kind=ActionKind.TOOL_CALL.value,
            mode=self.mode.value,
            agent_id=agent_id,
            reason=reason,
            reason_codes=reason_codes,
            risk_score=risk_score,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            tool_name=tool_name,
            tool_args_summary=tool_args_summary,
        )
        self._audit_trail.append(entry)

        # Store decision receipt
        self._decision_manager.create_receipt(
            decision_id=teec.decision_id,
            action=GovernanceAction.DENY,
        )

        # Cache outcome for retry idempotency (Requirements: 11.1, 11.5)
        self._decision_outcomes[teec.decision_id] = {
            "decision_id": teec.decision_id,
            "action": GovernanceAction.DENY.value,
            "reason_codes": reason_codes,
            "risk_score": risk_score,
        }

        if self.mode == GovernanceMode.ENFORCE:
            # Block — return DenialMessage as the reply
            denial = DenialMessage(
                tool_name=tool_name or "unknown",
                action=GovernanceAction.DENY.value,
                reason=reason,
                risk_score=risk_score,
                reason_codes=reason_codes,
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
            )
            return (True, denial.to_reply_string())

        elif self.mode == GovernanceMode.MONITOR:
            # Log but allow through
            logger.info(
                "MONITOR mode DENY: agent=%s tool=%s reason=%s codes=%s",
                agent_id,
                tool_name,
                reason,
                reason_codes,
            )
            return (False, None)

        # Fallback (shouldn't reach here in normal operation)
        return (False, None)

    def _handle_refer(
        self,
        agent_id: str,
        turn_id: int,
        tool_name: str | None,
        tool_args: dict[str, Any],
        tool_args_summary: dict[str, Any] | None,
        teec: TEECContext,
        correlation_id: str,
        reason: str,
        reason_codes: list[str],
        risk_score: int,
        evaluation_time_ms: float,
        framework_context: dict[str, Any],
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Handle REFER decision — suspend action, emit escalation receipt.

        Suspends the agent's pending action without terminating the GroupChat.
        Emits a structured EscalationReceipt for human review.

        Requirements: 15.1, 15.2, 15.8
        """
        decision_id = teec.decision_id

        # Record audit entry
        entry = AuditEntry(
            correlation_id=correlation_id,
            decision_id=decision_id,
            timestamp_ms=time.time() * 1000,
            action=GovernanceAction.REFER.value,
            action_kind=ActionKind.TOOL_CALL.value,
            mode=self.mode.value,
            agent_id=agent_id,
            reason=reason,
            reason_codes=reason_codes,
            risk_score=risk_score,
            evaluation_time_ms=evaluation_time_ms,
            teec=teec,
            tool_name=tool_name,
            tool_args_summary=tool_args_summary,
        )
        self._audit_trail.append(entry)

        # Create escalation receipt
        escalation_receipt = EscalationReceipt(
            decision_id=decision_id,
            agent_id=agent_id,
            tool_name=tool_name or "unknown",
            tool_arguments=tool_args,
            conversation_id=teec.conversation_id,
            turn_id=turn_id,
            group_chat_id=teec.group_chat_id,
            risk_score=risk_score,
            reason_codes=reason_codes,
            human_readable_summary=(
                f"Action '{tool_name}' by agent '{agent_id}' requires review. "
                f"Risk: {risk_score}. Reason: {reason}"
            ),
            policy_context=framework_context,
            issued_at=datetime.now(timezone.utc),
            expires_at=None,
        )

        # Store decision receipt for lifecycle management
        self._decision_manager.create_receipt(
            decision_id=decision_id,
            action=GovernanceAction.REFER,
        )

        # Store escalation receipt for resolution lookup
        # (attached as metadata to the decision receipt for retrieval)
        receipt = self._decision_manager.get_receipt(decision_id)
        if receipt is not None:
            receipt.execution_outcome = "pending_review"

        # Cache outcome for retry idempotency (Requirements: 11.1, 11.5)
        self._decision_outcomes[decision_id] = {
            "decision_id": decision_id,
            "action": GovernanceAction.REFER.value,
            "reason_codes": reason_codes,
            "risk_score": risk_score,
        }

        # Return suspension reply
        return (True, f"Action pending review: {decision_id}")

    # ── Error Handling ────────────────────────────────────────────────────────

    def _handle_engine_error(
        self,
        exc: Exception,
        agent_id: str,
        turn_id: int,
        tool_name: str | None,
        tool_args_summary: dict[str, Any] | None,
        teec: TEECContext,
        start_time: float,
    ) -> tuple[bool, str | dict[str, Any] | None]:
        """Handle TealEngine exceptions with fail-closed or fail-open behavior.

        In ENFORCE mode with fail_closed=True:
            - DENY the action with reason_codes=["ENGINE_ERROR", "FAIL_CLOSED"]
            - Return a governance denial message

        In MONITOR or OBSERVE mode (or ENFORCE with fail_closed=False):
            - ALLOW the action with reason_codes=["ENGINE_ERROR", "FAIL_OPEN"]
            - Return (False, None) to let the agent continue

        Requirements: 7.3, 7.4
        """
        evaluation_time_ms = (time.perf_counter() - start_time) * 1000
        correlation_id = str(uuid.uuid4())

        # Determine fail-closed vs fail-open
        if self.mode == GovernanceMode.ENFORCE and self.fail_closed:
            # Fail-closed: deny the action
            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.DENY.value,
                action_kind=ActionKind.TOOL_CALL.value,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=f"Engine error: {exc}",
                reason_codes=["ENGINE_ERROR", "FAIL_CLOSED"],
                risk_score=100,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
                tool_name=tool_name,
                tool_args_summary=tool_args_summary,
            )
            self._audit_trail.append(entry)

            return (
                True,
                "[GOVERNANCE DENIAL] Engine error. Fail-closed: action denied.",
            )
        else:
            # Fail-open: allow the action through
            entry = AuditEntry(
                correlation_id=correlation_id,
                decision_id=teec.decision_id,
                timestamp_ms=time.time() * 1000,
                action=GovernanceAction.ALLOW.value,
                action_kind=ActionKind.TOOL_CALL.value,
                mode=self.mode.value,
                agent_id=agent_id,
                reason=f"Engine error: {exc}",
                reason_codes=["ENGINE_ERROR", "FAIL_OPEN"],
                risk_score=0,
                evaluation_time_ms=evaluation_time_ms,
                teec=teec,
                tool_name=tool_name,
                tool_args_summary=tool_args_summary,
            )
            self._audit_trail.append(entry)

            return (False, None)
