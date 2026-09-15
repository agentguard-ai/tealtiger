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
        reason_codes = []

        if (
            "DUO_0000018" in duo_codes
            and agent_context.get("org_type") not in {"academic", "nonprofit"}
        ):
            reason_codes.append("DUO_0000018_NON_COMMERCIAL_ONLY")

        if (
            "DUO_0000042" in duo_codes
            and agent_context.get("purpose") != "research"
        ):
            reason_codes.append("DUO_0000042_GENERAL_RESEARCH_USE_ONLY")

        return GovernanceDecision(
            action="BLOCK" if reason_codes else "ALLOW",
            reason_codes=tuple(reason_codes),
        )
