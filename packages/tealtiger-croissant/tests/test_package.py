import tealtiger_croissant
from tealtiger_croissant import CroissantGovernanceEnforcer, GovernanceDecision


def test_package_version() -> None:
    assert tealtiger_croissant.__version__ == "0.1.0"


def test_exports_public_enforcement_api() -> None:
    assert (
        tealtiger_croissant.CroissantGovernanceEnforcer
        is CroissantGovernanceEnforcer
    )
    assert tealtiger_croissant.GovernanceDecision is GovernanceDecision
      
