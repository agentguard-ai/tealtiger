"""TealTiger → Phoenix (Arize) governance span exporter.

Exports TealTiger governance decisions as OpenTelemetry spans that Phoenix
auto-ingests, making governance enforcement visible inline with LLM traces
in the Phoenix UI. Answers "why didn't this tool call happen?" directly
in the trace viewer.

Usage:
    from phoenix.otel import register
    from tealtiger_phoenix import PhoenixGovernanceSpanExporter

    # Register Phoenix tracer
    tracer_provider = register(project_name="my-agent")

    # Create exporter
    exporter = PhoenixGovernanceSpanExporter()

    # Use with TealTiger observe()
    from tealtiger import observe
    client = observe(
        OpenAI(api_key=os.environ["OPENAI_API_KEY"]),
        guardrails={"pii_detection": True},
        on_decision=exporter.export,
    )

Requirements:
    pip install tealtiger-phoenix arize-phoenix-otel
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from opentelemetry import trace
from opentelemetry.trace import StatusCode, SpanKind


# Attribute namespace for governance spans
_OTEL_ATTR_PREFIX = "tealtiger.governance"
_SPAN_NAME = "tealtiger.governance.decision"


class PhoenixGovernanceSpanExporter:
    """Export TealTiger governance decisions as OpenTelemetry spans for Phoenix.

    Each governance decision creates a span in the active trace with attributes
    that Phoenix renders in its trace viewer:
    - Span name: "tealtiger.governance.decision"
    - Status: OK (ALLOW), ERROR (DENY), UNSET (MONITOR/OBSERVE)
    - Attributes: action, reason_codes, risk_score, tool_name, mode, cost, etc.

    Args:
        tracer_name: Name of the OTel tracer (default: "tealtiger.governance").
        span_name: Name for governance spans (default: "tealtiger.governance.decision").
        record_allows: Whether to create spans for ALLOW decisions (default: True).
            Set to False to only record DENY/MONITOR decisions (reduces noise).
        include_cost: Whether to include cost tracking attributes (default: True).

    Example:
        >>> from tealtiger_phoenix import PhoenixGovernanceSpanExporter
        >>> exporter = PhoenixGovernanceSpanExporter()
        >>> # Use as on_decision callback
        >>> exporter.export({"action": "DENY", "reason_codes": ["PII_DETECTED"]})
    """

    def __init__(
        self,
        tracer_name: str = "tealtiger.governance",
        span_name: str = _SPAN_NAME,
        record_allows: bool = True,
        include_cost: bool = True,
    ):
        self._tracer = trace.get_tracer(tracer_name)
        self._span_name = span_name
        self._record_allows = record_allows
        self._include_cost = include_cost
        self._decision_count: int = 0
        self._deny_count: int = 0

    def export(self, decision: Dict[str, Any]) -> None:
        """Export a governance decision as an OTel span.

        Designed to be used as the ``on_decision`` callback for TealTiger's
        observe(), TealEngine, or any governance callback.

        Args:
            decision: A TealTiger governance decision dict containing:
                - action: "ALLOW", "DENY", "MONITOR", or "REFER"
                - correlation_id: UUID v4 for the decision
                - Optional: reason_codes, risk_score, evaluation_time_ms,
                  tool_name, agent_id, session_id, mode, cost_tracked, etc.
        """
        action = decision.get("action", "ALLOW")

        # Skip ALLOW decisions if configured to reduce noise
        if action == "ALLOW" and not self._record_allows:
            return

        self._decision_count += 1
        if action == "DENY":
            self._deny_count += 1

        # Create span within current trace context
        with self._tracer.start_as_current_span(
            name=self._span_name,
            kind=SpanKind.INTERNAL,
        ) as span:
            # Core governance attributes
            span.set_attribute(f"{_OTEL_ATTR_PREFIX}.action", action)
            span.set_attribute(f"{_OTEL_ATTR_PREFIX}.mode", decision.get("mode", "OBSERVE"))
            span.set_attribute(
                f"{_OTEL_ATTR_PREFIX}.correlation_id",
                decision.get("correlation_id", ""),
            )

            # Risk and evaluation
            risk_score = decision.get("risk_score", 0)
            span.set_attribute(f"{_OTEL_ATTR_PREFIX}.risk_score", risk_score)
            span.set_attribute(
                f"{_OTEL_ATTR_PREFIX}.evaluation_time_ms",
                decision.get("evaluation_time_ms", 0),
            )

            # Reason codes
            reason_codes = decision.get("reason_codes", [])
            if reason_codes:
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.reason_codes", reason_codes)
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.reason", ", ".join(reason_codes))

            # Tool/agent context
            if "tool_name" in decision:
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.tool_name", decision["tool_name"])
            if "tool_slug" in decision:
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.tool_name", decision["tool_slug"])
            if "agent_id" in decision:
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.agent_id", decision["agent_id"])
            if "session_id" in decision:
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.session_id", decision["session_id"])

            # Cost tracking
            if self._include_cost:
                span.set_attribute(
                    f"{_OTEL_ATTR_PREFIX}.cost_tracked",
                    decision.get("cost_tracked", 0.0),
                )
                span.set_attribute(
                    f"{_OTEL_ATTR_PREFIX}.cumulative_cost",
                    decision.get("cumulative_cost", 0.0),
                )

            # Policy reference
            if "policy_digest" in decision:
                span.set_attribute(
                    f"{_OTEL_ATTR_PREFIX}.policy_digest", decision["policy_digest"]
                )
            if "policy_ref" in decision:
                span.set_attribute(f"{_OTEL_ATTR_PREFIX}.policy_ref", decision["policy_ref"])

            # PII detection details
            if "pii_detected" in decision:
                pii = decision["pii_detected"]
                if isinstance(pii, list) and pii:
                    span.set_attribute(f"{_OTEL_ATTR_PREFIX}.pii_detected", pii)

            # Set span status based on governance action
            if action == "DENY":
                reason_msg = ", ".join(reason_codes) if reason_codes else "Policy denied"
                span.set_status(StatusCode.ERROR, reason_msg)
            elif action in ("MONITOR", "REFER"):
                span.set_status(StatusCode.UNSET)
            else:
                span.set_status(StatusCode.OK)

            # Add event for denied actions (more visible in Phoenix UI)
            if action == "DENY":
                span.add_event(
                    "governance.denied",
                    attributes={
                        "tool": decision.get("tool_name", decision.get("tool_slug", "")),
                        "reason": ", ".join(reason_codes),
                        "risk_score": risk_score,
                    },
                )

    def export_batch(self, decisions: List[Dict[str, Any]]) -> None:
        """Export multiple governance decisions as spans.

        Args:
            decisions: List of TealTiger governance decision dicts.
        """
        for decision in decisions:
            self.export(decision)

    @property
    def decision_count(self) -> int:
        """Total number of decisions exported."""
        return self._decision_count

    @property
    def deny_count(self) -> int:
        """Number of DENY decisions exported."""
        return self._deny_count

    def reset_counters(self) -> None:
        """Reset internal counters."""
        self._decision_count = 0
        self._deny_count = 0
