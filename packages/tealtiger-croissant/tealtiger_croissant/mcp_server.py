"""MCP tools for governed Croissant dataset access."""

import json
from itertools import islice
from typing import Any

import mlcroissant as mlc
from mcp.server.fastmcp import FastMCP

from .enforcer import CroissantGovernanceEnforcer, GovernanceDecision


mcp = FastMCP(
    "TealTiger Croissant Governance",
    instructions=(
        "Evaluate Croissant DUO, ODRL, and provenance declarations before "
        "accessing dataset records. Blocked requests never read records."
    ),
)


def _load_metadata(metadata_source: str) -> mlc.Dataset:
    return mlc.Dataset(metadata_source)


def _json_default(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _decision_payload(decision: GovernanceDecision) -> dict[str, Any]:
    return {
        "action": decision.action,
        "dataset_id": decision.dataset_id,
        "policies_evaluated": decision.policies_evaluated,
        "reason_codes": list(decision.reason_codes),
        "provenance_verified": decision.provenance_verified,
        "timestamp": decision.timestamp,
        "correlation_id": decision.correlation_id,
        "audit_evidence": decision.audit_evidence,
    }


@mcp.tool()
async def evaluate_dataset_access(
    metadata: dict[str, Any], agent_context: dict[str, Any]
) -> str:
    """Evaluate access against parsed Croissant metadata without reading records."""
    decision = CroissantGovernanceEnforcer().evaluate_access(metadata, agent_context)
    return json.dumps(_decision_payload(decision), default=_json_default)


@mcp.tool()
async def load_dataset(
    metadata_source: str,
    agent_context: dict[str, Any],
    record_set: str | None = None,
    max_records: int = 100,
) -> str:
    """Load bounded records only after Croissant governance allows access."""
    if not isinstance(metadata_source, str) or not metadata_source.strip():
        raise ValueError("metadata_source must be a non-empty path or URL")
    if not isinstance(max_records, int) or isinstance(max_records, bool):
        raise TypeError("max_records must be an integer")
    if not 1 <= max_records <= 1000:
        raise ValueError("max_records must be between 1 and 1000")

    dataset = _load_metadata(metadata_source)
    decision = CroissantGovernanceEnforcer().evaluate_access(
        dataset.metadata.to_json(),
        agent_context,
    )
    payload = _decision_payload(decision)
    payload["records"] = []
    if decision.action == "BLOCK":
        return json.dumps(payload, default=_json_default)

    records = (
        dataset.records(record_set=record_set)
        if record_set is not None
        else dataset.records()
    )
    payload["records"] = list(islice(records, max_records))
    return json.dumps(payload, default=_json_default)


def main() -> None:
    """Run the MCP server over stdio."""
    mcp.run()


if __name__ == "__main__":
    main()
