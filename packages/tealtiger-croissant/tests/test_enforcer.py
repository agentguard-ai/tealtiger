import mlcroissant as mlc

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
        {"org_type": "commercial"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_NON_COMMERCIAL_ONLY",)


def test_allows_nonprofit_use_for_odrl_non_commercial_constraint() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_NON_COMMERCIAL_METADATA,
        {"org_type": "nonprofit"},
    )

    assert decision.action == "ALLOW"
    assert decision.reason_codes == ()


def test_blocks_use_for_a_different_disease_area() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {"disease_area": "mondo:0005148"},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_DISEASE_SPECIFIC_USE_ONLY",)


def test_blocks_disease_specific_use_when_disease_area_is_missing() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {},
    )

    assert decision.action == "BLOCK"
    assert decision.reason_codes == ("ODRL_DISEASE_SPECIFIC_USE_ONLY",)


def test_allows_use_for_the_declared_disease_area() -> None:
    decision = CroissantGovernanceEnforcer().evaluate_access(
        ODRL_DISEASE_SPECIFIC_METADATA,
        {"disease_area": "mondo:0005070"},
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
    assert decision.policies_evaluated == 3


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
            "odrl_constraints": (),
            "provenance": {
                "wasDerivedFrom": {"@id": "https://example.org/source"}
            },
            "license": "https://creativecommons.org/licenses/by-nc/4.0/",
        },
        "agent_context": context,
        "decision_reason": ("DUO_0000018_NON_COMMERCIAL_ONLY",),
    }
