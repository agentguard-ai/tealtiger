from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

import mlcroissant as mlc
from tealtiger.core.engine import PolicyMode, TealEngine

from .metadata import (
    extract_duo_codes,
    extract_odrl_constraints,
    extract_odrl_obligations,
    extract_odrl_permissions,
    extract_odrl_prohibitions,
    extract_provenance,
    extract_provenance_records,
    is_governance_metadata_valid,
)

_SUPPORTED_DUO_CODES = {
    "DUO_0000004",  # no restriction
    "DUO_0000006",  # health/medical/biomedical research
    "DUO_0000007",  # disease-specific research
    "DUO_0000015",  # no methods development research
    "DUO_0000018",  # not-for-profit, non-commercial use
    "DUO_0000020",  # collaboration required
    "DUO_0000021",  # ethics approval required
    "DUO_0000042",  # general research use
    "DUO_0000046",  # non-commercial use only
}
_SUPPORTED_ODRL_DUO_ACTIONS = {"duo:0000006", "duo:0000007"}
_ODRL_OBLIGATION_EVIDENCE = {
    "odrl:attribute": "attribution_provided",
    "odrl:compensate": "compensation_provided",
    "odrl:inform": "notice_provided",
    "odrl:obtainConsent": "consent_obtained",
    "odrl:reviewPolicy": "policy_reviewed",
}
_NON_COMMERCIAL_ORGS = {"academic", "nonprofit"}
_NON_COMMERCIAL_PURPOSES = {"evaluation", "research"}
_HEALTH_RESEARCH_AREAS = {"biomedical", "health", "medical"}
_NON_METHODS_USE_CASES = {"analysis", "benchmarking", "model_training"}
_PROVENANCE_RELATIONSHIPS = (
    "wasDerivedFrom",
    "wasGeneratedBy",
    "wasAttributedTo",
)


def _reference_id(value: Any) -> str | None:
    if not isinstance(value, Mapping):
        return None
    reference = value.get("@id")
    return reference if isinstance(reference, str) else None


def _duo_violations(
    duo_codes: tuple[str, ...], agent_context: Mapping[str, Any]
) -> list[str]:
    violations = []
    if "DUO_0000006" in duo_codes and (
        agent_context.get("purpose") != "research"
        or agent_context.get("research_area") not in _HEALTH_RESEARCH_AREAS
    ):
        violations.append("DUO_0000006_HEALTH_RESEARCH_ONLY")
    if "DUO_0000007" in duo_codes and (
        agent_context.get("purpose") != "research"
        or not agent_context.get("disease_area")
    ):
        violations.append("DUO_0000007_DISEASE_SPECIFIC_RESEARCH_ONLY")
    if (
        "DUO_0000015" in duo_codes
        and agent_context.get("use_case") not in _NON_METHODS_USE_CASES
    ):
        violations.append("DUO_0000015_METHODS_RESEARCH_PROHIBITED")
    if "DUO_0000018" in duo_codes and (
        agent_context.get("org_type") not in _NON_COMMERCIAL_ORGS
        or agent_context.get("purpose") not in _NON_COMMERCIAL_PURPOSES
    ):
        violations.append("DUO_0000018_NON_COMMERCIAL_ONLY")
    if (
        "DUO_0000020" in duo_codes
        and agent_context.get("collaborator_agreement") is not True
    ):
        violations.append("DUO_0000020_COLLABORATION_REQUIRED")
    if (
        "DUO_0000021" in duo_codes
        and agent_context.get("ethics_review") is not True
    ):
        violations.append("DUO_0000021_ETHICS_APPROVAL_REQUIRED")
    if (
        "DUO_0000042" in duo_codes
        and agent_context.get("purpose") != "research"
    ):
        violations.append("DUO_0000042_GENERAL_RESEARCH_USE_ONLY")
    if (
        "DUO_0000046" in duo_codes
        and agent_context.get("purpose") not in _NON_COMMERCIAL_PURPOSES
    ):
        violations.append("DUO_0000046_NON_COMMERCIAL_USE_ONLY")
    return violations


def _rule_action_ids(rules: tuple[Mapping[str, Any], ...]) -> tuple[str, ...]:
    return tuple(
        action_id
        for rule in rules
        for action in (
            rule.get("odrl:action")
            if isinstance(rule.get("odrl:action"), list)
            else [rule.get("odrl:action")]
        )
        if (action_id := _reference_id(action)) is not None
    )


def _append_once(reason_codes: list[str], reason_code: str) -> None:
    if reason_code not in reason_codes:
        reason_codes.append(reason_code)


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
        if not isinstance(dataset, (mlc.Dataset, Mapping)):
            raise TypeError("dataset must be an mlcroissant.Dataset or metadata mapping")
        if not isinstance(agent_context, Mapping):
            raise TypeError("agent_context must be a mapping")

        metadata = (
            dataset.metadata.to_json() if isinstance(dataset, mlc.Dataset) else dataset
        )
        duo_codes = extract_duo_codes(metadata)
        odrl_permissions = extract_odrl_permissions(metadata)
        odrl_prohibitions = extract_odrl_prohibitions(metadata)
        odrl_obligations = extract_odrl_obligations(metadata)
        odrl_actions = _rule_action_ids(odrl_permissions)
        odrl_prohibition_actions = _rule_action_ids(odrl_prohibitions)
        odrl_obligation_actions = _rule_action_ids(odrl_obligations)
        odrl_constraints = extract_odrl_constraints(metadata)
        provenance = extract_provenance(metadata)
        provenance_records = extract_provenance_records(metadata)
        provenance_gaps = tuple(
            {
                "path": record["path"],
                "entity_id": record["entity_id"],
                "missing": tuple(
                    relationship
                    for relationship in _PROVENANCE_RELATIONSHIPS
                    if relationship not in record["relationships"]
                ),
            }
            for record in provenance_records
            if any(
                relationship not in record["relationships"]
                for relationship in _PROVENANCE_RELATIONSHIPS
            )
        )
        metadata_valid = is_governance_metadata_valid(metadata)
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
            if not metadata_valid:
                reason_codes.append("INVALID_GOVERNANCE_METADATA")

            if any(code not in _SUPPORTED_DUO_CODES for code in duo_codes):
                reason_codes.append("UNSUPPORTED_DUO_CODE")

            if any(
                action.startswith("duo:")
                and action not in _SUPPORTED_ODRL_DUO_ACTIONS
                for action in odrl_actions
            ):
                reason_codes.append("UNSUPPORTED_ODRL_ACTION")

            reason_codes.extend(_duo_violations(duo_codes, agent_context))

            if "duo:0000006" in odrl_actions and (
                agent_context.get("purpose") != "research"
                or agent_context.get("research_area")
                not in _HEALTH_RESEARCH_AREAS
            ):
                reason_codes.append("ODRL_HEALTH_RESEARCH_USE_ONLY")

            if (
                "duo:0000007" in odrl_actions
                and agent_context.get("purpose") != "research"
            ):
                reason_codes.append("ODRL_DISEASE_RESEARCH_USE_ONLY")

            requested_action = agent_context.get("action")
            operational_permissions = {
                action for action in odrl_actions if not action.startswith("duo:")
            }
            if operational_permissions:
                if not isinstance(requested_action, str):
                    reason_codes.append("ODRL_REQUEST_ACTION_REQUIRED")
                elif requested_action not in operational_permissions:
                    reason_codes.append("ODRL_ACTION_NOT_PERMITTED")

            if odrl_prohibition_actions:
                if not isinstance(requested_action, str):
                    _append_once(reason_codes, "ODRL_REQUEST_ACTION_REQUIRED")
                elif requested_action in odrl_prohibition_actions:
                    reason_codes.append("ODRL_ACTION_PROHIBITED")

            for action in odrl_obligation_actions:
                evidence_field = _ODRL_OBLIGATION_EVIDENCE.get(action)
                if evidence_field is None:
                    _append_once(
                        reason_codes, "UNSUPPORTED_ODRL_OBLIGATION_ACTION"
                    )
                elif agent_context.get(evidence_field) is not True:
                    _append_once(reason_codes, "ODRL_OBLIGATION_NOT_FULFILLED")

            if extract_odrl_constraints(metadata, "odrl:prohibition") or any(
                "odrl:constraint" in obligation for obligation in odrl_obligations
            ):
                _append_once(reason_codes, "UNSUPPORTED_ODRL_CONSTRAINT")

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
                    and (
                        agent_context.get("org_type") not in _NON_COMMERCIAL_ORGS
                        or agent_context.get("purpose")
                        not in _NON_COMMERCIAL_PURPOSES
                    )
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
            provenance_verified=bool(provenance_records) and not provenance_gaps,
            dataset_id=dataset_id,
            policies_evaluated=(
                0
                if engine_decision.mode == PolicyMode.REPORT_ONLY
                else len(duo_codes)
                + len(odrl_actions)
                + len(odrl_prohibition_actions)
                + len(odrl_obligation_actions)
                + len(odrl_constraints)
                + len(provenance_records)
            ),
            audit_evidence={
                "croissant_policies": {
                    "duo_codes": duo_codes,
                    "odrl_actions": odrl_actions,
                    "odrl_prohibition_actions": odrl_prohibition_actions,
                    "odrl_obligation_actions": odrl_obligation_actions,
                    "odrl_constraints": odrl_constraints,
                    "provenance": provenance,
                    "provenance_records": provenance_records,
                    "provenance_gaps": provenance_gaps,
                    "license": metadata.get("license"),
                    "metadata_valid": metadata_valid,
                },
                "agent_context": dict(agent_context),
                "decision_reason": tuple(reason_codes),
                "mode": engine_decision.mode.value,
                "timestamp": timestamp,
                "correlation_id": correlation_id,
            },
        )
