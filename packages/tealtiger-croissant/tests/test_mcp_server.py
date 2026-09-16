import json
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
