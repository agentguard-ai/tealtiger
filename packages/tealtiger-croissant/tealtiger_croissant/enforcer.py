from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

import mlcroissant as mlc
from tealtiger.core.engine import PolicyMode, TealEngine

from .metadata import (
    extract_duo_codes,
    extract_odrl_actions,
    extract_odrl_constraints,
    extract_provenance,
)

_SUPPORTED_DUO_CODES = {"DUO_0000018", "DUO_0000042"}
_SUPPORTED_ODRL_ACTIONS = {"duo:0000006", "duo:0000007"}


def _reference_id(value: Any) -> str | None:
    if not isinstance(value, Mapping):
        return None
    reference = value.get("@id")
    return reference if isinstance(reference, str) else None


@dataclass(frozen=True)
class GovernanceDecision:
    action: Literal["ALLOW", "BLOCK"]
    timestamp: str
    correlation_id: str
    mode: PolicyMode
    reason_codes: tuple[str, ...] = ()
    provenance_verified: bool = False
    dataset_id: str | None = None
    policies_evaluated: int = 0
    audit_evidence: Mapping[str, Any] = field(default_factory=dict)

    def to_croissant_provenance(self) -> dict[str, Any]:
        """Export this decision as a PROV-O activity."""
        provenance = {
            "@context": {
                "@vocab": "https://github.com/agentguard-ai/tealtiger#",
                "prov": "http://www.w3.org/ns/prov#",
            },
            "@id": f"urn:uuid:{self.correlation_id}",
            "@type": "prov:Activity",
            "prov:wasAssociatedWith": {
                "@id": "https://github.com/agentguard-ai/tealtiger",
                "@type": "prov:SoftwareAgent",
                "name": "TealTiger Governance Engine",
            },
            "prov:generated": {
                "@id": f"urn:uuid:{self.correlation_id}:decision",
                "@type": "prov:Entity",
                "decision": self.action,
                "correlation_id": self.correlation_id,
                "reason_codes": list(self.reason_codes),
            },
            "prov:endedAtTime": self.timestamp,
        }
        if self.dataset_id is not None:
            provenance["prov:used"] = {
                "@id": self.dataset_id,
                "@type": "prov:Entity",
            }
        return provenance


class CroissantGovernanceEnforcer:
    def __init__(self, engine: TealEngine | None = None) -> None:
        self.engine = engine or TealEngine(policies={})

    def evaluate_access(
        self,
        dataset: mlc.Dataset | Mapping[str, Any],
        agent_context: Mapping[str, Any],
    ) -> GovernanceDecision:
        metadata = (
            dataset.metadata.to_json() if isinstance(dataset, mlc.Dataset) else dataset
        )
        duo_codes = extract_duo_codes(metadata)
        odrl_actions = extract_odrl_actions(metadata)
        odrl_constraints = extract_odrl_constraints(metadata)
        provenance = extract_provenance(metadata)
        dataset_id = next(
            (
                value
                for key in ("@id", "url", "name")
                if isinstance((value := metadata.get(key)), str)
            ),
            None,
        )
        reason_codes = []
        timestamp = datetime.now(timezone.utc).isoformat()
        engine_decision = self.engine.evaluate_with_mode(
            {
                "action": "croissant.dataset_access",
                "metadata": {"dataset_id": dataset_id},
            }
        )
        correlation_id = engine_decision.correlation_id

        if engine_decision.mode != PolicyMode.REPORT_ONLY:
            if any(code not in _SUPPORTED_DUO_CODES for code in duo_codes):
                reason_codes.append("UNSUPPORTED_DUO_CODE")

            if any(action not in _SUPPORTED_ODRL_ACTIONS for action in odrl_actions):
                reason_codes.append("UNSUPPORTED_ODRL_ACTION")

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

            if "duo:0000006" in odrl_actions and (
                agent_context.get("purpose") != "research"
                or agent_context.get("research_area")
                not in {"health", "medical", "biomedical"}
            ):
                reason_codes.append("ODRL_HEALTH_RESEARCH_USE_ONLY")

            if (
                "duo:0000007" in odrl_actions
                and agent_context.get("purpose") != "research"
            ):
                reason_codes.append("ODRL_DISEASE_RESEARCH_USE_ONLY")

            for constraint in odrl_constraints:
                left_operand = _reference_id(constraint.get("odrl:leftOperand"))
                operator = _reference_id(constraint.get("odrl:operator"))
                right_operand = _reference_id(constraint.get("odrl:rightOperand"))
                non_commercial = (
                    operator == "odrl:eq" and right_operand == "duo:0000018"
                )
                disease_specific = (
                    left_operand == "duo:0000010"
                    and operator == "odrl:eq"
                    and right_operand is not None
                    and right_operand.startswith("mondo:")
                )

                if (
                    non_commercial
                    and agent_context.get("org_type")
                    not in {"academic", "nonprofit"}
                    and "ODRL_NON_COMMERCIAL_ONLY" not in reason_codes
                ):
                    reason_codes.append("ODRL_NON_COMMERCIAL_ONLY")

                if (
                    disease_specific
                    and agent_context.get("disease_area") != right_operand
                    and "ODRL_DISEASE_SPECIFIC_USE_ONLY" not in reason_codes
                ):
                    reason_codes.append("ODRL_DISEASE_SPECIFIC_USE_ONLY")

                if not non_commercial and not disease_specific:
                    reason_codes.append("UNSUPPORTED_ODRL_CONSTRAINT")

        return GovernanceDecision(
            action=(
                "BLOCK"
                if reason_codes and engine_decision.mode == PolicyMode.ENFORCE
                else "ALLOW"
            ),
            timestamp=timestamp,
            correlation_id=correlation_id,
            mode=engine_decision.mode,
            reason_codes=tuple(reason_codes),
            provenance_verified=all(
                relationship in provenance
                for relationship in (
                    "wasDerivedFrom",
                    "wasGeneratedBy",
                    "wasAttributedTo",
                )
            ),
            dataset_id=dataset_id,
            policies_evaluated=(
                0
                if engine_decision.mode == PolicyMode.REPORT_ONLY
                else len(duo_codes)
                + len(odrl_actions)
                + len(odrl_constraints)
                + bool(provenance)
            ),
            audit_evidence={
                "croissant_policies": {
                    "duo_codes": duo_codes,
                    "odrl_actions": odrl_actions,
                    "odrl_constraints": odrl_constraints,
                    "provenance": provenance,
                    "license": metadata.get("license"),
                },
                "agent_context": dict(agent_context),
                "decision_reason": tuple(reason_codes),
                "mode": engine_decision.mode.value,
                "timestamp": timestamp,
                "correlation_id": correlation_id,
            },
        )
