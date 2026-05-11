"""Tests for list_presets MCP tool."""

import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from server import list_presets, PresetListResult, PresetInfo


def test_list_presets_returns_result():
    """Should return PresetListResult."""
    result = list_presets()

    assert isinstance(result, PresetListResult)
    assert result.total > 0


def test_list_presets_includes_production_presets():
    """Should include all production presets."""
    result = list_presets()

    production_names = ["Swiss Modern", "Enterprise Dark", "Data Story", "Blue Sky"]
    found_names = [p.name for p in result.presets]

    for name in production_names:
        assert name in found_names, f"Missing production preset: {name}"


def test_list_presets_all_have_support_tier():
    """Each preset should have a valid support tier."""
    result = list_presets()

    valid_tiers = {"production", "supported", "experimental", "archive_candidate"}
    for preset in result.presets:
        assert preset.support_tier in valid_tiers, f"Invalid tier: {preset.support_tier}"


def test_list_presets_all_have_description():
    """Each preset should have a non-empty description."""
    result = list_presets()

    for preset in result.presets:
        assert len(preset.description) > 0, f"Empty description for: {preset.name}"


def test_list_presets_returns_pydantic_model():
    """Result should be PresetListResult Pydantic model."""
    result = list_presets()

    assert hasattr(result, "model_dump")
    dumped = result.model_dump()
    assert isinstance(dumped, dict)
    assert "presets" in dumped
    assert "total" in dumped


def test_list_presets_total_matches_count():
    """Total should equal number of presets."""
    result = list_presets()

    assert result.total == len(result.presets)
