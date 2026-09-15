"""Deterministic governance enforcement for Croissant datasets."""

from .enforcer import CroissantGovernanceEnforcer, GovernanceDecision
from .metadata import (
    extract_duo_codes,
    extract_odrl_actions,
    extract_odrl_constraints,
    extract_odrl_offers,
    extract_provenance,
)

__version__ = "0.1.0"
__all__ = [
    "__version__",
    "CroissantGovernanceEnforcer",
    "GovernanceDecision",
    "extract_duo_codes",
    "extract_odrl_actions",
    "extract_odrl_constraints",
    "extract_odrl_offers",
    "extract_provenance",
]
