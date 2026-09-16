import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID

import mlcroissant as mlc
import pytest
from tealtiger.core.engine import ModeConfig, PolicyMode, TealEngine

from tealtiger_croissant.enforcer import CroissantGovernanceEnforcer


NON_COMMERCIAL_METADATA = {
    "usageInfo": {
        "@type": "DefinedTerm",
        "name": "Non-commercial Use",
        "termCode": "DUO_0000018",
        "url": "duo:0000018",
    }
}

GENERAL_RESEARCH_METADATA = {
    "usageInfo": {
        "@type": "DefinedTerm",
        "name": "General Research Use",
        "termCode": "DUO_0000042",
        "url": "duo:0000042",
    }
}

ODRL_NON_COMMERCIAL_METADATA = {
    "usageInfo": {
        "@type": ["CreativeWork", "odrl:Offer"],
        "odrl:permission": {
            "@type": "odrl:Permission",
            "odrl:action": {"@id": "duo:0000006"},
            "odrl:constraint": {
                "@type": "odrl:Constraint",
                "odrl:operator": {"@id": "odrl:eq"},
                "odrl:rightOperand": {"@id": "duo:0000018"},
            },
        },
    }
}

ODRL_DISEASE_SPECIFIC_METADATA = {
    "usageInfo": {
        "@type": ["CreativeWork", "odrl:Offer"],
        "odrl:permission": {
            "@type": "odrl:Permission",
            "odrl:action": {"@id": "duo:0000007"},
            "odrl:constraint": {
                "@type": "odrl:Constraint",
                "odrl:leftOperand": {"@id": "duo:0000010"},
                "odrl:operator": {"@id": "odrl:eq"},
                "odrl:rightOperand": {"@id": "mondo:0005070"},
            },
        },
    }
}

ODRL_HEALTH_RESEARCH_METADATA = {
    "usageInfo": {
        "@type": ["CreativeWork", "odrl:Offer"],
        "odrl:permission": {
            "@type": "odrl:Permission",
            "odrl:action": {"@id": "duo:0000006"},
        },
    }
}


def test_blocks_commercial_use_of_non_commercial_dataset() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        NON_COMMERCIAL_METADATA,
        {"org_type": "commercial"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("DUO_0000018_NON_COMMERCIAL_ONLY",)


def test_allows_nonprofit_use_of_non_commercial_dataset() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        NON_COMMERCIAL_METADATA,
        {"org_type": "nonprofit"},
    )

    assert decision.action == "ALLOW"
    assert decision.reason_codes == ()


def test_blocks_when_non_commercial_dataset_has_no_org_type() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        NON_COMMERCIAL_METADATA,
        {},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("DUO_0000018_NON_COMMERCIAL_ONLY",)


def test_blocks_non_research_use_of_general_research_dataset() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        GENERAL_RESEARCH_METADATA,
        {"purpose": "commercial_finetuning"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("DUO_0000042_GENERAL_RESEARCH_USE_ONLY",)


def test_allows_research_use_of_general_research_dataset() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        GENERAL_RESEARCH_METADATA,
        {"purpose": "research"},
    )

    assert decision.action == "ALLOW"
    assert decision.reason_codes == ()


def test_blocks_commercial_use_for_odrl_non_commercial_constraint() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_NON_COMMERCIAL_METADATA,
        {
            "org_type": "commercial",
            "purpose": "research",
            "research_area": "health",
        },
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_NON_COMMERCIAL_ONLY",)


def test_allows_nonprofit_use_for_odrl_non_commercial_constraint() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_NON_COMMERCIAL_METADATA,
        {
            "org_type": "nonprofit",
            "purpose": "research",
            "research_area": "health",
        },
    )

    assert decision.action == "ALLOW"
    assert decision.reason_codes == ()


def test_blocks_use_for_a_different_disease_area() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {"purpose": "research", "disease_area": "mondo:0005148"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_DISEASE_SPECIFIC_USE_ONLY",)


def test_blocks_disease_specific_use_when_disease_area_is_missing() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {"purpose": "research"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_DISEASE_SPECIFIC_USE_ONLY",)


def test_allows_use_for_the_declared_disease_area() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {"purpose": "research", "disease_area": "mondo:0005070"},
    )

    assert decision.action == "ALLOW"
    assert decision.reason_codes == ()


def test_reports_provenance_completeness() -> None:
    complete_metadata = {
        "prov:wasDerivedFrom": {"@id": "https://example.org/source"},
        "prov:wasGeneratedBy": {"@id": "https://example.org/activity"},
        "prov:wasAttributedTo": {"@id": "https://example.org/agent"},
    }
    incomplete_metadata = {
        "prov:wasDerivedFrom": {"@id": "https://example.org/source"},
    }
    enforcer = CroissantGovernanceEnforcer()

    complete = enforcer.evaluate_access(complete_metadata, {})
    incomplete = enforcer.evaluate_access(incomplete_metadata, {})

    assert complete.provenance_verified is True
    assert incomplete.provenance_verified is False


def test_evaluates_an_mlcroissant_dataset() -> None:
    dataset = mlc.Dataset(
        {
            "@context": {
                "@language": "en",
                "@vocab": "https://schema.org/",
                "cr": "http://mlcommons.org/croissant/",
                "dct": "http://purl.org/dc/terms/",
                "conformsTo": "dct:conformsTo",
                "duo": "http://purl.obolibrary.org/obo/DUO_",
            },
            "@type": "Dataset",
            "name": "non_commercial_dataset",
            "description": "A governed test dataset.",
            "conformsTo": "http://mlcommons.org/croissant/1.1",
            "license": "https://creativecommons.org/licenses/by-nc/4.0/",
            "url": "https://example.org/dataset",
            "creator": {"@type": "Organization", "name": "Example"},
            "datePublished": "2026-01-01",
            "usageInfo": {
                "@type": "DefinedTerm",
                "name": "Non-commercial Use",
                "termCode": "DUO_0000018",
                "url": "duo:0000018",
            },
        }
    )

    decision = CroissantGovernanceEnforcer().evaluate_access(
        dataset,
        {"org_type": "commercial"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("DUO_0000018_NON_COMMERCIAL_ONLY",)


def test_reports_dataset_id_and_policy_count() -> None:
    metadata = {
        "@id": "restricted-health-data",
        "usageInfo": [
            {"@type": "DefinedTerm", "termCode": "DUO_0000042"},
            {
                "@type": ["CreativeWork", "odrl:Offer"],
                "odrl:permission": {
                    "odrl:action": {"@id": "duo:0000006"},
                    "odrl:constraint": {
                        "odrl:operator": {"@id": "odrl:eq"},
                        "odrl:rightOperand": {"@id": "duo:0000018"},
                    }
                },
            },
        ],
        "prov:wasDerivedFrom": {"@id": "https://example.org/source"},
    }

    decision = CroissantGovernanceEnforcer().evaluate_access(
        metadata,
        {"purpose": "research", "org_type": "nonprofit"},
    )

    assert decision.dataset_id == "restricted-health-data"
    assert decision.policies_evaluated == 4


def test_records_structured_audit_evidence() -> None:
    metadata = {
        "@id": "licensed-dataset",
        "license": "https://creativecommons.org/licenses/by-nc/4.0/",
        "usageInfo": {
            "@type": "DefinedTerm",
            "termCode": "DUO_0000018",
        },
        "prov:wasDerivedFrom": {"@id": "https://example.org/source"},
    }
    context = {"org_type": "commercial", "purpose": "model_training"}

    decision = CroissantGovernanceEnforcer().evaluate_access(metadata, context)

    assert decision.audit_evidence == {
        "croissant_policies": {
            "duo_codes": ("DUO_0000018",),
            "odrl_actions": (),
            "odrl_constraints": (),
            "provenance": {
                "wasDerivedFrom": {"@id": "https://example.org/source"}
            },
            "license": "https://creativecommons.org/licenses/by-nc/4.0/",
            "metadata_valid": True,
        },
        "agent_context": context,
        "decision_reason": ("DUO_0000018_NON_COMMERCIAL_ONLY",),
        "mode": "ENFORCE",
        "timestamp": decision.timestamp,
        "correlation_id": decision.correlation_id,
    }


def test_assigns_utc_timestamp_and_correlation_id() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access({}, {})

    timestamp = datetime.fromisoformat(decision.timestamp)
    assert timestamp.utcoffset() == timezone.utc.utcoffset(timestamp)
    assert str(UUID(decision.correlation_id)) == decision.correlation_id
    assert decision.audit_evidence["timestamp"] == decision.timestamp
    assert decision.audit_evidence["correlation_id"] == decision.correlation_id


def test_exports_decision_as_prov_o_activity() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        {"@id": "restricted-health-data", **NON_COMMERCIAL_METADATA},
        {"org_type": "commercial"},
    )

    provenance = decision.to_croissant_provenance()

    assert provenance["@type"] == "prov:Activity"
    assert provenance["prov:used"] == {
        "@id": "restricted-health-data",
        "@type": "prov:Entity",
    }
    assert provenance["prov:generated"]["decision"] == "BLOCK"
    assert provenance["prov:generated"]["reason_codes"] == [
        "DUO_0000018_NON_COMMERCIAL_ONLY"
    ]
    assert provenance["prov:endedAtTime"] == decision.timestamp
    assert json.loads(json.dumps(provenance)) == provenance


def test_uses_tealtiger_engine_correlation_id() -> None:
    engine = Mock(spec=TealEngine)
    engine.evaluate_with_mode.return_value = SimpleNamespace(
        correlation_id="governance-correlation-id",
        mode=PolicyMode.ENFORCE,
    )

    decision = CroissantGovernanceEnforcer(engine).evaluate_access(
        {"@id": "restricted-health-data"},
        {},
    )

    assert decision.correlation_id == "governance-correlation-id"
    engine.evaluate_with_mode.assert_called_once_with(
        {
            "action": "croissant.dataset_access",
            "metadata": {"dataset_id": "restricted-health-data"},
        }
    )


def test_monitor_mode_records_violation_without_blocking() -> None:
    engine = TealEngine(
        policies={},
        mode=ModeConfig(default=PolicyMode.MONITOR),
    )

    decision = CroissantGovernanceEnforcer(engine).evaluate_access(
        NON_COMMERCIAL_METADATA,
        {"org_type": "commercial"},
    )

    assert decision.action == "ALLOW"
    assert decision.mode == PolicyMode.MONITOR
    assert decision.reason_codes == ("DUO_0000018_NON_COMMERCIAL_ONLY",)


def test_report_only_mode_skips_policy_evaluation() -> None:
    engine = TealEngine(
        policies={},
        mode=ModeConfig(default=PolicyMode.REPORT_ONLY),
    )

    decision = CroissantGovernanceEnforcer(engine).evaluate_access(
        NON_COMMERCIAL_METADATA,
        {"org_type": "commercial"},
    )

    assert decision.action == "ALLOW"
    assert decision.mode == PolicyMode.REPORT_ONLY
    assert decision.reason_codes == ()
    assert decision.policies_evaluated == 0


def test_enforces_health_research_action() -> None:
    enforcer = CroissantGovernanceEnforcer()

    blocked = enforcer.evaluate_access(
        ODRL_HEALTH_RESEARCH_METADATA,
        {"purpose": "research", "research_area": "general"},
    )
    allowed = enforcer.evaluate_access(
        ODRL_HEALTH_RESEARCH_METADATA,
        {"purpose": "research", "research_area": "biomedical"},
    )

    assert blocked.action == "BLOCK"
    assert blocked.reason_codes == ("ODRL_HEALTH_RESEARCH_USE_ONLY",)
    assert allowed.action == "ALLOW"


def test_enforces_disease_research_action() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {"purpose": "commercial_finetuning", "disease_area": "mondo:0005070"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_DISEASE_RESEARCH_USE_ONLY",)


@pytest.mark.parametrize(
    ("metadata", "reason_code"),
    [
        (
            {"usageInfo": {"termCode": "DUO_9999999"}},
            "UNSUPPORTED_DUO_CODE",
        ),
        (
            {
                "usageInfo": {
                    "@type": "odrl:Offer",
                    "odrl:permission": {
                        "odrl:action": {"@id": "odrl:distribute"}
                    },
                }
            },
            "UNSUPPORTED_ODRL_ACTION",
        ),
        (
            {
                "usageInfo": {
                    "@type": "odrl:Offer",
                    "odrl:permission": {
                        "odrl:action": {"@id": "duo:0000006"},
                        "odrl:constraint": {
                            "odrl:leftOperand": {"@id": "odrl:dateTime"},
                            "odrl:operator": {"@id": "odrl:lt"},
                            "odrl:rightOperand": "2030-01-01",
                        }
                    },
                }
            },
            "UNSUPPORTED_ODRL_CONSTRAINT",
        ),
    ],
)
def test_fails_closed_for_unsupported_governance_policy(
    metadata: dict[str, object],
    reason_code: str,
) -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(metadata, {})

    assert decision.action == "BLOCK"
    assert reason_code in decision.reason_codes


def test_fails_closed_for_malformed_governance_metadata() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        {"usageInfo": "not a policy"},
        {},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("INVALID_GOVERNANCE_METADATA",)


def test_rejects_invalid_argument_types() -> None:
    enforcer = CroissantGovernanceEnforcer()

    with pytest.raises(TypeError, match="dataset must be"):
        enforcer.evaluate_access([], {})  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="agent_context must be"):
        enforcer.evaluate_access({}, [])  # type: ignore[arg-type]
