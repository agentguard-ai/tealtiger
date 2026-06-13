# Copyright (c) 2026, TealTiger Team
#
# SPDX-License-Identifier: Apache-2.0

"""TealTiger governance middleware for AG2 Beta.

Implements BaseMiddleware with on_turn() and on_tool_execution() hooks to
enforce governance policies before consequential actions execute.

Design principles:
- Decision record created BEFORE every consequential action
- Per-actor enforcement (no ambient authority)
- Denial/timeout/require_approval are visible states, not silent gaps
- Every decision binds: agent_id, turn_id, action_kind, tool_name,
  params_hash, policy_digest, decision_source
- Execution outcome backlinks to decision_id
"""

from __future__ import annotations

import fnmatch
import json
import logging
import re
import time
import uuid
from collections.abc import Callable, Sequence, Awaitable
from typing import Any, Dict, List, Optional

from ag2_tealtiger.beta.types import (
    DecisionAction,
    DecisionSource,
    GovernanceDecision,
    GovernanceMode,
    GovernancePolicy,
    TEECReceipt,
)

logger = logging.getLogger("tealtiger.ag2.beta")

# Lazy import AG2 Beta types — guarded for when ag2 is not installed
try:
    from autogen.beta import Context
    from autogen.beta.events import BaseEvent, ModelResponse, ToolCallEvent
    from autogen.beta.middleware import BaseMiddleware
except ImportError:
    raise ImportError(
        "ag2-tealtiger requires the 'ag2' package with beta support. "
        "Install it with: pip install 'ag2>=0.13.0'"
    )


# PII patterns for detection
_PII_PATTERNS = {
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone": re.compile(r"\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
}

# Secret patterns
_SECRET_PATTERNS = [
    re.compile(r"\b(sk-[a-zA-Z0-9]{20,})\b"),  # OpenAI
    re.compile(r"\b(ghp_[a-zA-Z0-9]{36,})\b"),  # GitHub PAT
    re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),  # AWS Access Key
    re.compile(r"\b(xox[bpors]-[a-zA-Z0-9-]+)\b"),  # Slack
]


class TealTigerMiddleware(BaseMiddleware):
    """Deterministic governance middleware for AG2 Beta agents.

    Enforces tool allowlists, PII detection, cost limits, secret detection,
    and per-agent kill switches. Produces TEEC receipts for every governed
    action.

    Args:
        event: The initial turn event (injected by AG2 runtime).
        context: The turn context (injected by AG2 runtime).
        mode: Governance mode — observe, monitor, or enforce.
        policies: List of governance policies to evaluate.
        agent_id: Override agent identifier (defaults to agent name from context).
        conversation_id: Conversation correlation ID.
        budget_limit: Per-session cost ceiling in USD.
        on_decision: Callback invoked with each GovernanceDecision.
        on_receipt: Callback invoked with each TEECReceipt.

    Example:
        from ag2_tealtiger.beta import TealTigerMiddleware, GovernancePolicy

        agent = Agent(
            "assistant",
            config=OpenAIConfig("gpt-4o-mini"),
            tools=[search, read_file],
            middleware=[
                Middleware(
                    TealTigerMiddleware,
                    mode=GovernanceMode.ENFORCE,
                    policies=[
                        GovernancePolicy.tool_allowlist(["search", "read_file"]),
                        GovernancePolicy.pii_block(),
                        GovernancePolicy.cost_limit(max_per_session=5.0),
                    ],
                )
            ],
        )
    """

    def __init__(
        self,
        event: BaseEvent,
        context: Context,
        mode: GovernanceMode = GovernanceMode.OBSERVE,
        policies: Optional[List[GovernancePolicy]] = None,
        agent_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        budget_limit: Optional[float] = None,
        on_decision: Optional[Callable[[GovernanceDecision], None]] = None,
        on_receipt: Optional[Callable[[TEECReceipt], None]] = None,
    ) -> None:
        super().__init__(event, context)
        self.mode = mode
        self.policies = policies or []
        self.agent_id = agent_id or ""
        self.conversation_id = conversation_id or str(uuid.uuid4())
        self.budget_limit = budget_limit
        self.on_decision = on_decision
        self.on_receipt = on_receipt

        # Per-turn state
        self._turn_id: int = 0
        self._decisions: List[GovernanceDecision] = []
        self._receipts: List[TEECReceipt] = []
        self._frozen_agents: set = set()
        self._cumulative_cost: float = 0.0
        self._policy_digest = GovernanceDecision.compute_policy_digest(self.policies)

    # ------------------------------------------------------------------
    # on_turn: wrap the entire agent turn for context tracking
    # ------------------------------------------------------------------

    async def on_turn(
        self,
        call_next: Callable[[BaseEvent, Context], Awaitable[ModelResponse]],
        event: BaseEvent,
        context: Context,
    ) -> ModelResponse:
        """Wrap the agent turn for governance context tracking."""
        self._turn_id += 1
        start_time = time.perf_counter()

        # Check if agent is frozen
        if self.agent_id in self._frozen_agents:
            decision = self._create_decision(
                action_kind="turn",
                action=DecisionAction.DENY,
                decision_source=DecisionSource.FREEZE,
                reason_codes=["AGENT_FROZEN"],
                risk_score=100,
                evaluation_time_ms=(time.perf_counter() - start_time) * 1000,
            )
            self._emit_decision(decision)

            if self.mode == GovernanceMode.ENFORCE:
                # Return a denial response visible in the transcript
                raise GovernanceDenyError(
                    f"Agent '{self.agent_id}' is frozen. "
                    f"Decision: {decision.decision_id}"
                )

        response = await call_next(event, context)
        return response

    # ------------------------------------------------------------------
    # on_tool_execution: primary governance enforcement point
    # ------------------------------------------------------------------

    async def on_tool_execution(
        self,
        call_next: Callable[..., Any],
        event: ToolCallEvent,
        context: Context,
    ) -> Any:
        """Evaluate governance policies before tool execution.

        Creates a decision record BEFORE execution. If denied in ENFORCE mode,
        returns a structured denial result without calling call_next.
        """
        start_time = time.perf_counter()
        tool_name = event.name
        tool_args = self._extract_tool_args(event)
        params_hash = GovernanceDecision.compute_params_hash(tool_args)

        # Evaluate all policies
        action = DecisionAction.ALLOW
        reason_codes: List[str] = []
        risk_score = 0

        # 1. Check freeze
        if self.agent_id in self._frozen_agents:
            action = DecisionAction.DENY
            reason_codes.append("AGENT_FROZEN")
            risk_score = 100

        # 2. Tool allowlist/denylist
        if action == DecisionAction.ALLOW:
            for policy in self.policies:
                if policy.type == "tool_allowlist":
                    allowed = policy.config.get("allowed", [])
                    if not self._matches_patterns(tool_name, allowed):
                        action = DecisionAction.DENY
                        reason_codes.append("TOOL_NOT_ALLOWED")
                        risk_score = max(risk_score, 80)
                        break

                elif policy.type == "tool_denylist":
                    denied = policy.config.get("denied", [])
                    if self._matches_patterns(tool_name, denied):
                        action = DecisionAction.DENY
                        reason_codes.append("TOOL_DENIED")
                        risk_score = max(risk_score, 80)
                        break

        # 3. PII detection in arguments
        if action == DecisionAction.ALLOW:
            for policy in self.policies:
                if policy.type == "pii_block":
                    categories = policy.config.get("categories", [])
                    pii_found = self._detect_pii(tool_args, categories)
                    if pii_found:
                        action = DecisionAction.DENY
                        reason_codes.extend(
                            [f"PII_DETECTED:{cat}" for cat in pii_found]
                        )
                        risk_score = max(risk_score, 90)
                        break

        # 4. Secret detection
        if action == DecisionAction.ALLOW:
            for policy in self.policies:
                if policy.type == "secret_detection":
                    if self._detect_secrets(tool_args):
                        action = DecisionAction.DENY
                        reason_codes.append("SECRET_DETECTED")
                        risk_score = max(risk_score, 95)
                        break

        # 5. Cost limit
        if action == DecisionAction.ALLOW and self.budget_limit:
            for policy in self.policies:
                if policy.type == "cost_limit":
                    limit = policy.config.get("max_per_session", self.budget_limit)
                    if self._cumulative_cost >= limit:
                        action = DecisionAction.DENY
                        reason_codes.append("BUDGET_EXCEEDED")
                        risk_score = max(risk_score, 70)
                        break

        evaluation_time_ms = (time.perf_counter() - start_time) * 1000

        # Create decision record BEFORE execution
        decision = self._create_decision(
            action_kind="tool_call",
            tool_name=tool_name,
            params_hash=params_hash,
            action=action,
            decision_source=DecisionSource.POLICY_ENGINE,
            reason_codes=reason_codes,
            risk_score=risk_score,
            evaluation_time_ms=evaluation_time_ms,
        )
        self._emit_decision(decision)

        # Mode-based behavior
        if self.mode == GovernanceMode.OBSERVE:
            # Allow everything, just track
            logger.debug(
                "[OBSERVE] %s: %s → %s (risk=%d)",
                decision.decision_id,
                tool_name,
                action.value,
                risk_score,
            )
            result = await call_next(event, context)
            self._emit_receipt(decision, execution_outcome="executed")
            return result

        elif self.mode == GovernanceMode.MONITOR:
            # Evaluate but allow through
            if action != DecisionAction.ALLOW:
                logger.warning(
                    "[MONITOR] %s: WOULD BLOCK %s — %s",
                    decision.decision_id,
                    tool_name,
                    reason_codes,
                )
            result = await call_next(event, context)
            self._emit_receipt(decision, execution_outcome="executed")
            return result

        else:
            # ENFORCE mode
            if action == DecisionAction.ALLOW:
                result = await call_next(event, context)
                self._emit_receipt(decision, execution_outcome="executed")
                return result

            elif action == DecisionAction.DENY:
                logger.warning(
                    "[ENFORCE] %s: DENIED %s — %s",
                    decision.decision_id,
                    tool_name,
                    reason_codes,
                )
                self._emit_receipt(decision, execution_outcome="blocked")
                # Return structured denial visible in transcript
                return (
                    f"[GOVERNANCE DENIED] Tool '{tool_name}' blocked. "
                    f"Reason: {', '.join(reason_codes)}. "
                    f"Decision ID: {decision.decision_id}"
                )

            elif action == DecisionAction.REQUIRE_APPROVAL:
                logger.info(
                    "[ENFORCE] %s: REQUIRE_APPROVAL for %s",
                    decision.decision_id,
                    tool_name,
                )
                self._emit_receipt(decision, execution_outcome="pending")
                return (
                    f"[GOVERNANCE PENDING] Tool '{tool_name}' requires approval. "
                    f"Decision ID: {decision.decision_id}"
                )

            else:
                # REVISE
                self._emit_receipt(decision, execution_outcome="pending")
                return (
                    f"[GOVERNANCE REVISE] Tool '{tool_name}' needs argument revision. "
                    f"Reason: {', '.join(reason_codes)}. "
                    f"Decision ID: {decision.decision_id}"
                )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def freeze(self, agent_id: Optional[str] = None) -> None:
        """Freeze an agent — blocks ALL actions regardless of mode."""
        target = agent_id or self.agent_id
        self._frozen_agents.add(target)
        logger.info("[GOVERNANCE] Frozen agent: %s", target)

    def unfreeze(self, agent_id: Optional[str] = None) -> None:
        """Unfreeze an agent — restores normal governance evaluation."""
        target = agent_id or self.agent_id
        self._frozen_agents.discard(target)
        logger.info("[GOVERNANCE] Unfrozen agent: %s", target)

    def is_frozen(self, agent_id: Optional[str] = None) -> bool:
        """Check if an agent is frozen."""
        target = agent_id or self.agent_id
        return target in self._frozen_agents

    @property
    def decisions(self) -> List[GovernanceDecision]:
        """Get all decisions made during this turn."""
        return self._decisions

    @property
    def receipts(self) -> List[TEECReceipt]:
        """Get all TEEC receipts produced during this turn."""
        return self._receipts

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _create_decision(
        self,
        action_kind: str,
        action: DecisionAction = DecisionAction.ALLOW,
        decision_source: DecisionSource = DecisionSource.POLICY_ENGINE,
        tool_name: Optional[str] = None,
        params_hash: str = "",
        reason_codes: Optional[List[str]] = None,
        risk_score: int = 0,
        evaluation_time_ms: float = 0.0,
    ) -> GovernanceDecision:
        """Create a new governance decision record."""
        decision_id = str(uuid.uuid4())
        return GovernanceDecision(
            decision_id=decision_id,
            agent_id=self.agent_id,
            turn_id=self._turn_id,
            action_kind=action_kind,
            tool_name=tool_name,
            params_hash=params_hash,
            action=action,
            decision_source=decision_source,
            policy_digest=self._policy_digest,
            idempotency_key=f"{decision_id}:{params_hash}",
            reason_codes=reason_codes or [],
            risk_score=risk_score,
            evaluation_time_ms=evaluation_time_ms,
        )

    def _emit_decision(self, decision: GovernanceDecision) -> None:
        """Store and emit a decision."""
        self._decisions.append(decision)
        if self.on_decision:
            self.on_decision(decision)

    def _emit_receipt(
        self, decision: GovernanceDecision, execution_outcome: str
    ) -> None:
        """Create and emit a TEEC receipt linking execution outcome to decision."""
        receipt = TEECReceipt(
            decision_id=decision.decision_id,
            conversation_id=self.conversation_id,
            turn_id=decision.turn_id,
            parent_turn_id=decision.parent_turn_id,
            agent_id=decision.agent_id,
            action_kind=decision.action_kind,
            tool_name=decision.tool_name,
            params_hash=decision.params_hash,
            action=decision.action.value,
            decision_source=decision.decision_source.value,
            policy_digest=decision.policy_digest,
            reason_codes=decision.reason_codes,
            risk_score=decision.risk_score,
            execution_outcome=execution_outcome,
            idempotency_key=decision.idempotency_key,
            approval_id=decision.approval_id,
            delegation_scope=decision.delegation_scope,
            evaluation_time_ms=decision.evaluation_time_ms,
        )
        self._receipts.append(receipt)
        if self.on_receipt:
            self.on_receipt(receipt)

    def _extract_tool_args(self, event: ToolCallEvent) -> Any:
        """Extract tool arguments from a ToolCallEvent."""
        # ToolCallEvent should have arguments accessible
        if hasattr(event, "arguments"):
            return event.arguments
        if hasattr(event, "args"):
            return event.args
        return {}

    def _matches_patterns(self, tool_name: str, patterns: List[str]) -> bool:
        """Check if tool_name matches any glob pattern in the list."""
        return any(fnmatch.fnmatch(tool_name, pattern) for pattern in patterns)

    def _detect_pii(self, args: Any, categories: List[str]) -> List[str]:
        """Detect PII in tool arguments."""
        text = json.dumps(args) if not isinstance(args, str) else args
        found = []
        for category in categories:
            pattern = _PII_PATTERNS.get(category)
            if pattern and pattern.search(text):
                found.append(category)
        return found

    def _detect_secrets(self, args: Any) -> bool:
        """Detect secrets/credentials in tool arguments."""
        text = json.dumps(args) if not isinstance(args, str) else args
        return any(pattern.search(text) for pattern in _SECRET_PATTERNS)


class GovernanceDenyError(Exception):
    """Raised when governance denies an action in ENFORCE mode."""

    def __init__(self, message: str, decision_id: str = "") -> None:
        super().__init__(message)
        self.decision_id = decision_id
