"""Plugin-level integration tests for kai-slide-creator.

Verifies the plugin as a whole: required files, manifest validity,
end-to-end workflow, preset listing, and schema retrieval.
"""

import ast
import hashlib
import json
import re
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
from preset_contracts import load_preset_contract, validate_preset_fidelity

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
        "vendor-manifest.json",
        "skills/slide-planner/SKILL.md",
        "mcp-servers/slide-renderer/server.py",
        "mcp-servers/slide-renderer/preset_contracts.py",
        "mcp-servers/slide-renderer/style_signature_eval.py",
        "mcp-servers/slide-renderer/preset_runtime_qa.py",
        "schemas/generation-brief.schema.json",
        "schemas/preset-contract.schema.json",
        "schemas/preset-manifest.schema.json",
        "references/preset-support-tiers.json",
        "references/preset-contracts/blue-sky.json",
        "references/preset-manifests/blue-sky.json",
        "references/blue-sky-starter.html",
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

    def test_release_version_is_consistent_and_current(self, plugin_json: dict):
        registry = json.loads((PLUGIN_ROOT.parents[1] / "registry.json").read_text(encoding="utf-8"))
        registry_entry = next(
            plugin for plugin in registry["plugins"] if plugin["name"] == "kai-slide-creator"
        )
        skill_text = (PLUGIN_ROOT / "skills" / "slide-planner" / "SKILL.md").read_text(
            encoding="utf-8"
        )
        skill_version = re.search(r"^version:\s*([^\s]+)\s*$", skill_text, re.MULTILINE)

        assert skill_version is not None
        versions = {
            "plugin.json": plugin_json["version"],
            "registry.json": registry_entry["version"],
            "skills/slide-planner/SKILL.md": skill_version.group(1),
        }
        assert set(versions.values()) == {"3.2.1"}, versions

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


class TestVendoredPresetFidelity:
    REQUIRED_RENDERER_SCRIPTS = {
        "check_style_fidelity.py",
        "low_context.py",
        "preset_capabilities.py",
        "preset_contracts.py",
        "preset_profile_renderer.py",
        "preset_profile_specs.py",
        "preset_runtime_qa.py",
        "preset_support.py",
        "style_signature_eval.py",
        "title_profiles.py",
        "validate_html.py",
    }

    def test_vendor_preserves_plugin_owned_custom_themes(self):
        vendor_script = (PLUGIN_ROOT.parents[1] / "scripts" / "vendor.sh").read_text(encoding="utf-8")

        assert "rsync -a --exclude '.DS_Store' \"$src/themes/\" \"$dst/themes/\"" in vendor_script
        assert "rsync -a --delete --exclude '.DS_Store' \"$src/themes/\"" not in vendor_script

    def test_vendor_manifest_binds_complete_dependency_closure(self):
        manifest = json.loads((PLUGIN_ROOT / "vendor-manifest.json").read_text(encoding="utf-8"))
        recorded = manifest["files"]
        expected = {
            f"mcp-servers/slide-renderer/{name}"
            for name in self.REQUIRED_RENDERER_SCRIPTS
        }
        for root_name in ("schemas", "references", "themes"):
            root = PLUGIN_ROOT / root_name
            expected.update(str(path.relative_to(PLUGIN_ROOT)) for path in root.rglob("*") if path.is_file())
        expected.update(
            str(path.relative_to(PLUGIN_ROOT))
            for path in (PLUGIN_ROOT / "demos").rglob("*.html")
            if path.is_file()
        )

        assert manifest["version"] == 1
        assert manifest["source"] == "slide-creator"
        assert set(recorded) == expected
        for rel_path, expected_hash in recorded.items():
            actual_hash = hashlib.sha256((PLUGIN_ROOT / rel_path).read_bytes()).hexdigest()
            assert actual_hash == expected_hash, rel_path

    def test_vendored_renderer_scripts_cover_local_direct_imports(self):
        recorded = json.loads((PLUGIN_ROOT / "vendor-manifest.json").read_text(encoding="utf-8"))["files"]
        available_modules = {path.stem for path in SERVER_DIR.glob("*.py")}
        for name in self.REQUIRED_RENDERER_SCRIPTS:
            tree = ast.parse((SERVER_DIR / name).read_text(encoding="utf-8"))
            imports = {
                imported.name.split(".")[0]
                for node in ast.walk(tree)
                if isinstance(node, ast.Import)
                for imported in node.names
            }
            imports.update(
                node.module.split(".")[0]
                for node in ast.walk(tree)
                if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module
            )
            for module in imports & available_modules:
                assert f"mcp-servers/slide-renderer/{module}.py" in recorded, (name, module)

    def test_all_contracts_and_manifests_are_vendored(self):
        contracts = sorted((PLUGIN_ROOT / "references" / "preset-contracts").glob("*.json"))
        manifests = sorted((PLUGIN_ROOT / "references" / "preset-manifests").glob("*.json"))

        assert len(contracts) == 22
        assert len(manifests) == 22
        assert load_preset_contract("Blue Sky")["runtime_fidelity"]["runtime_owner"] == "blue-sky-stage-track"

    def test_blue_sky_render_passes_vendored_canonical_fidelity(self):
        brief = json.loads(load_fixture("valid-brief.json"))
        brief["brief_id"] = "plugin-blue-sky-fidelity"
        brief["style"]["preset"] = "Blue Sky"

        result = render_slide(json.dumps(brief, ensure_ascii=False))

        assert result.success is True, result.errors
        report = validate_preset_fidelity(result.html, "Blue Sky", mode="product")
        assert report["pass"] is True, report
