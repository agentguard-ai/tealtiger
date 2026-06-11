"""Property test: Denial Message Parseability (Property 14).

**Property 14:** For any denied tool call in ENFORCE mode, the returned denial
message SHALL contain the tool_name, reason, risk_score, reason_codes, and
decision_id in a structured format that can be parsed to extract each field
independently.

**Validates: Requirements 7.6, 10.1, 10.2, 10.3**

Uses Hypothesis to generate arbitrary DenialMessage instances and verify that
the formatted string contains all fields in the expected parseable pattern:
[GOVERNANCE DENIAL] Tool: {tool_name} | Action: {action} | Risk: {risk_score} | Reason: {reason} | Codes: {codes} | Decision: {decision_id}
"""

from __future__ import annotations

import re

import pytest
from hypothesis import given, settings

from ag2_tealtiger.types import DenialMessage

from .strategies import denial_messages


# ── Parsing helpers ───────────────────────────────────────────────────────────

# Regex pattern matching the expected denial message format
DENIAL_PATTERN = re.compile(
    r"\[GOVERNANCE DENIAL\] "
    r"Tool: (?P<tool_name>.+?) \| "
    r"Action: (?P<action>.+?) \| "
    r"Risk: (?P<risk_score>\d+) \| "
    r"Reason: (?P<reason>.+?) \| "
    r"Codes: (?P<codes>.+?) \| "
    r"Decision: (?P<decision_id>.+)"
)


def parse_denial_message(formatted: str) -> dict[str, str] | None:
    """Parse a formatted denial message string back into its component fields.

    Returns a dict with keys: tool_name, action, risk_score, reason, codes, decision_id.
    Returns None if the string does not match the expected pattern.
    """
    match = DENIAL_PATTERN.match(formatted)
    if match is None:
        return None
    return match.groupdict()


# ── Property 14: Denial Message Parseability ──────────────────────────────────


@pytest.mark.property
class TestDenialMessageParseability:
    """Property 14: Denied tool calls produce structured messages with parseable fields."""

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_matches_structured_pattern(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, to_reply_string() produces output matching the governance denial pattern.

        **Validates: Requirements 7.6, 10.1, 10.2, 10.3**
        """
        formatted = denial.to_reply_string()

        # The formatted string must match the structured pattern
        parsed = parse_denial_message(formatted)
        assert parsed is not None, (
            f"Denial message does not match expected pattern.\n"
            f"Got: {formatted!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_contains_tool_name(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, the formatted string contains the original tool_name extractable by parsing.

        **Validates: Requirements 10.1**
        """
        formatted = denial.to_reply_string()
        parsed = parse_denial_message(formatted)

        assert parsed is not None
        assert parsed["tool_name"] == denial.tool_name, (
            f"Parsed tool_name {parsed['tool_name']!r} != original {denial.tool_name!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_contains_risk_score(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, the formatted string contains the original risk_score as an integer.

        **Validates: Requirements 10.1**
        """
        formatted = denial.to_reply_string()
        parsed = parse_denial_message(formatted)

        assert parsed is not None
        assert int(parsed["risk_score"]) == denial.risk_score, (
            f"Parsed risk_score {parsed['risk_score']} != original {denial.risk_score}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_contains_reason(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, the formatted string contains the original reason.

        **Validates: Requirements 10.1**
        """
        formatted = denial.to_reply_string()
        parsed = parse_denial_message(formatted)

        assert parsed is not None
        assert parsed["reason"] == denial.reason, (
            f"Parsed reason {parsed['reason']!r} != original {denial.reason!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_contains_reason_codes(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, the formatted string contains comma-joined reason_codes that can be split back.

        **Validates: Requirements 10.1, 10.2**
        """
        formatted = denial.to_reply_string()
        parsed = parse_denial_message(formatted)

        assert parsed is not None
        parsed_codes = parsed["codes"].split(",")
        assert parsed_codes == denial.reason_codes, (
            f"Parsed reason_codes {parsed_codes} != original {denial.reason_codes}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_contains_decision_id(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, the formatted string contains the decision_id for audit trail lookup.

        **Validates: Requirements 10.3**
        """
        formatted = denial.to_reply_string()
        parsed = parse_denial_message(formatted)

        assert parsed is not None
        assert parsed["decision_id"] == denial.decision_id, (
            f"Parsed decision_id {parsed['decision_id']!r} != original {denial.decision_id!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(denial=denial_messages())
    def test_denial_message_all_fields_round_trip(
        self,
        denial: DenialMessage,
    ) -> None:
        """For any DenialMessage, all fields survive a format-then-parse round trip.

        This is the comprehensive property: generating a denial message, formatting it,
        then parsing it back yields the exact original values for all fields.

        **Validates: Requirements 7.6, 10.1, 10.2, 10.3**
        """
        formatted = denial.to_reply_string()
        parsed = parse_denial_message(formatted)

        assert parsed is not None, (
            f"Denial message not parseable: {formatted!r}"
        )

        # Verify all fields round-trip correctly
        assert parsed["tool_name"] == denial.tool_name
        assert parsed["action"] == denial.action
        assert int(parsed["risk_score"]) == denial.risk_score
        assert parsed["reason"] == denial.reason
        assert parsed["codes"].split(",") == denial.reason_codes
        assert parsed["decision_id"] == denial.decision_id
