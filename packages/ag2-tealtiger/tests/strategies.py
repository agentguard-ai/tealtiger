"""Custom Hypothesis strategies for ag2-tealtiger property-based tests.

Provides generators for core domain types: agent identifiers, tool names,
tool arguments, governance modes, governance decisions, TEEC contexts,
and audit entries. These strategies constrain inputs to realistic values
matching the AG2 + TealTiger domain.
"""

from __future__ import annotations

import string
from typing import Any

from hypothesis import strategies as st

from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    BudgetState,
    DecisionSource,
    DenialMessage,
    GovernanceAction,
    GovernanceMode,
    TEECContext,
)

# ── Primitive Strategies ──────────────────────────────────────────────────────

# Agent IDs: realistic identifiers matching AG2 agent naming conventions
agent_ids: st.SearchStrategy[str] = st.from_regex(
    r"[a-z][a-z0-9_]{2,29}", fullmatch=True
)

# Tool names: realistic function-style names (snake_case, dot-separated namespaces)
tool_names: st.SearchStrategy[str] = st.one_of(
    st.from_regex(r"[a-z][a-z0-9_]{1,24}", fullmatch=True),
    st.sampled_from([
        "web_search",
        "file_read",
        "file_write",
        "code_execute",
        "send_email",
        "db_query",
        "api_call",
        "shell_exec",
        "create_file",
        "delete_file",
        "http_request",
        "calculate",
        "summarize",
        "translate",
        "analyze_data",
    ]),
)

# Tool arguments: dictionaries with string keys and JSON-serializable values
_json_primitives: st.SearchStrategy[Any] = st.one_of(
    st.none(),
    st.booleans(),
    st.integers(min_value=-1_000_000, max_value=1_000_000),
    st.floats(
        min_value=-1e6,
        max_value=1e6,
        allow_nan=False,
        allow_infinity=False,
    ),
    st.text(
        alphabet=string.ascii_letters + string.digits + " _-./",
        min_size=0,
        max_size=100,
    ),
)

# Recursive JSON-serializable values (nested dicts and lists)
_json_values: st.SearchStrategy[Any] = st.recursive(
    _json_primitives,
    lambda children: st.one_of(
        st.lists(children, max_size=5),
        st.dictionaries(
            keys=st.text(
                alphabet=string.ascii_lowercase + "_",
                min_size=1,
                max_size=20,
            ),
            values=children,
            max_size=5,
        ),
    ),
    max_leaves=20,
)

tool_args: st.SearchStrategy[dict[str, Any]] = st.dictionaries(
    keys=st.text(
        alphabet=string.ascii_lowercase + "_",
        min_size=1,
        max_size=20,
    ),
    values=_json_values,
    min_size=0,
    max_size=8,
)

# ── Enum Strategies ───────────────────────────────────────────────────────────

governance_modes: st.SearchStrategy[GovernanceMode] = st.sampled_from(
    list(GovernanceMode)
)

governance_actions: st.SearchStrategy[GovernanceAction] = st.sampled_from(
    list(GovernanceAction)
)

governance_decisions: st.SearchStrategy[dict[str, Any]] = st.fixed_dictionaries(
    {
        "action": st.sampled_from([a.value for a in GovernanceAction]),
        "risk_score": st.integers(min_value=0, max_value=100),
        "reason_codes": st.lists(
            st.sampled_from([
                "POLICY_VIOLATION",
                "BUDGET_EXCEEDED",
                "AGENT_FROZEN",
                "REQUIRES_REVIEW",
                "OBSERVE_PASSTHROUGH",
                "ENGINE_ERROR",
                "FAIL_CLOSED",
                "FAIL_OPEN",
                "ALL_SPEAKERS_DENIED",
                "MESSAGE_DENIED",
                "BUDGET_WARNING",
                "DECISION_EXPIRED",
                "REVALIDATION_TRIGGERED",
                "REFER_DENIED",
                "RECEIPT_EXPIRED",
            ]),
            min_size=1,
            max_size=4,
        ),
        "reason": st.text(
            alphabet=string.ascii_letters + string.digits + " _-.",
            min_size=1,
            max_size=100,
        ),
    }
)

action_kinds: st.SearchStrategy[ActionKind] = st.sampled_from(list(ActionKind))

decision_sources: st.SearchStrategy[DecisionSource] = st.sampled_from(
    list(DecisionSource)
)

# ── Composite Strategies ──────────────────────────────────────────────────────

# UUID v4 strings (simplified: 32 hex chars formatted as UUID)
uuids: st.SearchStrategy[str] = st.from_regex(
    r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
    fullmatch=True,
)

# SHA-256 hex digests (64 hex characters)
sha256_hashes: st.SearchStrategy[str] = st.from_regex(
    r"[0-9a-f]{64}", fullmatch=True
)

# Risk scores: 0-100 integer
risk_scores: st.SearchStrategy[int] = st.integers(min_value=0, max_value=100)

# Evaluation time in milliseconds (sub-5ms target, but allow range for testing)
evaluation_times_ms: st.SearchStrategy[float] = st.floats(
    min_value=0.01, max_value=100.0, allow_nan=False, allow_infinity=False
)

# Cost values: non-negative floats representing dollar amounts
cost_values: st.SearchStrategy[float] = st.floats(
    min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False
)

# Budget limits: positive floats
budget_limits: st.SearchStrategy[float] = st.floats(
    min_value=0.01, max_value=10000.0, allow_nan=False, allow_infinity=False
)

# Turn IDs: monotonically increasing positive integers
turn_ids: st.SearchStrategy[int] = st.integers(min_value=1, max_value=10000)

# Reason codes lists
reason_codes: st.SearchStrategy[list[str]] = st.lists(
    st.sampled_from([
        "POLICY_VIOLATION",
        "BUDGET_EXCEEDED",
        "AGENT_FROZEN",
        "REQUIRES_REVIEW",
        "OBSERVE_PASSTHROUGH",
        "ENGINE_ERROR",
        "FAIL_CLOSED",
        "FAIL_OPEN",
        "ALL_SPEAKERS_DENIED",
        "MESSAGE_DENIED",
        "BUDGET_WARNING",
        "DECISION_EXPIRED",
        "REVALIDATION_TRIGGERED",
        "REFER_DENIED",
        "RECEIPT_EXPIRED",
    ]),
    min_size=1,
    max_size=4,
)

# ── Domain Object Strategies ──────────────────────────────────────────────────


@st.composite
def teec_contexts(draw: st.DrawFn) -> TEECContext:
    """Generate valid TEECContext instances."""
    return TEECContext(
        namespace="teec.ag2",
        conversation_id=draw(uuids),
        turn_id=draw(turn_ids),
        agent_role=draw(st.one_of(st.none(), st.sampled_from([
            "coder", "reviewer", "executor", "planner", "critic",
        ]))),
        group_chat_id=draw(st.one_of(st.none(), uuids)),
        params_hash=draw(st.one_of(st.none(), sha256_hashes)),
        parent_conversation_id=draw(st.one_of(st.none(), uuids)),
        decision_id=draw(uuids),
        idempotency_key=draw(st.one_of(st.none(), sha256_hashes)),
        policy_digest=draw(st.one_of(st.none(), sha256_hashes)),
        decision_source=draw(st.sampled_from([ds.value for ds in DecisionSource])),
        execution_outcome=draw(st.one_of(st.none(), st.sampled_from([
            "success", "failure", "timeout", "pending",
        ]))),
        approval_id=draw(st.one_of(st.none(), uuids)),
    )


@st.composite
def audit_entries(draw: st.DrawFn) -> AuditEntry:
    """Generate valid AuditEntry instances with complete fields."""
    return AuditEntry(
        correlation_id=draw(uuids),
        decision_id=draw(uuids),
        timestamp_ms=draw(st.floats(min_value=1e12, max_value=2e12)),
        action=draw(st.sampled_from([a.value for a in GovernanceAction])),
        action_kind=draw(st.sampled_from([ak.value for ak in ActionKind])),
        mode=draw(st.sampled_from([m.value for m in GovernanceMode])),
        agent_id=draw(agent_ids),
        reason=draw(st.text(
            alphabet=string.ascii_letters + " _-.",
            min_size=1,
            max_size=80,
        )),
        reason_codes=draw(reason_codes),
        risk_score=draw(risk_scores),
        evaluation_time_ms=draw(evaluation_times_ms),
        teec=draw(teec_contexts()),
        tool_name=draw(st.one_of(st.none(), tool_names)),
        tool_args_summary=draw(st.one_of(st.none(), tool_args)),
        pii_detected=draw(st.just([])),
        cost_tracked=draw(cost_values),
        cumulative_cost=draw(cost_values),
    )


@st.composite
def budget_states(draw: st.DrawFn) -> BudgetState:
    """Generate valid BudgetState instances."""
    limit = draw(st.one_of(st.none(), budget_limits))
    spend = draw(st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False))
    remaining = (limit - spend) if limit is not None else None
    return BudgetState(
        agent_id=draw(agent_ids),
        budget_limit=limit,
        current_spend=spend,
        remaining_budget=remaining,
        warning_emitted=draw(st.booleans()),
    )


@st.composite
def denial_messages(draw: st.DrawFn) -> DenialMessage:
    """Generate valid DenialMessage instances."""
    return DenialMessage(
        tool_name=draw(tool_names),
        action=GovernanceAction.DENY.value,
        reason=draw(st.text(
            alphabet=string.ascii_letters + " _-.",
            min_size=1,
            max_size=80,
        )),
        risk_score=draw(risk_scores),
        reason_codes=draw(reason_codes),
        correlation_id=draw(uuids),
        decision_id=draw(uuids),
    )
