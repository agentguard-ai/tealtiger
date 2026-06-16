"""Example: zero-config policy template."""

from __future__ import annotations

from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)


def main() -> None:
    """Run observe-only telemetry with the zero-config template."""
    guard = TealTigerGovernanceComponent(preset="zero-config")
    result = guard.run(text="Contact Jane at jane@example.com.")

    print(result["text"])
    print(result["decision"]["action"])


if __name__ == "__main__":
    main()
