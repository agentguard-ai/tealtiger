from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from .metadata import extract_duo_codes


@dataclass(frozen=True)
class GovernanceDecision:
    action: Literal["ALLOW", "BLOCK"]
    reason_codes: tuple[str, ...] = ()


class CroissantGovernanceEnforcer:
    def evaluate_access(
        self,
        metadata: Mapping[str, Any],
        agent_context: Mapping[str, Any],
    ) -> GovernanceDecision:
        duo_codes = extract_duo_codes(metadata)

        if (
            "DUO_0000018" in duo_codes
            and agent_context.get("org_type") not in {"academic", "nonprofit"}
        ):
            return GovernanceDecision(
                action="BLOCK",
                reason_codes=("DUO_0000018_NON_COMMERCIAL_ONLY",),
            )

        return GovernanceDecision(action="ALLOW")
