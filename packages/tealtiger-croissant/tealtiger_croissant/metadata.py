from collections.abc import Mapping
from typing import Any


def extract_duo_codes(metadata: Mapping[str, Any]) -> tuple[str, ...]:
    """Extract DUO term codes from Croissant usageInfo metadata."""
    usage_info = metadata.get("usageInfo", [])
    entries = usage_info if isinstance(usage_info, list) else [usage_info]

    return tuple(
        code
        for entry in entries
        if isinstance(entry, Mapping)
        and isinstance((code := entry.get("termCode")), str)
        and code.startswith("DUO_")
    )
