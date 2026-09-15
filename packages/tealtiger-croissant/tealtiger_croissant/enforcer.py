from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from .metadata import extract_duo_codes, extract_odrl_constraints, extract_provenance


@dataclass(frozen=True)
class GovernanceDecision:
    action: Literal["ALLOW", "BLOCK"]
    reason_codes: tuple[str, ...] = ()
    provenance_verified: bool = False


class CroissantGovernanceEnforcer:
    def evaluate_access(
        self,
        metadata: Mapping[str, Any],
        agent_context: Mapping[str, Any],
    ) -> GovernanceDecision:
        duo_codes = extract_duo_codes(metadata)
        provenance = extract_provenance(metadata)
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

        for constraint in extract_odrl_constraints(metadata):
            left_operand = constraint.get("odrl:leftOperand")
            operator = constraint.get("odrl:operator")
            right_operand = constraint.get("odrl:rightOperand")
            if (
                isinstance(operator, Mapping)
                and operator.get("@id") == "odrl:eq"
                and isinstance(right_operand, Mapping)
                and right_operand.get("@id") == "duo:0000018"
                and agent_context.get("org_type") not in {"academic", "nonprofit"}
                and "ODRL_NON_COMMERCIAL_ONLY" not in reason_codes
            ):
                reason_codes.append("ODRL_NON_COMMERCIAL_ONLY")

            disease_area = (
                right_operand.get("@id") if isinstance(right_operand, Mapping) else None
            )
            if (
                isinstance(left_operand, Mapping)
                and left_operand.get("@id") == "duo:0000010"
                and isinstance(operator, Mapping)
                and operator.get("@id") == "odrl:eq"
                and isinstance(disease_area, str)
                and disease_area.startswith("mondo:")
                and agent_context.get("disease_area") != disease_area
                and "ODRL_DISEASE_SPECIFIC_USE_ONLY" not in reason_codes
            ):
                reason_codes.append("ODRL_DISEASE_SPECIFIC_USE_ONLY")

        return GovernanceDecision(
            action="BLOCK" if reason_codes else "ALLOW",
            reason_codes=tuple(reason_codes),
            provenance_verified=all(
                relationship in provenance
                for relationship in (
                    "wasDerivedFrom",
                    "wasGeneratedBy",
                    "wasAttributedTo",
                )
            ),
        )
