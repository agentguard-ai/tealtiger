"""Example: healthcare-guard policy template."""

from __future__ import annotations

from haystack_integrations.components.connectors.tealtiger import (
    TealTigerGovernanceComponent,
)


def main() -> None:
    """Run PHI/PII redaction with the healthcare template."""
    guard = TealTigerGovernanceComponent(preset="healthcare-guard")
    result = guard.run(text="Patient Jane: jane@example.com, SSN 123-45-6789.")

    print(result["text"])
    print(result["decision"]["reason_codes"])


if __name__ == "__main__":
    main()
