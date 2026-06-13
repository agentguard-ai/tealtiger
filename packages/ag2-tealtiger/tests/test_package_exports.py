"""Tests for top-level __init__.py exports.

Verifies that all public API symbols are importable from ag2_tealtiger
as specified in Requirement 14.3.
"""

import ag2_tealtiger


class TestTopLevelImports:
    """Verify all exports are accessible as top-level imports."""

    def test_core_components_importable(self) -> None:
        """TealTigerGuard, TealTigerAuditAgent, GovernedGroupChat are top-level."""
        from ag2_tealtiger import TealTigerGuard
        from ag2_tealtiger import TealTigerAuditAgent
        from ag2_tealtiger import GovernedGroupChat

        assert TealTigerGuard is not None
        assert TealTigerAuditAgent is not None
        assert GovernedGroupChat is not None

    def test_managers_importable(self) -> None:
        """DecisionReceiptManager and BudgetStateManager for advanced usage."""
        from ag2_tealtiger import DecisionReceiptManager
        from ag2_tealtiger import BudgetStateManager
        from ag2_tealtiger import BudgetCheckResult

        assert DecisionReceiptManager is not None
        assert BudgetStateManager is not None
        assert BudgetCheckResult is not None

    def test_enums_importable(self) -> None:
        """All enums are top-level exports."""
        from ag2_tealtiger import GovernanceAction, GovernanceMode, ActionKind, DecisionSource

        assert GovernanceAction.ALLOW == "ALLOW"
        assert GovernanceMode.ENFORCE == "ENFORCE"
        assert ActionKind.TOOL_CALL == "tool_call"
        assert DecisionSource.POLICY_ENGINE == "policy_engine"

    def test_data_types_importable(self) -> None:
        """All dataclasses are top-level exports."""
        from ag2_tealtiger import (
            TEECContext,
            AuditEntry,
            DecisionReceipt,
            RevalidationCondition,
            EscalationReceipt,
            BudgetState,
            SpeakerSelectionAuditEntry,
            DenialMessage,
        )

        assert TEECContext is not None
        assert AuditEntry is not None
        assert DecisionReceipt is not None
        assert RevalidationCondition is not None
        assert EscalationReceipt is not None
        assert BudgetState is not None
        assert SpeakerSelectionAuditEntry is not None
        assert DenialMessage is not None

    def test_exceptions_importable(self) -> None:
        """All exceptions are top-level exports."""
        from ag2_tealtiger import (
            AG2TealTigerError,
            GovernanceDenyError,
            DecisionExpiredError,
            BudgetExceededError,
            AgentFrozenError,
            EscalationPendingError,
        )

        assert issubclass(GovernanceDenyError, AG2TealTigerError)
        assert issubclass(BudgetExceededError, GovernanceDenyError)
        assert issubclass(AgentFrozenError, GovernanceDenyError)
        assert issubclass(DecisionExpiredError, AG2TealTigerError)
        assert issubclass(EscalationPendingError, AG2TealTigerError)

    def test_utilities_importable(self) -> None:
        """Utility functions are top-level exports."""
        from ag2_tealtiger import compute_params_hash, derive_idempotency_key

        # Quick smoke test
        h = compute_params_hash({"key": "value"})
        assert isinstance(h, str)
        assert len(h) == 64  # SHA-256 hex digest

        k = derive_idempotency_key("decision-1", h)
        assert isinstance(k, str)
        assert len(k) == 64

    def test_all_list_matches_exports(self) -> None:
        """__all__ contains exactly the expected public API symbols."""
        expected = {
            "TealTigerGuard",
            "TealTigerAuditAgent",
            "GovernedGroupChat",
            "DecisionReceiptManager",
            "BudgetStateManager",
            "BudgetCheckResult",
            "GovernanceAction",
            "GovernanceMode",
            "ActionKind",
            "DecisionSource",
            "TEECContext",
            "AuditEntry",
            "DecisionReceipt",
            "RevalidationCondition",
            "EscalationReceipt",
            "BudgetState",
            "SpeakerSelectionAuditEntry",
            "DenialMessage",
            "AG2TealTigerError",
            "GovernanceDenyError",
            "DecisionExpiredError",
            "BudgetExceededError",
            "AgentFrozenError",
            "EscalationPendingError",
            "compute_params_hash",
            "derive_idempotency_key",
        }
        assert set(ag2_tealtiger.__all__) == expected

    def test_guard_instantiation_no_engine(self) -> None:
        """TealTigerGuard can be instantiated in observe mode without args."""
        from ag2_tealtiger import TealTigerGuard

        guard = TealTigerGuard()
        assert guard is not None
