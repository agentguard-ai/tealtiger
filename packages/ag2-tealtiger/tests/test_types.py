"""Unit tests for ag2_tealtiger.types module."""

from datetime import datetime, timezone

from ag2_tealtiger.types import (
    ActionKind,
    AuditEntry,
    BudgetState,
    DecisionReceipt,
    DecisionSource,
    DenialMessage,
    EscalationReceipt,
    GovernanceAction,
    GovernanceMode,
    RevalidationCondition,
    SpeakerSelectionAuditEntry,
    TEECContext,
)


class TestGovernanceAction:
    """Tests for GovernanceAction enum."""

    def test_values(self):
        assert GovernanceAction.ALLOW == "ALLOW"
        assert GovernanceAction.DENY == "DENY"
        assert GovernanceAction.MODIFY == "MODIFY"
        assert GovernanceAction.REFER == "REFER"

    def test_is_str_enum(self):
        assert isinstance(GovernanceAction.ALLOW, str)
        assert GovernanceAction.DENY.upper() == "DENY"

    def test_all_members(self):
        assert len(GovernanceAction) == 4


class TestGovernanceMode:
    """Tests for GovernanceMode enum."""

    def test_values(self):
        assert GovernanceMode.ENFORCE == "ENFORCE"
        assert GovernanceMode.MONITOR == "MONITOR"
        assert GovernanceMode.OBSERVE == "OBSERVE"

    def test_is_str_enum(self):
        assert isinstance(GovernanceMode.ENFORCE, str)

    def test_all_members(self):
        assert len(GovernanceMode) == 3


class TestActionKind:
    """Tests for ActionKind enum."""

    def test_values(self):
        assert ActionKind.MESSAGE == "message"
        assert ActionKind.TOOL_CALL == "tool_call"
        assert ActionKind.BUDGET_CHANGE == "budget_change"
        assert ActionKind.STOP == "stop"
        assert ActionKind.FREEZE == "freeze"

    def test_is_str_enum(self):
        assert isinstance(ActionKind.MESSAGE, str)

    def test_all_members(self):
        assert len(ActionKind) == 5


class TestDecisionSource:
    """Tests for DecisionSource enum."""

    def test_values(self):
        assert DecisionSource.POLICY_ENGINE == "policy_engine"
        assert DecisionSource.HUMAN_REVIEWER == "human_reviewer"
        assert DecisionSource.DELEGATED_AUTHORITY == "delegated_authority"
        assert DecisionSource.DEFAULT_MODE == "default_mode"
        assert DecisionSource.SYSTEM_TIMEOUT == "system_timeout"

    def test_is_str_enum(self):
        assert isinstance(DecisionSource.POLICY_ENGINE, str)

    def test_all_members(self):
        assert len(DecisionSource) == 5


class TestTEECContext:
    """Tests for TEECContext dataclass."""

    def test_defaults(self):
        ctx = TEECContext()
        assert ctx.namespace == "teec.ag2"
        assert ctx.conversation_id == ""
        assert ctx.turn_id == 0
        assert ctx.agent_role is None
        assert ctx.group_chat_id is None
        assert ctx.params_hash is None
        assert ctx.parent_conversation_id is None
        assert ctx.decision_id == ""
        assert ctx.idempotency_key is None
        assert ctx.policy_digest is None
        assert ctx.decision_source == "default_mode"
        assert ctx.execution_outcome is None
        assert ctx.approval_id is None

    def test_custom_values(self):
        ctx = TEECContext(
            conversation_id="conv-123",
            turn_id=5,
            agent_role="coder",
            group_chat_id="gc-456",
            params_hash="abc123",
            decision_id="dec-789",
        )
        assert ctx.conversation_id == "conv-123"
        assert ctx.turn_id == 5
        assert ctx.agent_role == "coder"
        assert ctx.group_chat_id == "gc-456"
        assert ctx.params_hash == "abc123"
        assert ctx.decision_id == "dec-789"


class TestAuditEntry:
    """Tests for AuditEntry dataclass."""

    def test_required_fields(self):
        teec = TEECContext(conversation_id="conv-1", decision_id="dec-1")
        entry = AuditEntry(
            correlation_id="corr-1",
            decision_id="dec-1",
            timestamp_ms=1000.0,
            action="ALLOW",
            action_kind="tool_call",
            mode="ENFORCE",
            agent_id="agent-1",
            reason="Policy allows",
            reason_codes=["POLICY_ALLOW"],
            risk_score=0,
            evaluation_time_ms=1.5,
            teec=teec,
        )
        assert entry.correlation_id == "corr-1"
        assert entry.decision_id == "dec-1"
        assert entry.timestamp_ms == 1000.0
        assert entry.action == "ALLOW"
        assert entry.action_kind == "tool_call"
        assert entry.mode == "ENFORCE"
        assert entry.agent_id == "agent-1"
        assert entry.reason == "Policy allows"
        assert entry.reason_codes == ["POLICY_ALLOW"]
        assert entry.risk_score == 0
        assert entry.evaluation_time_ms == 1.5
        assert entry.teec is teec

    def test_optional_fields_defaults(self):
        teec = TEECContext()
        entry = AuditEntry(
            correlation_id="corr-1",
            decision_id="dec-1",
            timestamp_ms=1000.0,
            action="ALLOW",
            action_kind="tool_call",
            mode="OBSERVE",
            agent_id="agent-1",
            reason="Observe mode",
            reason_codes=["OBSERVE_PASSTHROUGH"],
            risk_score=0,
            evaluation_time_ms=0.5,
            teec=teec,
        )
        assert entry.tool_name is None
        assert entry.tool_args_summary is None
        assert entry.pii_detected == []
        assert entry.cost_tracked == 0.0
        assert entry.cumulative_cost == 0.0
        assert entry.trace_id is None
        assert entry.metadata == {}

    def test_optional_fields_set(self):
        teec = TEECContext()
        entry = AuditEntry(
            correlation_id="corr-1",
            decision_id="dec-1",
            timestamp_ms=1000.0,
            action="DENY",
            action_kind="tool_call",
            mode="ENFORCE",
            agent_id="agent-1",
            reason="PII detected",
            reason_codes=["PII_DETECTED"],
            risk_score=85,
            evaluation_time_ms=2.1,
            teec=teec,
            tool_name="send_email",
            tool_args_summary={"to": "***"},
            pii_detected=[{"type": "email", "confidence": 0.99}],
            cost_tracked=0.003,
            cumulative_cost=0.015,
            trace_id="trace-abc",
            metadata={"policy_version": "v2"},
        )
        assert entry.tool_name == "send_email"
        assert entry.tool_args_summary == {"to": "***"}
        assert entry.pii_detected == [{"type": "email", "confidence": 0.99}]
        assert entry.cost_tracked == 0.003
        assert entry.cumulative_cost == 0.015
        assert entry.trace_id == "trace-abc"
        assert entry.metadata == {"policy_version": "v2"}


class TestDecisionReceipt:
    """Tests for DecisionReceipt dataclass."""

    def test_basic_receipt(self):
        now = datetime.now(tz=timezone.utc)
        receipt = DecisionReceipt(
            decision_id="dec-1",
            action=GovernanceAction.ALLOW,
            issued_at=now,
            expires_at=None,
        )
        assert receipt.decision_id == "dec-1"
        assert receipt.action == GovernanceAction.ALLOW
        assert receipt.issued_at == now
        assert receipt.expires_at is None
        assert receipt.revalidate_if == []
        assert receipt.execution_outcome is None
        assert receipt.approval_id is None
        assert receipt.is_expired is False

    def test_receipt_with_revalidation(self):
        now = datetime.now(tz=timezone.utc)
        condition = RevalidationCondition(
            condition_type="cost_exceeded",
            threshold=10.0,
            description="Re-evaluate if cost exceeds $10",
        )
        receipt = DecisionReceipt(
            decision_id="dec-2",
            action=GovernanceAction.ALLOW,
            issued_at=now,
            expires_at=now,
            revalidate_if=[condition],
        )
        assert len(receipt.revalidate_if) == 1
        assert receipt.revalidate_if[0].condition_type == "cost_exceeded"


class TestRevalidationCondition:
    """Tests for RevalidationCondition dataclass."""

    def test_creation(self):
        cond = RevalidationCondition(
            condition_type="time_elapsed",
            threshold=3600,
            description="Re-evaluate after 1 hour",
        )
        assert cond.condition_type == "time_elapsed"
        assert cond.threshold == 3600
        assert cond.description == "Re-evaluate after 1 hour"


class TestEscalationReceipt:
    """Tests for EscalationReceipt dataclass."""

    def test_creation(self):
        now = datetime.now(tz=timezone.utc)
        receipt = EscalationReceipt(
            decision_id="dec-refer-1",
            agent_id="agent-risky",
            tool_name="delete_database",
            tool_arguments={"db": "production"},
            conversation_id="conv-1",
            turn_id=3,
            group_chat_id="gc-1",
            risk_score=95,
            reason_codes=["HIGH_RISK_TOOL", "PRODUCTION_TARGET"],
            human_readable_summary="Agent attempted to delete production database",
            policy_context={"policy": "no_prod_delete"},
            issued_at=now,
            expires_at=None,
        )
        assert receipt.decision_id == "dec-refer-1"
        assert receipt.agent_id == "agent-risky"
        assert receipt.tool_name == "delete_database"
        assert receipt.tool_arguments == {"db": "production"}
        assert receipt.conversation_id == "conv-1"
        assert receipt.turn_id == 3
        assert receipt.group_chat_id == "gc-1"
        assert receipt.risk_score == 95
        assert receipt.reason_codes == ["HIGH_RISK_TOOL", "PRODUCTION_TARGET"]
        assert receipt.human_readable_summary == "Agent attempted to delete production database"
        assert receipt.policy_context == {"policy": "no_prod_delete"}
        assert receipt.issued_at == now
        assert receipt.expires_at is None


class TestBudgetState:
    """Tests for BudgetState dataclass."""

    def test_defaults(self):
        state = BudgetState(agent_id="agent-1", budget_limit=100.0)
        assert state.agent_id == "agent-1"
        assert state.budget_limit == 100.0
        assert state.current_spend == 0.0
        assert state.remaining_budget is None
        assert state.warning_emitted is False

    def test_no_limit(self):
        state = BudgetState(agent_id="agent-2", budget_limit=None)
        assert state.budget_limit is None

    def test_with_spend(self):
        state = BudgetState(
            agent_id="agent-3",
            budget_limit=50.0,
            current_spend=30.0,
            remaining_budget=20.0,
            warning_emitted=True,
        )
        assert state.current_spend == 30.0
        assert state.remaining_budget == 20.0
        assert state.warning_emitted is True


class TestSpeakerSelectionAuditEntry:
    """Tests for SpeakerSelectionAuditEntry dataclass."""

    def test_creation(self):
        entry = SpeakerSelectionAuditEntry(
            round_id="round-1",
            timestamp_ms=5000.0,
            candidates_evaluated=[
                {"agent_id": "a1", "decision": "ALLOW", "reason": "policy_allow"},
                {"agent_id": "a2", "decision": "DENY", "reason": "AGENT_FROZEN"},
            ],
            selected_speaker="a1",
            reason_codes=["POLICY_ALLOW"],
            group_chat_id="gc-1",
        )
        assert entry.round_id == "round-1"
        assert entry.timestamp_ms == 5000.0
        assert len(entry.candidates_evaluated) == 2
        assert entry.selected_speaker == "a1"
        assert entry.reason_codes == ["POLICY_ALLOW"]
        assert entry.group_chat_id == "gc-1"

    def test_no_speaker_selected(self):
        entry = SpeakerSelectionAuditEntry(
            round_id="round-2",
            timestamp_ms=6000.0,
            candidates_evaluated=[
                {"agent_id": "a1", "decision": "DENY", "reason": "AGENT_FROZEN"},
            ],
            selected_speaker=None,
            reason_codes=["ALL_SPEAKERS_DENIED"],
            group_chat_id="gc-1",
        )
        assert entry.selected_speaker is None
        assert "ALL_SPEAKERS_DENIED" in entry.reason_codes


class TestDenialMessage:
    """Tests for DenialMessage dataclass and to_reply_string method."""

    def test_creation(self):
        msg = DenialMessage(
            tool_name="send_email",
            action="DENY",
            reason="PII in arguments",
            risk_score=80,
            reason_codes=["PII_DETECTED", "SENSITIVE_DATA"],
            correlation_id="corr-123",
            decision_id="dec-456",
        )
        assert msg.tool_name == "send_email"
        assert msg.action == "DENY"
        assert msg.reason == "PII in arguments"
        assert msg.risk_score == 80
        assert msg.reason_codes == ["PII_DETECTED", "SENSITIVE_DATA"]
        assert msg.correlation_id == "corr-123"
        assert msg.decision_id == "dec-456"

    def test_to_reply_string_format(self):
        msg = DenialMessage(
            tool_name="delete_file",
            action="DENY",
            reason="High risk operation",
            risk_score=95,
            reason_codes=["HIGH_RISK", "PRODUCTION"],
            correlation_id="corr-abc",
            decision_id="dec-xyz",
        )
        result = msg.to_reply_string()
        assert result.startswith("[GOVERNANCE DENIAL]")
        assert "Tool: delete_file" in result
        assert "Action: DENY" in result
        assert "Risk: 95" in result
        assert "Reason: High risk operation" in result
        assert "Codes: HIGH_RISK,PRODUCTION" in result
        assert "Decision: dec-xyz" in result

    def test_to_reply_string_single_code(self):
        msg = DenialMessage(
            tool_name="read_db",
            action="DENY",
            reason="Unauthorized",
            risk_score=50,
            reason_codes=["UNAUTHORIZED"],
            correlation_id="corr-1",
            decision_id="dec-1",
        )
        result = msg.to_reply_string()
        assert "Codes: UNAUTHORIZED" in result

    def test_to_reply_string_parseable(self):
        """Verify the denial message is parseable by splitting on pipe delimiter."""
        msg = DenialMessage(
            tool_name="execute_sql",
            action="DENY",
            reason="SQL injection risk",
            risk_score=90,
            reason_codes=["SQL_INJECTION", "UNTRUSTED_INPUT"],
            correlation_id="corr-parse",
            decision_id="dec-parse",
        )
        result = msg.to_reply_string()
        parts = result.split(" | ")
        assert len(parts) == 6
        # Each part should be parseable to extract its value
        assert parts[0].startswith("[GOVERNANCE DENIAL] Tool: ")
        assert "execute_sql" in parts[0]
        assert parts[1].startswith("Action: ")
        assert parts[2].startswith("Risk: ")
        assert parts[3].startswith("Reason: ")
        assert parts[4].startswith("Codes: ")
        assert parts[5].startswith("Decision: ")
