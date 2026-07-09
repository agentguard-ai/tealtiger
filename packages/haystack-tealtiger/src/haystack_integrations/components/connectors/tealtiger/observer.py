"""Zero-risk, zero-config observer component for TealTiger."""

from __future__ import annotations

from typing import Any

from haystack import component, logging

from haystack_integrations.components.connectors.tealtiger.governance_component import (
    TealTigerGovernanceComponent,
)
from haystack_integrations.components.connectors.tealtiger.guard_component import (
    TealTigerGuardComponent,
)

logger = logging.getLogger(__name__)


@component
class TealTigerObserver:
    """Zero-risk, zero-config observer component for TealTiger.

    Sits in any pipeline, monitors everything (cost, PII, prompt injections),
    and blocks nothing. Passthrough 100% of traffic.
    """

    def __init__(self, cost_per_1k_tokens: float = 0.002) -> None:
        """Initialize the observer component.

        Args:
            cost_per_1k_tokens: Estimated cost per 1000 tokens for cost tracking.
                                Defaults to $0.002.
        """
        # Internal components for observation
        self._governance = TealTigerGovernanceComponent(
            mode="OBSERVE", cost_per_1k_tokens=cost_per_1k_tokens
        )
        self._guard = TealTigerGuardComponent(mode="refer")

        # Telemetry
        self._invocations = 0
        self._total_cost = 0.0
        self._pii_detections = 0
        self._injection_attempts = 0

    @component.output_types(text=str)
    def run(self, text: str, token_usage: dict[str, int] | None = None) -> dict[str, Any]:
        """Observe input text and pass it through unchanged.

        Args:
            text: Input text to observe.
            token_usage: Optional token usage for actual cost calculation.

        Returns:
            Dictionary with the exact same input text.
        """
        self._invocations += 1

        try:
            # Observe cost and PII
            gov_res = self._governance.run(text=text, token_usage=token_usage)
            decision = gov_res.get("decision", {})
            self._total_cost += decision.get("cost_tracked", 0.0)
            self._pii_detections += len(decision.get("pii_detected", []))

            # Observe prompt injections
            guard_res = self._guard.run(text=text)
            if guard_res.get("blocked", False):
                # Even in 'refer' mode, the guard component sets blocked=True if findings exist
                self._injection_attempts += len(guard_res.get("findings", []))

        except Exception as e:
            # Observer must never break the pipeline
            logger.warning("TealTigerObserver encountered an error but failed-open: {error}", error=str(e))

        # Zero behavior change
        return {"text": text}

    def report(self) -> dict[str, Any]:
        """Return actionable telemetry collected by the observer.
        
        Returns:
            Dictionary with invocation count, cost, PII, and injection stats.
        """
        return {
            "invocations": self._invocations,
            "total_cost": self._total_cost,
            "pii_detections": self._pii_detections,
            "injection_attempts": self._injection_attempts,
        }

    def reset(self) -> None:
        """Reset the observer telemetry."""
        self._invocations = 0
        self._total_cost = 0.0
        self._pii_detections = 0
        self._injection_attempts = 0
        self._governance.reset()
        self._guard.reset()
