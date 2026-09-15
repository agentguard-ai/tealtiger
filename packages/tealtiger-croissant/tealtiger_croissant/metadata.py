from collections.abc import Mapping
from typing import Any


def _mapping_entries(value: Any) -> tuple[Mapping[str, Any], ...]:
    entries = value if isinstance(value, list) else [value]
    return tuple(entry for entry in entries if isinstance(entry, Mapping))


def _usage_entries(metadata: Mapping[str, Any]) -> tuple[Mapping[str, Any], ...]:
    return _mapping_entries(metadata.get("usageInfo", []))


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


def extract_odrl_constraints(
    metadata: Mapping[str, Any],
) -> tuple[Mapping[str, Any], ...]:
    """Extract constraints nested inside Croissant ODRL permissions."""
    constraints = []
    for offer in extract_odrl_offers(metadata):
        for permission in _mapping_entries(offer.get("odrl:permission", [])):
            constraints.extend(
                _mapping_entries(permission.get("odrl:constraint", []))
            )
    return tuple(constraints)


def extract_odrl_actions(metadata: Mapping[str, Any]) -> tuple[str, ...]:
    """Extract action identifiers nested inside Croissant ODRL permissions."""
    actions = []
    for offer in extract_odrl_offers(metadata):
        for permission in _mapping_entries(offer.get("odrl:permission", [])):
            for action in _mapping_entries(permission.get("odrl:action", [])):
                action_id = action.get("@id")
                if isinstance(action_id, str):
                    actions.append(action_id)
    return tuple(actions)


def extract_provenance(metadata: Mapping[str, Any]) -> dict[str, Any]:
    """Extract dataset-level PROV-O relationships from Croissant metadata."""
    relationships = ("wasDerivedFrom", "wasGeneratedBy", "wasAttributedTo")
    return {
        relationship: metadata[f"prov:{relationship}"]
        for relationship in relationships
        if f"prov:{relationship}" in metadata
    }


def is_governance_metadata_valid(metadata: Mapping[str, Any]) -> bool:
    """Return whether supported governance containers are structurally valid."""
    usage_info = metadata.get("usageInfo")
    if usage_info is None:
        return True

    raw_entries = usage_info if isinstance(usage_info, list) else [usage_info]
    if not all(isinstance(entry, Mapping) for entry in raw_entries):
        return False

    for entry in raw_entries:
        term_code = entry.get("termCode")
        if term_code is not None and not isinstance(term_code, str):
            return False

        entry_type = entry.get("@type")
        types = entry_type if isinstance(entry_type, list) else [entry_type]
        if "odrl:Offer" not in types:
            continue

        raw_permissions = entry.get("odrl:permission")
        permissions = _mapping_entries(raw_permissions)
        if not permissions or (
            isinstance(raw_permissions, list)
            and len(permissions) != len(raw_permissions)
        ):
            return False

        for permission in permissions:
            if (
                "odrl:action" not in permission
                and "odrl:constraint" not in permission
            ):
                return False

            raw_actions = permission.get("odrl:action", [])
            actions = _mapping_entries(raw_actions)
            if "odrl:action" in permission and not actions:
                return False
            if isinstance(raw_actions, list) and len(actions) != len(raw_actions):
                return False
            for action in actions:
                if not isinstance(action.get("@id"), str):
                    return False

            raw_constraints = permission.get("odrl:constraint", [])
            constraints = _mapping_entries(raw_constraints)
            if "odrl:constraint" in permission and not constraints:
                return False
            if isinstance(raw_constraints, list) and len(constraints) != len(
                raw_constraints
            ):
                return False
            for constraint in constraints:
                operator = constraint.get("odrl:operator")
                if not isinstance(operator, Mapping) or not isinstance(
                    operator.get("@id"), str
                ):
                    return False
                if "odrl:rightOperand" not in constraint:
                    return False

    return True
