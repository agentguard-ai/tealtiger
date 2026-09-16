import json
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from tealtiger_croissant import mcp_server


async def _call_tool(name: str, arguments: dict) -> dict:
    response = await mcp_server.mcp.call_tool(name, arguments)
    content = response[0] if isinstance(response, tuple) else response
    return json.loads(content[0].text)


@pytest.mark.asyncio
async def test_mcp_server_registers_governance_tools() -> None:
    tools = await mcp_server.mcp.list_tools()

    assert {tool.name for tool in tools} == {
        "evaluate_dataset_access",
        "load_dataset",
    }


@pytest.mark.asyncio
async def test_evaluate_dataset_access_returns_structured_decision() -> None:
    result = await _call_tool(
        "evaluate_dataset_access",
        {
            "metadata": {"usageInfo": {"termCode": "DUO_0000042"}},
            "agent_context": {"purpose": "commercial_finetuning"},
        },
    )

    assert result["action"] == "BLOCK"
    assert result["reason_codes"] == ["DUO_0000042_GENERAL_RESEARCH_USE_ONLY"]
    assert result["correlation_id"]


@pytest.mark.asyncio
async def test_blocked_load_never_reads_records(monkeypatch: pytest.MonkeyPatch) -> None:
    dataset = SimpleNamespace(
        metadata=SimpleNamespace(
            to_json=lambda: {"usageInfo": {"termCode": "DUO_0000042"}}
        ),
        records=Mock(side_effect=AssertionError("records must not be read")),
    )
    monkeypatch.setattr(mcp_server, "_load_metadata", Mock(return_value=dataset))

    result = await _call_tool(
        "load_dataset",
        {
            "metadata_source": "metadata.json",
            "agent_context": {"purpose": "commercial_finetuning"},
        },
    )

    assert result["action"] == "BLOCK"
    assert result["records"] == []
    dataset.records.assert_not_called()


@pytest.mark.asyncio
async def test_allowed_load_caps_returned_records(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dataset = SimpleNamespace(
        metadata=SimpleNamespace(to_json=lambda: {}),
        records=Mock(return_value=iter({"id": index} for index in range(5))),
    )
    monkeypatch.setattr(mcp_server, "_load_metadata", Mock(return_value=dataset))

    result = await _call_tool(
        "load_dataset",
        {
            "metadata_source": "metadata.json",
            "agent_context": {},
            "max_records": 2,
        },
    )

    assert result["action"] == "ALLOW"
    assert result["records"] == [{"id": 0}, {"id": 1}]


@pytest.mark.asyncio
async def test_load_dataset_rejects_unbounded_requests() -> None:
    with pytest.raises(ValueError, match="between 1 and 1000"):
        await mcp_server.load_dataset("metadata.json", {}, max_records=1001)


@pytest.mark.asyncio
async def test_loads_real_croissant_records_after_authorization(
    tmp_path: Path,
) -> None:
    data = b"id,name\n1,Ada\n2,Lin\n"
    data_path = tmp_path / "data.csv"
    data_path.write_bytes(data)
    metadata_path = tmp_path / "metadata.json"
    metadata_path.write_text(
        json.dumps(
            {
                "@context": {
                    "@language": "en",
                    "@vocab": "https://schema.org/",
                    "cr": "http://mlcommons.org/croissant/",
                    "dct": "http://purl.org/dc/terms/",
                    "sc": "https://schema.org/",
                    "column": "cr:column",
                    "conformsTo": "dct:conformsTo",
                    "dataType": {"@id": "cr:dataType", "@type": "@vocab"},
                    "extract": "cr:extract",
                    "field": "cr:field",
                    "fileObject": "cr:fileObject",
                    "recordSet": "cr:recordSet",
                    "source": "cr:source",
                },
                "@type": "Dataset",
                "name": "governed_records",
                "description": "MCP integration fixture.",
                "conformsTo": "http://mlcommons.org/croissant/1.1",
                "license": "https://creativecommons.org/licenses/by/4.0/",
                "url": "https://example.org/governed-records",
                "creator": {"@type": "Organization", "name": "Example"},
                "datePublished": "2026-01-01",
                "distribution": {
                    "@type": "cr:FileObject",
                    "@id": "data.csv",
                    "name": "data.csv",
                    "contentUrl": "data.csv",
                    "encodingFormat": "text/csv",
                    "sha256": sha256(data).hexdigest(),
                },
                "recordSet": {
                    "@type": "cr:RecordSet",
                    "@id": "records",
                    "name": "records",
                    "field": [
                        {
                            "@type": "cr:Field",
                            "@id": "records/id",
                            "dataType": "sc:Integer",
                            "source": {
                                "fileObject": {"@id": "data.csv"},
                                "extract": {"column": "id"},
                            },
                        },
                        {
                            "@type": "cr:Field",
                            "@id": "records/name",
                            "dataType": "sc:Text",
                            "source": {
                                "fileObject": {"@id": "data.csv"},
                                "extract": {"column": "name"},
                            },
                        },
                    ],
                },
            }
        )
    )

    result = await _call_tool(
        "load_dataset",
        {
            "metadata_source": str(metadata_path),
            "agent_context": {},
            "record_set": "records",
            "max_records": 1,
        },
    )

    assert result["action"] == "ALLOW"
    assert result["records"] == [{"records/id": 1, "records/name": "Ada"}]
