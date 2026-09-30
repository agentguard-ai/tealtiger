"""CLI validation and real MCP protocol checks (no external services)."""

import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from unittest.mock import Mock

import anyio
import pytest
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client

from tealtiger_mcp import server


@pytest.fixture
def run_server(monkeypatch):
    # Each invocation may replace network settings; keep global state isolated.
    monkeypatch.setattr(server.mcp, "settings", server.mcp.settings.model_copy(deep=True))
    run = Mock()
    monkeypatch.setattr(server.mcp, "run", run)
    return run


@pytest.mark.parametrize("argv", [[], ["--transport", "stdio"]])
def test_stdio_default(run_server, argv):
    settings = server.mcp.settings
    server.main(argv)
    run_server.assert_called_once_with(transport="stdio")
    assert server.mcp.settings is settings


def test_main_reads_process_arguments(run_server, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["tealtiger-mcp"])
    server.main()
    run_server.assert_called_once_with(transport="stdio")


def test_stdio_ignores_network_options(run_server):
    settings = server.mcp.settings
    server.main(["--transport", "stdio", "--host", "0.0.0.0", "--port", "8123"])
    run_server.assert_called_once_with(transport="stdio")
    assert server.mcp.settings is settings


@pytest.mark.parametrize("transport", ["sse", "streamable-http"])
@pytest.mark.parametrize("options,host,port", [
    ([], "127.0.0.1", 8000),
    (["--host", "0.0.0.0", "--port", "8123"], "0.0.0.0", 8123),
    (["--host", "::1", "--port", "65535"], "::1", 65535),
])
def test_network_settings(run_server, transport, options, host, port):
    server.main(["--transport", transport, *options])
    run_server.assert_called_once_with(transport=transport)
    assert server.mcp.settings.host == host
    assert server.mcp.settings.port == port


@pytest.mark.parametrize("transport", ["sse", "streamable-http"])
def test_network_defaults_override_environment(run_server, monkeypatch, transport):
    monkeypatch.setenv("FASTMCP_HOST", "0.0.0.0")
    monkeypatch.setenv("FASTMCP_PORT", "9000")
    server.main(["--transport", transport])
    assert server.mcp.settings.host == "127.0.0.1"
    assert server.mcp.settings.port == 8000


def test_help(run_server, capsys):
    with pytest.raises(SystemExit) as exc:
        server.main(["--help"])
    assert exc.value.code == 0
    output = capsys.readouterr()
    for text in ("stdio", "sse", "streamable-http", "--host", "127.0.0.1", "--port", "8000"):
        assert text in output.out
    assert not output.err
    run_server.assert_not_called()


@pytest.mark.parametrize("argv,message", [
    (["--transport", "http"], "invalid choice"),
    (["--port", "abc"], "port must be an integer"),
    (["--port", "0"], "port must be between 1 and 65535"),
    (["--port", "-1"], "port must be between 1 and 65535"),
    (["--port", "65536"], "port must be between 1 and 65535"),
    (["--host", ""], "host must not be empty"),
    (["--unknown"], "unrecognized arguments"),
    (["--transport"], "expected one argument"),
])
def test_invalid_arguments(run_server, capsys, argv, message):
    with pytest.raises(SystemExit) as exc:
        server.main(argv)
    assert exc.value.code == 2
    output = capsys.readouterr()
    assert message in output.err
    assert not output.out
    run_server.assert_not_called()


def _environment():
    # Ignore local FastMCP overrides and proxies in reproducible smoke checks.
    env = {key: value for key, value in os.environ.items()
           if not key.startswith("FASTMCP_")}
    env["NO_PROXY"] = "127.0.0.1,localhost"
    return env


def test_import_has_no_cli_or_startup_side_effects():
    result = subprocess.run(
        [sys.executable, "-c", "import tealtiger_mcp.server", "--invalid-cli-option"],
        capture_output=True, text=True, timeout=20, env=_environment(),
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == ""


@pytest.mark.asyncio
@pytest.mark.parametrize("args", [[], ["--transport", "stdio"]])
async def test_stdio_initialization(args):
    with tempfile.TemporaryFile() as errors:
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "tealtiger_mcp.server", *args,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=errors, env=_environment(),
        )
        try:
            request = {
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                           "clientInfo": {"name": "transport-test", "version": "1"}},
            }
            process.stdin.write((json.dumps(request) + "\n").encode())
            await process.stdin.drain()
            line = await asyncio.wait_for(process.stdout.readline(), 20)
            errors.seek(0)
            assert line, errors.read().decode(errors="replace")
            # Strict JSON parsing also rejects stray diagnostics on stdout.
            response = json.loads(line)
            assert response["id"] == 1
            assert response["result"]["serverInfo"]["name"] == "TealTiger"
        finally:
            if process.returncode is None:
                process.terminate()
            try:
                await asyncio.wait_for(process.wait(), 5)
            except asyncio.TimeoutError:
                process.kill()
                await asyncio.wait_for(process.wait(), 5)


@pytest.mark.asyncio
@pytest.mark.parametrize("transport,path", [("sse", "/sse"), ("streamable-http", "/mcp")])
@pytest.mark.parametrize("host", ["127.0.0.1", "0.0.0.0"])
async def test_network_initialization(transport, path, host):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]

    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(
            [sys.executable, "-m", "tealtiger_mcp.server", "--transport", transport,
             "--host", host, "--port", str(port)],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=errors,
            env=_environment(),
        )
        try:
            deadline = time.monotonic() + 20
            while True:
                assert process.poll() is None, "server exited before listening"
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                        break
                except OSError:
                    assert time.monotonic() < deadline, "server did not listen within 20 seconds"
                    await asyncio.sleep(0.05)

            client = sse_client if transport == "sse" else streamablehttp_client
            with anyio.fail_after(20):
                async with client(f"http://127.0.0.1:{port}{path}") as streams:
                    async with ClientSession(streams[0], streams[1]) as session:
                        response = await session.initialize()
                        assert response.serverInfo.name == "TealTiger"
                        tools = await session.list_tools()
                        assert {tool.name for tool in tools.tools} == {
                            tool.name for tool in await server.mcp.list_tools()
                        }
                        result = await session.call_tool("check_pii", {"text": "email a@b.com"})
                        assert not result.isError
                        assert "[REDACTED" in result.content[0].text
        finally:
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            errors.seek(0)
            # Retained by pytest on failure, including early server exits.
            print(errors.read().decode(errors="replace"), file=sys.stderr)
