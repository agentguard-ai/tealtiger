from tealtiger_croissant.metadata import extract_duo_codes

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