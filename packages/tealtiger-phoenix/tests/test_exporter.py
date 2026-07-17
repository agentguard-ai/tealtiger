"""Tests for tealtiger-phoenix governance span exporter."""

import pytest
from unittest.mock import MagicMock, patch
from contextlib import contextmanager


def _make_mock_tracer():
    """Create a mock OTel tracer with proper context manager support."""
    tracer = MagicMock()
    mock_span = MagicMock()

    @contextmanager
    def _span_cm(*args, **kwargs):
        yield mock_span

    tracer.start_as_current_span = MagicMock(side_effect=_span_cm)
    return tracer, mock_span


def _make_exporter(**kwargs):
    """Create exporter with mocked tracer."""
    tracer, mock_span = _make_mock_tracer()
    with patch("opentelemetry.trace.get_tracer", return_value=tracer):
        from tealtiger_phoenix import PhoenixGovernanceSpanExporter
        exporter = PhoenixGovernanceSpanExporter(**kwargs)
    return exporter, tracer, mock_span


class TestAllowDecisions:
    def test_allow_creates_ok_span(self):
        exporter, tracer, span = _make_exporter()

        exporter.export({
            "action": "ALLOW",
            "correlation_id": "a1",
            "tool_name": "google_search",
            "mode": "ENFORCE",
            "risk_score": 0,
            "evaluation_time_ms": 0.3,
        })

        tracer.start_as_current_span.assert_called_once()
        from opentelemetry.trace import StatusCode
        span.set_status.assert_called_with(StatusCode.OK)
        span.set_attribute.assert_any_call("tealtiger.governance.action", "ALLOW")
        span.set_attribute.assert_any_call("tealtiger.governance.tool_name", "google_search")

    def test_skip_allow_when_record_allows_false(self):
        exporter, tracer, _ = _make_exporter(record_allows=False)

        exporter.export({"action": "ALLOW", "correlation_id": "skip"})
        tracer.start_as_current_span.assert_not_called()
        assert exporter.decision_count == 0


class TestDenyDecisions:
    def test_deny_creates_error_span(self):
        exporter, _, span = _make_exporter()

        exporter.export({
            "action": "DENY",
            "correlation_id": "d1",
            "tool_name": "send_email",
            "reason_codes": ["PII_DETECTED:ssn"],
            "risk_score": 90,
            "mode": "ENFORCE",
        })

        from opentelemetry.trace import StatusCode
        span.set_status.assert_called_with(StatusCode.ERROR, "PII_DETECTED:ssn")
        span.add_event.assert_called_once()
        assert span.add_event.call_args[0][0] == "governance.denied"

    def test_deny_recorded_when_record_allows_false(self):
        exporter, tracer, _ = _make_exporter(record_allows=False)

        exporter.export({"action": "DENY", "correlation_id": "d2", "reason_codes": ["X"]})
        tracer.start_as_current_span.assert_called_once()


class TestMonitorDecisions:
    def test_monitor_creates_unset_span(self):
        exporter, _, span = _make_exporter()

        exporter.export({
            "action": "MONITOR",
            "correlation_id": "m1",
            "reason_codes": ["COST_WARNING"],
            "risk_score": 50,
            "mode": "MONITOR",
        })

        from opentelemetry.trace import StatusCode
        span.set_status.assert_called_with(StatusCode.UNSET)


class TestAttributes:
    def test_cost_tracking(self):
        exporter, _, span = _make_exporter(include_cost=True)

        exporter.export({
            "action": "ALLOW",
            "correlation_id": "c1",
            "cost_tracked": 0.005,
            "cumulative_cost": 1.50,
        })

        span.set_attribute.assert_any_call("tealtiger.governance.cost_tracked", 0.005)
        span.set_attribute.assert_any_call("tealtiger.governance.cumulative_cost", 1.50)

    def test_cost_excluded_when_disabled(self):
        exporter, _, span = _make_exporter(include_cost=False)

        exporter.export({
            "action": "ALLOW",
            "correlation_id": "c2",
            "cost_tracked": 0.01,
        })

        attr_names = [c[0][0] for c in span.set_attribute.call_args_list]
        assert "tealtiger.governance.cost_tracked" not in attr_names

    def test_policy_digest(self):
        exporter, _, span = _make_exporter()

        exporter.export({
            "action": "DENY",
            "correlation_id": "p1",
            "reason_codes": ["TOOL_NOT_ALLOWED"],
            "policy_digest": "sha256:abc123",
        })

        span.set_attribute.assert_any_call("tealtiger.governance.policy_digest", "sha256:abc123")

    def test_pii_detected(self):
        exporter, _, span = _make_exporter()

        exporter.export({
            "action": "DENY",
            "correlation_id": "pii1",
            "reason_codes": ["PII"],
            "pii_detected": ["ssn", "credit_card"],
        })

        span.set_attribute.assert_any_call("tealtiger.governance.pii_detected", ["ssn", "credit_card"])

    def test_span_kind_internal(self):
        exporter, tracer, _ = _make_exporter()

        exporter.export({"action": "ALLOW", "correlation_id": "k1"})

        from opentelemetry.trace import SpanKind
        call_kwargs = tracer.start_as_current_span.call_args[1]
        assert call_kwargs["kind"] == SpanKind.INTERNAL

    def test_custom_span_name(self):
        exporter, tracer, _ = _make_exporter(span_name="custom.span")

        exporter.export({"action": "ALLOW", "correlation_id": "n1"})

        call_kwargs = tracer.start_as_current_span.call_args[1]
        assert call_kwargs["name"] == "custom.span"


class TestBatchAndCounters:
    def test_export_batch(self):
        exporter, tracer, _ = _make_exporter()

        exporter.export_batch([
            {"action": "ALLOW", "correlation_id": "b1"},
            {"action": "DENY", "correlation_id": "b2", "reason_codes": ["X"]},
            {"action": "ALLOW", "correlation_id": "b3"},
        ])

        assert tracer.start_as_current_span.call_count == 3
        assert exporter.decision_count == 3
        assert exporter.deny_count == 1

    def test_counters(self):
        exporter, _, _ = _make_exporter()

        exporter.export({"action": "ALLOW", "correlation_id": "1"})
        exporter.export({"action": "DENY", "correlation_id": "2", "reason_codes": ["A"]})
        exporter.export({"action": "DENY", "correlation_id": "3", "reason_codes": ["B"]})

        assert exporter.decision_count == 3
        assert exporter.deny_count == 2

    def test_reset_counters(self):
        exporter, _, _ = _make_exporter()

        exporter.export({"action": "DENY", "correlation_id": "r1", "reason_codes": ["Z"]})
        exporter.reset_counters()

        assert exporter.decision_count == 0
        assert exporter.deny_count == 0
