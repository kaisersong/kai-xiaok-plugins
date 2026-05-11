"""Plugin-level integration tests for kai-slide-creator.

Verifies the plugin as a whole: required files, manifest validity,
end-to-end workflow, preset listing, and schema retrieval.
"""

import json
import sys
import tempfile
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
PLUGIN_ROOT = Path(__file__).resolve().parent.parent
SERVER_DIR = PLUGIN_ROOT / "mcp-servers" / "slide-renderer"
sys.path.insert(0, str(SERVER_DIR))

from server import validate_brief, render_slide, list_presets, get_schema

FIXTURES_DIR = SERVER_DIR / "tests" / "fixtures"


def load_fixture(name: str) -> str:
    """Load fixture file as JSON string."""
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


# ===================================================================
# Test 1: Plugin has required files
# ===================================================================
class TestPluginHasRequiredFiles:
    """Plugin directory should contain all required structural files."""

    REQUIRED_FILES = [
        "plugin.json",
        "skills/slide-planner/SKILL.md",
        "mcp-servers/slide-renderer/server.py",
        "schemas/generation-brief.schema.json",
        "references/preset-support-tiers.json",
    ]

    @pytest.mark.parametrize("rel_path", REQUIRED_FILES,
                             ids=lambda p: p)
    def test_required_file_exists(self, rel_path: str):
        """Each required file must exist in the plugin root."""
        file_path = PLUGIN_ROOT / rel_path
        assert file_path.exists(), f"Missing required file: {rel_path}"
        assert file_path.is_file(), f"Expected a file, got something else: {rel_path}"


# ===================================================================
# Test 2: plugin.json is valid
# ===================================================================
class TestPluginJsonValid:
    """plugin.json should be valid JSON with required fields."""

    @pytest.fixture()
    def plugin_json(self) -> dict:
        path = PLUGIN_ROOT / "plugin.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_name_is_kai_slide_creator(self, plugin_json: dict):
        assert plugin_json["name"] == "kai-slide-creator"

    def test_skills_list_non_empty(self, plugin_json: dict):
        assert isinstance(plugin_json["skills"], list)
        assert len(plugin_json["skills"]) > 0

    def test_mcp_servers_list_non_empty(self, plugin_json: dict):
        assert isinstance(plugin_json["mcpServers"], list)
        assert len(plugin_json["mcpServers"]) > 0


# ===================================================================
# Test 3: Full workflow — valid brief → validate → render → HTML
# ===================================================================
class TestFullWorkflowValidBrief:
    """Validate-then-render pipeline for a valid BRIEF should produce HTML."""

    def test_full_workflow(self):
        brief_json = load_fixture("valid-brief.json")

        # Step 1: validate
        validation = validate_brief(brief_json)
        assert validation.valid is True, f"Expected valid, got errors: {validation.errors}"

        # Step 2: render
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
            output_path = f.name
        try:
            result = render_slide(brief_json, output_path)
            assert result.success is True, f"Render failed: {result.errors}"

            # HTML file must exist on disk
            html_file = Path(output_path)
            assert html_file.exists(), "Output HTML file was not created"

            content = html_file.read_text(encoding="utf-8")
            # Must contain canonical provenance markers
            assert 'data-generator="kai-slide-creator"' in content, \
                "Missing canonical marker: data-generator"
            assert 'data-generator-version="' in content, \
                "Missing canonical marker: data-generator-version"
            assert 'data-render-path="' in content, \
                "Missing canonical marker: data-render-path"
            assert 'data-brief-hash="' in content, \
                "Missing canonical marker: data-brief-hash"
        finally:
            Path(output_path).unlink(missing_ok=True)


# ===================================================================
# Test 4: Workflow stops at validation for invalid BRIEF
# ===================================================================
class TestWorkflowInvalidBriefStops:
    """Pipeline should stop at validation for an invalid BRIEF."""

    def test_invalid_brief_stops_at_validation(self):
        brief_json = load_fixture("invalid-brief-missing-required.json")

        # Step 1: validate — should be invalid
        validation = validate_brief(brief_json)
        assert validation.valid is False, "Expected invalid BRIEF to fail validation"
        assert len(validation.errors) > 0

        # Step 2: render — should fail
        result = render_slide(brief_json)
        assert result.success is False, "Render should not succeed for invalid BRIEF"
        assert len(result.errors) > 0
        assert result.html == ""


# ===================================================================
# Test 5: list_presets returns production presets
# ===================================================================
class TestListPresetsReturnsProductionPresets:
    """list_presets should return the expected production-tier presets."""

    EXPECTED_PRESETS = [
        "Swiss Modern",
        "Enterprise Dark",
        "Data Story",
        "Chinese Chan",
    ]

    def test_expected_presets_present(self):
        result = list_presets()
        preset_names = {p.name for p in result.presets}

        for name in self.EXPECTED_PRESETS:
            assert name in preset_names, f"Missing preset: {name}"

    def test_production_tier_presets(self):
        result = list_presets()
        production_names = {
            p.name for p in result.presets if p.support_tier == "production"
        }
        # The four production presets
        assert "Swiss Modern" in production_names
        assert "Enterprise Dark" in production_names
        assert "Data Story" in production_names
        assert "Blue Sky" in production_names


# ===================================================================
# Test 6: get_schema returns valid JSON Schema
# ===================================================================
class TestGetSchemaReturnsValidJsonSchema:
    """get_schema should return a valid JSON Schema document."""

    def test_schema_is_valid_json_schema(self):
        schema_str = get_schema()
        schema = json.loads(schema_str)

        # Must have $schema keyword
        assert "$schema" in schema, "Schema missing $schema keyword"

        # Must be type "object"
        assert schema.get("type") == "object", \
            f"Expected type='object', got '{schema.get('type')}'"

        # Must require "schema_version"
        required = schema.get("required", [])
        assert "schema_version" in required, \
            f"'schema_version' not in required fields: {required}"
