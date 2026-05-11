"""Tests for validate_brief MCP tool."""

import json
import sys
from pathlib import Path

import pytest

# Add server directory to path
SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from server import validate_brief, ValidationResult

FIXTURES_DIR = SERVER_DIR / "tests" / "fixtures"


def load_fixture(name: str) -> str:
    """Load fixture file as JSON string."""
    path = FIXTURES_DIR / name
    return path.read_text(encoding="utf-8")


def test_validate_brief_valid_input():
    """Valid BRIEF should pass validation."""
    brief_json = load_fixture("valid-brief.json")
    result = validate_brief(brief_json)

    assert isinstance(result, ValidationResult)
    assert result.valid is True
    assert len(result.errors) == 0


def test_validate_brief_missing_required_fields():
    """BRIEF missing required fields should fail."""
    brief_json = load_fixture("invalid-brief-missing-required.json")
    result = validate_brief(brief_json)

    assert result.valid is False
    assert len(result.errors) > 0
    # Should mention missing fields
    assert any("required" in err.lower() or "missing" in err.lower() for err in result.errors)


def test_validate_brief_bad_preset():
    """BRIEF with nonexistent preset should fail."""
    brief_json = load_fixture("invalid-brief-bad-preset.json")
    result = validate_brief(brief_json)

    assert result.valid is False
    assert len(result.errors) > 0
    # Should mention preset issue
    assert any("preset" in err.lower() for err in result.errors)


def test_validate_brief_malformed_json():
    """Malformed JSON should return parse error."""
    result = validate_brief("{invalid json}")

    assert result.valid is False
    assert len(result.errors) > 0
    assert any("parse" in err.lower() or "json" in err.lower() for err in result.errors)


def test_validate_brief_empty_string():
    """Empty string should fail."""
    result = validate_brief("")

    assert result.valid is False
    assert len(result.errors) > 0


def test_validate_brief_returns_pydantic_model():
    """Result should be a ValidationResult Pydantic model."""
    brief_json = load_fixture("valid-brief.json")
    result = validate_brief(brief_json)

    # Pydantic model has .model_dump() method
    assert hasattr(result, "model_dump")
    dumped = result.model_dump()
    assert isinstance(dumped, dict)
    assert "valid" in dumped
    assert "errors" in dumped
