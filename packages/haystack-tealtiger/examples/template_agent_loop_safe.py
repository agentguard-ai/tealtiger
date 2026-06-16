"""Example: agent-loop-safe policy template."""

from __future__ import annotations

from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)


def main() -> None:
    """Run budget enforcement with the agent loop template."""
    guard = TealTigerGovernanceComponent(
        preset="agent-loop-safe",
        cost_per_1k_tokens=1.0,
        anomaly_threshold=20_000,
        raise_on_deny=False,
    )
    result = guard.run(text="tool output", token_usage={"total_tokens": 501})

    print(result["decision"]["action"])
    print(result["decision"]["reason_codes"])


if __name__ == "__main__":
    main()
