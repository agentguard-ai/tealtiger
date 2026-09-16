# tealtiger-croissant

Deterministic runtime enforcement for governance metadata declared by Croissant
1.1 datasets. The package evaluates DUO and ODRL policies before record access,
checks PROV-O provenance, and produces structured audit evidence.

## Installation

```bash
pip install tealtiger-croissant
```

## Python API

```python
import mlcroissant as mlc
from tealtiger_croissant import CroissantGovernanceEnforcer

dataset = mlc.Dataset("metadata.json")
decision = CroissantGovernanceEnforcer().evaluate_access(
    dataset,
    {
        "action": "odrl:use",
        "purpose": "research",
        "org_type": "nonprofit",
        "research_area": "medical",
        "disease_area": "mondo:0005070",
        "use_case": "analysis",
        "attribution_provided": True,
        "collaborator_agreement": True,
        "ethics_review": True,
    },
)

if decision.action == "BLOCK":
    raise PermissionError(decision.reason_codes)

print(decision.audit_evidence)
print(decision.to_croissant_provenance())
print(decision.to_sarif())
print(decision.to_junit_xml())
```

`evaluate_access` also accepts an already-parsed Croissant JSON-LD mapping.

## DUO enforcement

| DUO term | Required agent context |
| --- | --- |
| `DUO_0000004` No Restriction | No additional condition |
| `DUO_0000006` Health/Medical/Biomedical Research | `purpose="research"` and a health, medical, or biomedical `research_area` |
| `DUO_0000007` Disease-Specific Research | `purpose="research"` and a non-empty `disease_area` |
| `DUO_0000015` No General Methods Research | `use_case` must be `analysis`, `benchmarking`, or `model_training` |
| `DUO_0000018` Not-for-Profit, Non-Commercial Use | Academic/nonprofit organization and research/evaluation purpose |
| `DUO_0000020` Collaboration Required | `collaborator_agreement=True` |
| `DUO_0000021` Ethics Approval Required | `ethics_review=True` |
| `DUO_0000042` General Research Use | `purpose="research"` |
| `DUO_0000046` Non-Commercial Use Only | Research/evaluation purpose |

The mappings follow the current EBISPOT Data Use Ontology rather than the
illustrative mappings in issue pseudocode.

## ODRL enforcement

The package evaluates every ODRL rule category:

- Permissions form an allowlist for the requested `action`.
- Prohibitions block a matching requested `action`.
- Top-level obligations and permission duties require explicit evidence.
- `odrl:attribute`, `odrl:compensate`, `odrl:inform`,
  `odrl:obtainConsent`, and `odrl:reviewPolicy` are supported duties.
- Croissant's DUO health, disease-specific, non-commercial, and MONDO disease
  constraints are enforced.

Unknown DUO terms, DUO-based ODRL actions, duties, constraints, malformed
containers, and missing action context fail closed in `ENFORCE` mode.

## TealTiger modes

The default mode is `ENFORCE`. A configured TealTiger engine enables staged
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
- `MONITOR`: violations are recorded but access returns `ALLOW`.
- `REPORT_ONLY`: access returns `ALLOW` without Croissant policy evaluation.

TealTiger supplies the decision mode and correlation ID used across all audit
formats.

## Provenance and audit evidence

`prov:wasDerivedFrom`, `prov:wasGeneratedBy`, and `prov:wasAttributedTo` are
collected recursively from datasets, resources, record sets, and fields.
`provenance_verified` is true only when every object declaring provenance has
all three relationships. Missing relationships are reported with their JSON
paths in `audit_evidence` but do not independently block access.

Every decision includes the action, reason codes, mode, dataset identifier,
policy count, timestamp, correlation ID, provenance status, and audit snapshot.
Evidence can be exported as:

- Croissant-compatible PROV-O with `to_croissant_provenance()`
- SARIF 2.1.0 with `to_sarif()`
- JUnit XML with `to_junit_xml()`

## MCP server

The installed `tealtiger-croissant-mcp` command runs a local stdio MCP server.
It exposes:

- `evaluate_dataset_access`: evaluate parsed metadata without reading records.
- `load_dataset`: evaluate metadata first, then return at most `max_records`
  records only when access is allowed.

Blocked `load_dataset` calls never iterate dataset records. `max_records` must
be between 1 and 1,000. The server can open the local path or URL supplied by
the MCP caller, so only trusted clients should be allowed to invoke it.

Example MCP configuration:

```json
{
  "mcpServers": {
    "croissant-governed": {
      "command": "tealtiger-croissant-mcp",
      "description": "Croissant dataset access with TealTiger governance"
    }
  }
}
```

The supported deterministic profile is intentionally finite. ODRL constructs
outside the rules documented above are denied rather than silently authorized.
