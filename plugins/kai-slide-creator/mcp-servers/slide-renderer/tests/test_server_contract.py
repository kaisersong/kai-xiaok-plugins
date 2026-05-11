"""Test that MCP server module exists and has correct structure."""

import importlib
import sys
from pathlib import Path

# Add parent directory to path for imports
SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))


def test_server_module_exists():
    """Server module should be importable."""
    mod = importlib.import_module("server")
    assert mod is not None


def test_server_has_mcp_instance():
    """Server should expose an FastMCP instance named 'mcp'."""
    mod = importlib.import_module("server")
    assert hasattr(mod, "mcp")
    # Check it's a FastMCP (import from mcp package to verify type)
    from mcp.server import FastMCP
    assert isinstance(mod.mcp, FastMCP)


def test_server_has_expected_tools():
    """Server should register 4 tools."""
    mod = importlib.import_module("server")
    # FastMCP stores tools in _tool_manager._tools dict
    tool_names = list(mod.mcp._tool_manager._tools.keys())
    expected = ["validate_brief", "render_slide", "list_presets", "get_schema"]
    assert set(tool_names) == set(expected)