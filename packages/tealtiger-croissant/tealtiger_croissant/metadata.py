from collections.abc import Mapping
from typing import Any


def _usage_entries(metadata: Mapping[str, Any]) -> tuple[Mapping[str, Any], ...]:
    usage_info = metadata.get("usageInfo", [])
    entries = usage_info if isinstance(usage_info, list) else [usage_info]
    return tuple(entry for entry in entries if isinstance(entry, Mapping))


def extract_duo_codes(metadata: Mapping[str, Any]) -> tuple[str, ...]:
    """Extract DUO term codes from Croissant usageInfo metadata."""
    return tuple(
        code
        for entry in _usage_entries(metadata)
        if isinstance((code := entry.get("termCode")), str)
        and code.startswith("DUO_")
    )


def extract_odrl_offers(
    metadata: Mapping[str, Any],
) -> tuple[Mapping[str, Any], ...]:
    """Extract ODRL offers from Croissant usageInfo metadata."""
    offers = []
    for entry in _usage_entries(metadata):
        entry_type = entry.get("@type")
        if entry_type == "odrl:Offer" or (
            isinstance(entry_type, list) and "odrl:Offer" in entry_type
        ):
            offers.append(entry)
    return tuple(offers)


def extract_provenance(metadata: Mapping[str, Any]) -> dict[str, Any]:
    """Extract dataset-level PROV-O relationships from Croissant metadata."""
    relationships = ("wasDerivedFrom", "wasGeneratedBy", "wasAttributedTo")
    return {
        relationship: metadata[f"prov:{relationship}"]
        for relationship in relationships
        if f"prov:{relationship}" in metadata
    }
