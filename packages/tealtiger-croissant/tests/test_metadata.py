from tealtiger_croissant.metadata import (
    extract_duo_codes,
    extract_odrl_actions,
    extract_odrl_constraints,
    extract_odrl_offers,
    extract_provenance,
    is_governance_metadata_valid,
)


def test_extracts_duo_codes_from_usage_info() -> None:
    metadata = {
        "usageInfo": [
            {
                "@type": "DefinedTerm",
                "name": "General Research Use",
                "termCode": "DUO_0000042",
                "url": "duo:0000042",
            },
            {
                "@type": "DefinedTerm",
                "name": "Non-commercial Use",
                "termCode": "DUO_0000018",
                "url": "duo:0000018",
            },
        ]
    }

    assert extract_duo_codes(metadata) == (
        "DUO_0000042",
        "DUO_0000018",
    )


def test_extracts_odrl_offer_from_usage_info() -> None:
    offer = {
        "@type": ["CreativeWork", "odrl:Offer"],
        "name": "DUO Usage Policy",
        "odrl:permission": {
            "@type": "odrl:Permission",
            "odrl:action": {"@id": "duo:0000006"},
        },
    }
    metadata = {
        "usageInfo": [
            {"@type": "DefinedTerm", "termCode": "DUO_0000042"},
            offer,
        ]
    }

    assert extract_odrl_offers(metadata) == (offer,)


def test_extracts_dataset_provenance() -> None:
    metadata = {
        "name": "restricted_health_data",
        "prov:wasDerivedFrom": {"@id": "https://example.org/source"},
        "prov:wasGeneratedBy": {"@id": "https://example.org/cleaning"},
        "prov:wasAttributedTo": {"@id": "https://example.org/publisher"},
    }

    assert extract_provenance(metadata) == {
        "wasDerivedFrom": {"@id": "https://example.org/source"},
        "wasGeneratedBy": {"@id": "https://example.org/cleaning"},
        "wasAttributedTo": {"@id": "https://example.org/publisher"},
    }


def test_extracts_constraints_from_odrl_permissions() -> None:
    constraint = {
        "@type": "odrl:Constraint",
        "name": "Non-commercial use only",
        "odrl:operator": {"@id": "odrl:eq"},
        "odrl:rightOperand": {"@id": "duo:0000018"},
    }
    metadata = {
        "usageInfo": {
            "@type": ["CreativeWork", "odrl:Offer"],
            "odrl:permission": {
                "@type": "odrl:Permission",
                "odrl:action": {"@id": "duo:0000006"},
                "odrl:constraint": [constraint],
            },
        }
    }

    assert extract_odrl_constraints(metadata) == (constraint,)


def test_extracts_actions_from_odrl_permissions() -> None:
    metadata = {
        "usageInfo": {
            "@type": ["CreativeWork", "odrl:Offer"],
            "odrl:permission": [
                {"odrl:action": {"@id": "duo:0000006"}},
                {"odrl:action": {"@id": "duo:0000007"}},
            ],
        }
    }

    assert extract_odrl_actions(metadata) == (
        "duo:0000006",
        "duo:0000007",
    )


def test_validates_governance_container_structure() -> None:
    assert is_governance_metadata_valid({"usageInfo": {"termCode": "DUO_0000042"}})
    assert not is_governance_metadata_valid({"usageInfo": "not a policy"})
    assert not is_governance_metadata_valid(
        {"usageInfo": {"@type": "odrl:Offer"}}
    )
