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
