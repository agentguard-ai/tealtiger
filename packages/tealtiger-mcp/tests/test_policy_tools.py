"""Tests for `evaluate_action` and `policy_status`.

Same approach as `test_server.py`: no mocks, through the MCP layer, against the real
`tealtiger` engine. Governance that is only correct against a double is not governance.

Three things these are mostly here to hold:

1. **A missing or unreadable policy never produces an ALLOW.** The SDK spent 1.6.0 and
   1.7.0 removing an engine that permitted everything it was asked to govern; a server
   that answers "allowed" because it could not read its policy would reintroduce that one
   layer out.
2. **The policy comes from the server, never from the caller.** In an MCP deployment the
   client is the agent being governed, so a per-call policy would let it pick its own
   rules.
3. **`triggering_clause` survives the round trip.** It is what distinguishes a reasoned
   decision from a coincidence, and it is useless if the transport drops it.
"""

import json
from pathlib import Path

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from tealtiger_mcp import server as s

POLICY = {
    "tools": {
        "search": {"allowed": True},
        "file_delete": {"allowed": False},
    }
}


async def _call(name: str, args: dict) -> str:
    res = await s.mcp.call_tool(name, args)
    content = res[0] if isinstance(res, tuple) else res
    return content[0].text if content else ""


def _write_policy(tmp_path: Path, policy, name: str = "policy.json") -> Path:
    path = tmp_path / name
    path.write_text(
        policy if isinstance(policy, str) else json.dumps(policy), encoding="utf-8"
    )
    return path


@pytest.fixture
def configured(tmp_path, monkeypatch):
    """A server with a valid tool-allowlist policy configured."""
    monkeypatch.setenv(s.POLICY_FILE_ENV, str(_write_policy(tmp_path, POLICY)))
    monkeypatch.setattr(s, "_policy_state", None)
    return tmp_path


@pytest.fixture
def unconfigured(monkeypatch):
    monkeypatch.delenv(s.POLICY_FILE_ENV, raising=False)
    monkeypatch.setattr(s, "_policy_state", None)


class TestEvaluateActionEnforces:
    @pytest.mark.asyncio
    async def test_a_tool_configured_false_is_denied(self, configured):
        out = json.loads(
            await _call(
                "evaluate_action",
                {"action": "tool.execute", "tool": "file_delete"},
            )
        )

        assert out["action"] == "DENY"
        assert out["reason_codes"] == ["POLICY_VIOLATION", "TOOL_NOT_ALLOWED"]
        assert out["triggering_clause"] == "tools.file_delete.allowed"

    @pytest.mark.asyncio
    async def test_a_tool_configured_true_is_allowed(self, configured):
        out = json.loads(
            await _call("evaluate_action", {"action": "tool.execute", "tool": "search"})
        )

        assert out["action"] == "ALLOW"
        assert out["reason_codes"] == ["POLICY_COMPLIANT"]
        assert out["triggering_clause"] == "none"

    @pytest.mark.asyncio
    async def test_an_unconfigured_tool_is_denied_as_absent(self, configured):
        """Default-deny, and distinguishable from a configured denial by clause alone."""
        out = json.loads(
            await _call(
                "evaluate_action", {"action": "tool.execute", "tool": "unregistered"}
            )
        )

        assert out["action"] == "DENY"
        assert out["triggering_clause"] == "tools.unregistered.absent"

    @pytest.mark.asyncio
    async def test_absent_and_denied_are_distinguishable_over_the_wire(self, configured):
        """The clause is the only thing separating two different policy facts.

        Both are DENY with identical reason codes. If the transport dropped the
        clause, an operator could not tell "nobody configured this tool" from
        "somebody forbade it".
        """
        denied = json.loads(
            await _call(
                "evaluate_action", {"action": "tool.execute", "tool": "file_delete"}
            )
        )
        absent = json.loads(
            await _call("evaluate_action", {"action": "tool.execute", "tool": "nope"})
        )

        assert denied["action"] == absent["action"] == "DENY"
        assert denied["reason_codes"] == absent["reason_codes"]
        assert denied["triggering_clause"] != absent["triggering_clause"]

    @pytest.mark.asyncio
    async def test_a_tool_execute_without_a_tool_is_malformed_input(self, configured):
        """Reported as a precondition failure, not as a governance verdict."""
        out = json.loads(await _call("evaluate_action", {"action": "tool.execute"}))

        assert out["action"] == "DENY"
        assert out["triggering_clause"] == "request.tool.missing"
        assert "INVALID_REQUEST" in out["reason_codes"]
        assert "TOOL_NOT_ALLOWED" not in out["reason_codes"]

    @pytest.mark.asyncio
    async def test_a_non_tool_action_is_unaffected(self, configured):
        out = json.loads(await _call("evaluate_action", {"action": "chat.create"}))

        assert out["action"] == "ALLOW"
        assert out["triggering_clause"] == "none"

    @pytest.mark.asyncio
    async def test_the_agent_id_is_recorded_on_the_decision(self, configured):
        out = json.loads(
            await _call(
                "evaluate_action",
                {"action": "tool.execute", "tool": "search", "agent_id": "agent-42"},
            )
        )

        assert out["request"]["agentId"] == "agent-42"
        assert out["correlation_id"]


class TestEvaluateActionNeverGuesses:
    """Every path that cannot produce a real decision must refuse to produce one."""

    @pytest.mark.asyncio
    async def test_no_policy_configured_refuses(self, unconfigured):
        with pytest.raises(ToolError) as excinfo:
            await _call("evaluate_action", {"action": "tool.execute", "tool": "x"})

        assert s.POLICY_FILE_ENV in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_a_missing_policy_file_refuses(self, tmp_path, monkeypatch):
        monkeypatch.setenv(s.POLICY_FILE_ENV, str(tmp_path / "absent.json"))
        monkeypatch.setattr(s, "_policy_state", None)

        with pytest.raises(ToolError) as excinfo:
            await _call("evaluate_action", {"action": "tool.execute", "tool": "x"})

        assert "Cannot read the policy file" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_a_malformed_policy_file_refuses(self, tmp_path, monkeypatch):
        monkeypatch.setenv(
            s.POLICY_FILE_ENV, str(_write_policy(tmp_path, "{not json", "bad.json"))
        )
        monkeypatch.setattr(s, "_policy_state", None)

        with pytest.raises(ToolError) as excinfo:
            await _call("evaluate_action", {"action": "tool.execute", "tool": "x"})

        assert "not valid JSON" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_a_policy_we_cannot_enforce_refuses(self, tmp_path, monkeypatch):
        """Configuring content governance here must not yield an ALLOW.

        This is the case that matters most. A caller who writes a PII policy, points
        this server at it and receives ALLOW has been told their policy was applied.
        """
        monkeypatch.setenv(
            s.POLICY_FILE_ENV,
            str(_write_policy(tmp_path, {"content": {"pii": {"action": "deny"}}})),
        )
        monkeypatch.setattr(s, "_policy_state", None)

        with pytest.raises(ToolError) as excinfo:
            await _call("evaluate_action", {"action": "chat.create"})

        message = str(excinfo.value)
        assert "content" in message
        assert "check_pii" in message  # points at the tool that does work

    @pytest.mark.asyncio
    async def test_a_mixed_policy_refuses_rather_than_enforcing_half(
        self, tmp_path, monkeypatch
    ):
        monkeypatch.setenv(
            s.POLICY_FILE_ENV,
            str(
                _write_policy(
                    tmp_path,
                    {
                        "tools": {"file_delete": {"allowed": False}},
                        "content": {"pii": {"action": "deny"}},
                    },
                )
            ),
        )
        monkeypatch.setattr(s, "_policy_state", None)

        with pytest.raises(ToolError):
            await _call(
                "evaluate_action", {"action": "tool.execute", "tool": "file_delete"}
            )

    @pytest.mark.asyncio
    async def test_empty_arguments_are_rejected(self, configured):
        for args in (
            {"action": "   "},
            {"action": "tool.execute", "tool": "   "},
            {"action": "tool.execute", "tool": "search", "agent_id": "  "},
        ):
            with pytest.raises(ToolError):
                await _call("evaluate_action", args)


class TestThePolicyComesFromTheServer:
    @pytest.mark.asyncio
    async def test_the_tool_accepts_no_policy_argument(self, configured):
        """The governed party must not be able to supply the rules it is judged by."""
        tools = await s.mcp.list_tools()
        schema = next(t for t in tools if t.name == "evaluate_action").inputSchema

        assert set(schema["properties"]) == {"action", "tool", "agent_id"}
        assert "policy" not in schema["properties"]
        assert "policies" not in schema["properties"]

    @pytest.mark.asyncio
    async def test_a_smuggled_policy_argument_has_no_effect(self, configured):
        """The MCP layer silently drops undeclared arguments, so this must not rely
        on an error to stay safe.

        A caller passing `policy=...` gets no rejection — FastMCP discards it. The
        server's policy governs regardless, which is the outcome that matters: a
        permissive policy smuggled in by the governed party does not take effect.

        Verified rather than assumed, because "the framework ignores it" is the kind
        of claim that silently stops being true on a dependency upgrade.
        """
        out = json.loads(
            await _call(
                "evaluate_action",
                {
                    "action": "tool.execute",
                    "tool": "file_delete",
                    "policy": {"tools": {"file_delete": {"allowed": True}}},
                },
            )
        )

        assert out["action"] == "DENY"
        assert out["triggering_clause"] == "tools.file_delete.allowed"

    @pytest.mark.asyncio
    async def test_the_decision_says_whose_policy_produced_it(self, configured):
        """Since a smuggled argument is dropped silently, the answer has to be explicit.

        Otherwise a caller who passed its own policy and received an ALLOW could
        reasonably conclude its policy was applied.
        """
        out = json.loads(
            await _call("evaluate_action", {"action": "tool.execute", "tool": "search"})
        )

        assert out["policy_source"] == "server"
        assert out["policy_file"].endswith("policy.json")
        assert set(out["request"]) == {"agentId", "action", "tool"}


class TestPolicyStatusIsAnswerableBeforeEvaluating:
    @pytest.mark.asyncio
    async def test_it_reports_what_is_enforced(self, configured):
        out = json.loads(await _call("policy_status", {}))

        assert out["policy_loaded"] is True
        assert out["enforced_rule_types"] == ["tools"]
        assert out["rule_type_support"]["content"] == "unspecified"
        assert out["error"] is None

    @pytest.mark.asyncio
    async def test_it_reports_a_missing_policy_without_raising(self, unconfigured):
        """Discovery must not require triggering the failure it is discovering."""
        out = json.loads(await _call("policy_status", {}))

        assert out["policy_configured"] is False
        assert out["policy_loaded"] is False
        assert s.POLICY_FILE_ENV in out["error"]

    @pytest.mark.asyncio
    async def test_it_reports_an_unenforceable_policy_without_raising(
        self, tmp_path, monkeypatch
    ):
        monkeypatch.setenv(
            s.POLICY_FILE_ENV,
            str(_write_policy(tmp_path, {"content": {"pii": {"action": "deny"}}})),
        )
        monkeypatch.setattr(s, "_policy_state", None)

        out = json.loads(await _call("policy_status", {}))

        assert out["policy_configured"] is True
        assert out["policy_loaded"] is False
        assert "content" in out["error"]

    @pytest.mark.asyncio
    async def test_both_tools_say_the_decision_is_advisory(self, configured):
        """An MCP server cannot intercept the client. Saying so is part of the contract.

        The feasibility assessment ruled out exposing circuit breaking over MCP for
        this reason — "weak governance wearing the costume of governance". The same
        limit applies here in weaker form, and the honest response is to state it
        rather than to let a caller infer a control point that does not exist.
        """
        status = json.loads(await _call("policy_status", {}))
        decision = json.loads(
            await _call("evaluate_action", {"action": "tool.execute", "tool": "search"})
        )

        assert status["enforcement_is_advisory"] is True
        assert decision["enforcement_is_advisory"] is True
        assert "cannot intercept" in status["note"]


class TestTheServerRefusesToStartOnABrokenPolicy:
    def test_main_exits_when_the_configured_policy_is_unusable(
        self, tmp_path, monkeypatch
    ):
        """Better than coming up healthy with governance that cannot answer."""
        monkeypatch.setenv(
            s.POLICY_FILE_ENV,
            str(_write_policy(tmp_path, {"content": {"pii": {"action": "deny"}}})),
        )
        monkeypatch.setattr(s, "_policy_state", None)
        monkeypatch.setattr(s.mcp, "run", lambda: pytest.fail("should not have started"))

        with pytest.raises(SystemExit) as excinfo:
            s.main()

        assert excinfo.value.code == 2

    def test_main_starts_when_no_policy_is_configured(self, unconfigured, monkeypatch):
        """The other 12 tools do not need a policy, so absence is not a failure."""
        started = []
        monkeypatch.setattr(s.mcp, "run", lambda: started.append(True))

        s.main()

        assert started == [True]

    def test_main_starts_with_a_valid_policy(self, configured, monkeypatch):
        started = []
        monkeypatch.setattr(s.mcp, "run", lambda: started.append(True))

        s.main()

        assert started == [True]
