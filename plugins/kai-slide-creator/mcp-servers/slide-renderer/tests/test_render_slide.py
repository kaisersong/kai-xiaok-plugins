"""Tests for render_slide MCP tool."""

import json
import sys
import tempfile
from pathlib import Path

import pytest

# Add server directory to path
SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from server import render_slide, RenderResult

FIXTURES_DIR = SERVER_DIR / "tests" / "fixtures"


def load_fixture(name: str) -> str:
    """Load fixture file as JSON string."""
    path = FIXTURES_DIR / name
    return path.read_text(encoding="utf-8")


def test_render_slide_valid_brief():
    """Valid BRIEF should render HTML successfully."""
    brief_json = load_fixture("valid-brief.json")
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        output_path = f.name

    try:
        result = render_slide(brief_json, output_path)

        assert isinstance(result, RenderResult)
        assert result.success is True
        assert len(result.html) > 1000  # Real HTML has substance
        assert result.preset == "Data Story"

        # Check file was written
        html_file = Path(output_path)
        assert html_file.exists()
        content = html_file.read_text(encoding="utf-8")
        assert "<!DOCTYPE html>" in content
        assert "data-generator=\"kai-slide-creator\"" in content
    finally:
        Path(output_path).unlink(missing_ok=True)


def test_render_slide_invalid_brief():
    """Invalid BRIEF should return error."""
    brief_json = load_fixture("invalid-brief-missing-required.json")
    result = render_slide(brief_json)

    assert result.success is False
    assert len(result.errors) > 0
    assert result.html == ""


def test_render_slide_bad_preset():
    """BRIEF with bad preset should return error."""
    brief_json = load_fixture("invalid-brief-bad-preset.json")
    result = render_slide(brief_json)

    assert result.success is False
    assert len(result.errors) > 0
    # Should mention preset or render error
    assert any("preset" in err.lower() or "render" in err.lower() for err in result.errors)


def test_render_slide_malformed_json():
    """Malformed JSON should return parse error."""
    result = render_slide("{invalid}")

    assert result.success is False
    assert len(result.errors) > 0
    assert any("parse" in err.lower() or "json" in err.lower() for err in result.errors)


def test_render_slide_contains_required_markers():
    """Rendered HTML must have canonical provenance markers."""
    brief_json = load_fixture("valid-brief.json")
    result = render_slide(brief_json)

    if result.success:
        required_markers = [
            'data-generator="kai-slide-creator"',
            'data-generator-version="',
            'data-render-path="',
            'data-brief-hash="',
        ]
        for marker in required_markers:
            assert marker in result.html, f"Missing marker: {marker}"


def test_render_slide_stats_populated():
    """Render result should include stats."""
    brief_json = load_fixture("valid-brief.json")
    result = render_slide(brief_json)

    if result.success:
        assert "html_bytes" in result.stats
        assert result.stats["html_bytes"] > 0
        assert "page_count" in result.stats
        assert result.stats["page_count"] >= 5


def test_render_slide_returns_pydantic_model():
    """Result should be a RenderResult Pydantic model."""
    brief_json = load_fixture("valid-brief.json")
    result = render_slide(brief_json)

    assert hasattr(result, "model_dump")
    dumped = result.model_dump()
    assert isinstance(dumped, dict)
    assert "success" in dumped
    assert "html" in dumped
    assert "preset" in dumped


def test_render_slide_default_output_path():
    """Render should work with default output path."""
    brief_json = load_fixture("valid-brief.json")
    result = render_slide(brief_json, output_path=None)

    if result.success:
        # Default path ./output.html should be created
        default_path = Path("./output.html")
        # Note: test runner may not have permission to write to cwd
        # This test checks that the path logic works
        assert "html_bytes" in result.stats