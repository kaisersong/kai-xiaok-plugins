"""Test MCP server via real stdio transport protocol (JSON-RPC over NDJSON)."""

import json
import subprocess
import sys
import time
from pathlib import Path

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server.py"
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _start_server():
    """Start the MCP server as a subprocess with stdio transport."""
    proc = subprocess.Popen(
        [sys.executable, str(SERVER_SCRIPT)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    return proc


def _send(proc, request):
    """Send a JSON-RPC request and read the response (NDJSON)."""
    line = json.dumps(request) + "\n"
    proc.stdin.write(line)
    proc.stdin.flush()
    # Read response line — MCP server may emit notifications before the result,
    # so skip non-matching lines until we get a response with matching id.
    while True:
        response_line = proc.stdout.readline()
        if not response_line:
            raise RuntimeError("Server closed stdout unexpectedly")
        response = json.loads(response_line)
        if "id" in response and response["id"] == request.get("id"):
            return response
        # Otherwise it's a notification; keep reading


def _initialize(proc, request_id=1):
    """Send the MCP initialize request."""
    return _send(proc, {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "0.1.0"},
        },
    })


def _send_initialized_notification(proc):
    """Send the initialized notification (required after initialize response)."""
    notification = {
        "jsonrpc": "2.0",
        "method": "notifications/initialized",
    }
    line = json.dumps(notification) + "\n"
    proc.stdin.write(line)
    proc.stdin.flush()


def test_server_starts_via_stdio():
    """Server should start and respond to initialize."""
    proc = _start_server()
    try:
        response = _initialize(proc)
        assert "result" in response, f"Missing 'result' in response: {response}"
        assert "protocolVersion" in response["result"], (
            f"Missing 'protocolVersion' in result: {response['result']}"
        )
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def test_list_tools_via_stdio():
    """Server should list tools via tools/list method."""
    proc = _start_server()
    try:
        _initialize(proc)
        _send_initialized_notification(proc)

        response = _send(proc, {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        })

        assert "result" in response, f"Missing 'result' in response: {response}"
        tools = response["result"].get("tools", [])
        tool_names = {t["name"] for t in tools}
        expected = {"validate_brief", "render_slide", "list_presets", "get_schema"}
        assert tool_names == expected, f"Expected {expected}, got {tool_names}"
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def test_call_tool_validate_brief_via_stdio():
    """Server should handle tools/call for validate_brief."""
    proc = _start_server()
    try:
        _initialize(proc)
        _send_initialized_notification(proc)

        # Load valid brief fixture
        brief_path = FIXTURES_DIR / "valid-brief.json"
        brief_content = brief_path.read_text(encoding="utf-8")

        response = _send(proc, {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "validate_brief",
                "arguments": {"brief_json": brief_content},
            },
        })

        assert "result" in response, f"Missing 'result' in response: {response}"
        content = response["result"].get("content", [])
        assert len(content) > 0, "No content in response"
        text = content[0]["text"]
        parsed = json.loads(text)
        assert parsed["valid"] is True, f"Expected valid=True, got: {parsed}"
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def test_call_tool_list_presets_via_stdio():
    """Server should handle tools/call for list_presets."""
    proc = _start_server()
    try:
        _initialize(proc)
        _send_initialized_notification(proc)

        response = _send(proc, {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "list_presets",
                "arguments": {},
            },
        })

        assert "result" in response, f"Missing 'result' in response: {response}"
        content = response["result"].get("content", [])
        assert len(content) > 0, "No content in response"
        text = content[0]["text"]
        parsed = json.loads(text)
        assert parsed["total"] > 0, f"Expected total>0, got: {parsed}"
        assert len(parsed["presets"]) > 0, f"Expected non-empty presets list, got: {parsed}"
    finally:
        proc.terminate()
        proc.wait(timeout=5)
