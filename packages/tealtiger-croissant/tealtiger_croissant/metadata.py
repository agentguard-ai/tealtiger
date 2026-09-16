from collections.abc import Mapping
from typing import Any


_PROVENANCE_RELATIONSHIPS = (
    "wasDerivedFrom",
    "wasGeneratedBy",
    "wasAttributedTo",
)
_ODRL_RULE_PROPERTIES = (
    "odrl:permission",
    "odrl:prohibition",
    "odrl:obligation",
)


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


def _odrl_rules(
    metadata: Mapping[str, Any], property_name: str
) -> tuple[Mapping[str, Any], ...]:
    return tuple(
        rule
        for offer in extract_odrl_offers(metadata)
        for rule in _mapping_entries(offer.get(property_name, []))
    )


def extract_odrl_permissions(
    metadata: Mapping[str, Any],
) -> tuple[Mapping[str, Any], ...]:
    """Extract permission rules from Croissant ODRL offers."""
    return _odrl_rules(metadata, "odrl:permission")


def extract_odrl_prohibitions(
    metadata: Mapping[str, Any],
) -> tuple[Mapping[str, Any], ...]:
    """Extract prohibition rules from Croissant ODRL offers."""
    return _odrl_rules(metadata, "odrl:prohibition")


def extract_odrl_obligations(
    metadata: Mapping[str, Any],
) -> tuple[Mapping[str, Any], ...]:
    """Extract policy obligations and duties attached to permissions."""
    obligations = list(_odrl_rules(metadata, "odrl:obligation"))
    for permission in extract_odrl_permissions(metadata):
        obligations.extend(_mapping_entries(permission.get("odrl:duty", [])))
    return tuple(obligations)


def extract_odrl_constraints(
    metadata: Mapping[str, Any],
    property_name: str = "odrl:permission",
) -> tuple[Mapping[str, Any], ...]:
    """Extract constraints nested inside one ODRL rule category."""
    constraints = []
    for rule in _odrl_rules(metadata, property_name):
        constraints.extend(_mapping_entries(rule.get("odrl:constraint", [])))
    return tuple(constraints)


def extract_odrl_actions(
    metadata: Mapping[str, Any],
    property_name: str = "odrl:permission",
) -> tuple[str, ...]:
    """Extract action identifiers nested inside one ODRL rule category."""
    actions = []
    for rule in _odrl_rules(metadata, property_name):
        for action in _mapping_entries(rule.get("odrl:action", [])):
            action_id = action.get("@id")
            if isinstance(action_id, str):
                actions.append(action_id)
    return tuple(actions)


def extract_provenance(metadata: Mapping[str, Any]) -> dict[str, Any]:
    """Extract dataset-level PROV-O relationships from Croissant metadata."""
    return {
        relationship: metadata[f"prov:{relationship}"]
        for relationship in _PROVENANCE_RELATIONSHIPS
        if f"prov:{relationship}" in metadata
    }


def extract_provenance_records(
    metadata: Mapping[str, Any],
) -> tuple[dict[str, Any], ...]:
    """Extract PROV-O relationships from every nested Croissant object."""
    records = []

    def visit(value: Any, path: str) -> None:
        if isinstance(value, Mapping):
            relationships = extract_provenance(value)
            if relationships:
                records.append(
                    {
                        "path": path,
                        "entity_id": value.get("@id") or value.get("name"),
                        "relationships": relationships,
                    }
                )
            for key, child in value.items():
                visit(child, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, f"{path}[{index}]")

    visit(metadata, "$")
    return tuple(records)


def _is_valid_odrl_rule(rule: Mapping[str, Any]) -> bool:
    raw_actions = rule.get("odrl:action")
    actions = _mapping_entries(raw_actions)
    if not actions or (
        isinstance(raw_actions, list) and len(actions) != len(raw_actions)
    ):
        return False
    if any(not isinstance(action.get("@id"), str) for action in actions):
        return False

    raw_constraints = rule.get("odrl:constraint", [])
    constraints = _mapping_entries(raw_constraints)
    if isinstance(raw_constraints, list) and len(constraints) != len(raw_constraints):
        return False
    if "odrl:constraint" in rule and not constraints:
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

        if not any(property_name in entry for property_name in _ODRL_RULE_PROPERTIES):
            return False

        for property_name in _ODRL_RULE_PROPERTIES:
            if property_name not in entry:
                continue
            raw_rules = entry[property_name]
            rules = _mapping_entries(raw_rules)
            if not rules or (
                isinstance(raw_rules, list) and len(rules) != len(raw_rules)
            ):
                return False
            for rule in rules:
                if not _is_valid_odrl_rule(rule):
                    return False

        for permission in _mapping_entries(entry.get("odrl:permission", [])):
            raw_duties = permission.get("odrl:duty", [])
            duties = _mapping_entries(raw_duties)
            if isinstance(raw_duties, list) and len(duties) != len(raw_duties):
                return False
            if "odrl:duty" in permission and not duties:
                return False
            if any(not _is_valid_odrl_rule(duty) for duty in duties):
                return False

    return True
