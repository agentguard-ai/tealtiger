# tealtiger-croissant

Deterministic runtime enforcement for governance metadata declared by Croissant
1.1 datasets. The package evaluates supported DUO and ODRL policies before data
access and returns structured audit evidence that can be exported as PROV-O.

## Installation

```bash
pip install tealtiger-croissant
```

## Quick start

```python
import mlcroissant as mlc
from tealtiger_croissant import CroissantGovernanceEnforcer

dataset = mlc.Dataset("metadata.json")
decision = CroissantGovernanceEnforcer().evaluate_access(
    dataset,
    {
        "purpose": "research",
        "org_type": "nonprofit",
        "research_area": "medical",
        "disease_area": "mondo:0005070",
    },
)

if decision.action == "BLOCK":
    print("Access denied:", decision.reason_codes)
else:
    print("Access allowed")

print(decision.audit_evidence)
print(decision.to_croissant_provenance())
```

`evaluate_access` also accepts an already-parsed Croissant JSON-LD mapping.

## Supported governance policies

| Declaration | Agent context | Enforcement |
| --- | --- | --- |
| `DUO_0000042` General Research Use | `purpose="research"` | Other or missing purposes are blocked |
| `DUO_0000018` Not-for-profit Use Only | `org_type="academic"` or `"nonprofit"` | Commercial or missing organization types are blocked |
| ODRL action `duo:0000006` | `purpose="research"` and `research_area` set to `health`, `medical`, or `biomedical` | Other uses are blocked |
| ODRL action `duo:0000007` | `purpose="research"` | Non-research uses are blocked |
| ODRL constraint `duo:0000018` with `odrl:eq` | Non-commercial organization type | Commercial use is blocked |
| ODRL disease constraint `duo:0000010` with a MONDO right operand | Matching compact MONDO identifier in `disease_area` | Missing or different disease areas are blocked |

Unknown DUO codes, ODRL actions, and ODRL constraints fail closed in ENFORCE
mode. Malformed governance containers also fail closed instead of being
silently ignored.

## TealTiger modes

The default TealTiger mode is `ENFORCE`. A configured engine can enable staged
rollout behavior:

```python
from tealtiger.core.engine import ModeConfig, PolicyMode, TealEngine
from tealtiger_croissant import CroissantGovernanceEnforcer

engine = TealEngine(
    policies={},
    mode=ModeConfig(default=PolicyMode.MONITOR),
)
enforcer = CroissantGovernanceEnforcer(engine)
```

- `ENFORCE`: violations return `BLOCK`.
- `MONITOR`: policies are evaluated and violations are recorded, but access is
  allowed.
- `REPORT_ONLY`: access is allowed and Croissant policy evaluation is skipped.

TealTiger supplies the correlation ID used by the decision, audit evidence,
and PROV-O export.

## Provenance and audit evidence

Dataset-level `prov:wasDerivedFrom`, `prov:wasGeneratedBy`, and
`prov:wasAttributedTo` relationships are extracted. `provenance_verified` is
true only when all three are present. Incomplete provenance is reported but
does not independently block access.

Every decision includes its action, reason codes, mode, dataset identifier,
number of policies evaluated, timestamp, correlation ID, provenance status,
and an audit snapshot. `to_croissant_provenance()` returns a JSON-serializable
PROV-O activity for the decision.

## Scope

This release intentionally enforces the Croissant 1.1 dataset-level DUO/ODRL
patterns listed above. Generic ODRL vocabulary support, recursive
resource/record-set/field provenance, and MCP middleware are not implemented.
Unsupported governance policies block in ENFORCE mode so the limited scope
cannot silently authorize access.
