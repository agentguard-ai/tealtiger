"""Example: eu-ai-act policy template."""

from __future__ import annotations

from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)


def main() -> None:
    """Run high-risk decision escalation with the EU AI Act template."""
    guard = TealTigerGovernanceComponent(
        preset="eu-ai-act",
        raise_on_deny=False,
    )
    result = guard.run(text="Automatically reject this candidate for hiring.")

    print(result["decision"]["action"])
    print(result["decision"]["metadata"]["human_escalation"])


if __name__ == "__main__":
    main()
