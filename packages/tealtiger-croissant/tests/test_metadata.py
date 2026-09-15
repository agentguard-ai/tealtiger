from tealtiger_croissant.metadata import (
    extract_duo_codes,
    extract_odrl_offers,
    extract_provenance,
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
