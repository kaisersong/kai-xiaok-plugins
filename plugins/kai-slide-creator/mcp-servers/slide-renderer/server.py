"""MCP stdio server for slide-creator deterministic rendering."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from mcp.server import FastMCP
from pydantic import BaseModel, Field

# Resolve plugin root (parent of mcp-servers/slide-renderer/)
PLUGIN_ROOT = Path(__file__).resolve().parent.parent.parent
REFERENCES_DIR = PLUGIN_ROOT / "references"
SCHEMAS_DIR = PLUGIN_ROOT / "schemas"

# Import rendering engine from symlinked scripts (or vendored copies)
SERVER_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = SERVER_DIR  # scripts vendored/symlinked at server level
sys.path.insert(0, str(SCRIPTS_DIR))

from low_context import (
    validate_brief_path,
    load_brief,
    render_from_brief,
    BriefValidationError,
    RenderError,
)
from preset_support import preset_support_tier, load_preset_support_matrix


mcp = FastMCP(
    name="slide-renderer",
    instructions="Deterministic HTML rendering from BRIEF.json IR",
)


class ValidationResult(BaseModel):
    """Result of BRIEF validation."""
    valid: bool = Field(description="Whether the BRIEF is valid")
    errors: list[str] = Field(description="Validation error messages")
    warnings: list[str] = Field(default_factory=list, description="Non-fatal warnings")


class RenderResult(BaseModel):
    """Result of HTML rendering."""
    success: bool = Field(description="Whether rendering succeeded")
    html: str = Field(description="Generated HTML content")
    preset: str = Field(description="Preset name used")
    quality_tier: str = Field(description="Quality tier assigned")
    errors: list[str] = Field(default_factory=list, description="Error messages")
    stats: dict[str, Any] = Field(default_factory=dict, description="Render statistics")


class PresetInfo(BaseModel):
    """Information about a preset."""
    name: str = Field(description="Preset name")
    support_tier: str = Field(description="Support tier (production/stable/experimental)")
    description: str = Field(description="Short description")


class PresetListResult(BaseModel):
    """List of available presets."""
    presets: list[PresetInfo] = Field(description="Available presets")
    total: int = Field(description="Total count")


@mcp.tool()
def validate_brief(brief_json: str) -> ValidationResult:
    """Validate a BRIEF.json string for schema correctness.

    Args:
        brief_json: JSON string containing the BRIEF

    Returns:
        Validation result with errors/warnings
    """
    try:
        brief_data = json.loads(brief_json)
        # Write to temp file for validate_brief_path (it expects a Path)
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write(brief_json)
            temp_path = Path(f.name)

        try:
            is_valid, errors, _brief = validate_brief_path(temp_path)
            # Also check preset support
            if is_valid and isinstance(brief_data, dict):
                preset = brief_data.get("style", {}).get("preset", "")
                if preset:
                    try:
                        preset_support_tier(preset)
                    except KeyError:
                        errors.append(f"Unknown preset: '{preset}' is not in the support matrix")
                        is_valid = False
            return ValidationResult(
                valid=is_valid,
                errors=errors,
                warnings=[]
            )
        finally:
            temp_path.unlink(missing_ok=True)
    except json.JSONDecodeError as e:
        return ValidationResult(
            valid=False,
            errors=[f"JSON parse error: {e}"],
            warnings=[]
        )
    except Exception as e:
        return ValidationResult(
            valid=False,
            errors=[f"Unexpected error: {e}"],
            warnings=[]
        )


@mcp.tool()
def render_slide(brief_json: str, output_path: str | None = None) -> RenderResult:
    """Render HTML slide deck from BRIEF.json.

    Args:
        brief_json: JSON string containing the BRIEF
        output_path: Optional path to write HTML file (defaults to ./output.html)

    Returns:
        Render result with HTML content and metadata
    """
    try:
        brief_data = json.loads(brief_json)

        # Validate BRIEF first
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write(brief_json)
            temp_brief_path = Path(f.name)

        try:
            is_valid, errors, _brief = validate_brief_path(temp_brief_path)
            if not is_valid:
                return RenderResult(
                    success=False,
                    html="",
                    preset="",
                    quality_tier="",
                    errors=[f"BRIEF validation failed: {', '.join(errors)}"]
                )
        finally:
            temp_brief_path.unlink(missing_ok=True)

        # Render HTML
        html_text, packet, style_contract = render_from_brief(brief_data)

        # Pre-write strict validation (same as main.py)
        from validate_html import validate
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
            f.write(html_text)
            temp_html_path = Path(f.name)

        try:
            passed_strict = validate(temp_html_path, strict=True)
            if not passed_strict:
                return RenderResult(
                    success=False,
                    html="",
                    preset=brief_data["style"]["preset"],
                    quality_tier="",
                    errors=["Strict pre-write validation failed; HTML rejected"]
                )
        finally:
            temp_html_path.unlink(missing_ok=True)

        # Default output path
        if output_path is None:
            output_path = "./output.html"

        # Stamp validation status and write
        from low_context import stamp_validation_status
        final_html = stamp_validation_status(html_text, status="pass")
        Path(output_path).write_text(final_html, encoding="utf-8")

        return RenderResult(
            success=True,
            html=final_html,
            preset=brief_data["style"]["preset"],
            quality_tier=packet.get("quality_tier", "unknown"),
            stats={
                "html_bytes": len(final_html),
                "page_count": brief_data["deck"]["page_count"],
            }
        )
    except json.JSONDecodeError as e:
        return RenderResult(
            success=False,
            html="",
            preset="",
            quality_tier="",
            errors=[f"JSON parse error: {e}"]
        )
    except BriefValidationError as e:
        return RenderResult(
            success=False,
            html="",
            preset="",
            quality_tier="",
            errors=[f"BRIEF validation error: {e}"]
        )
    except RenderError as e:
        return RenderResult(
            success=False,
            html="",
            preset="",
            quality_tier="",
            errors=[f"Render error: {e}"]
        )
    except Exception as e:
        return RenderResult(
            success=False,
            html="",
            preset="",
            quality_tier="",
            errors=[f"Unexpected error: {e}"]
        )


# Descriptions for presets, derived from style-index.md "Vibe + Best For"
_PRESET_DESCRIPTIONS: dict[str, str] = {
    "Swiss Modern": "Minimal, precise — Corporate, data",
    "Enterprise Dark": "Authoritative, data-driven — B2B, investor decks, strategy",
    "Data Story": "Clear, precise, persuasive — Business review, KPI, analytics",
    "Blue Sky": "Clean, airy, enterprise-ready — SaaS pitches, AI/tech decks",
    "Paper & Ink": "Literary, thoughtful — Storytelling",
    "Glassmorphism": "Light, translucent, modern — Consumer tech, brand launches",
    "Chinese Chan": "Still, contemplative — Design philosophy, brand, culture",
    "Bold Signal": "Confident, high-impact — Pitch decks, keynotes",
    "Aurora Mesh": "Vibrant, premium SaaS — Product launches, VC pitch",
    "Terminal Green": "Developer-focused — Dev tools, APIs",
    "Strategy Consulting": "Structured, authoritative, insight-driven — Strategy decks, board materials, due diligence",
    "Electric Studio": "Clean, professional — Agency presentations",
    "Creative Voltage": "Energetic, retro-modern — Creative pitches",
    "Dark Botanical": "Elegant, sophisticated — Premium brands",
    "Modern Newspaper": "Punchy, authoritative, editorial — Business reports, thought leadership",
    "Neon Cyber": "Futuristic, techy — Tech startups",
    "Notebook Tabs": "Editorial, organized — Reports, reviews",
    "Pastel Geometry": "Friendly, approachable — Product overviews",
    "Split Pastel": "Playful, modern — Creative agencies",
    "Vintage Editorial": "Witty, personality-driven — Personal brands",
    "Neo-Brutalism": "Bold, uncompromising — Indie dev, creative manifesto",
    "Neo-Retro Dev Deck": "Opinionated, technical, handmade — Dev tool launches, API docs, hackathon",
}


@mcp.tool()
def list_presets() -> PresetListResult:
    """List all available slide presets.

    Returns:
        List of presets with support tier and description
    """
    # Load preset support tiers via preset_support module
    try:
        matrix = load_preset_support_matrix()
        tiers = matrix.get("tiers", {})
    except Exception:
        # Fallback if file not found
        tiers = {
            "production": ["Swiss Modern", "Enterprise Dark", "Data Story", "Blue Sky"],
            "supported": [],
            "experimental": [],
        }

    presets = []
    for tier, names in tiers.items():
        for name in names:
            presets.append(PresetInfo(
                name=name,
                support_tier=tier,
                description=_PRESET_DESCRIPTIONS.get(name, f"{name} preset"),
            ))

    return PresetListResult(
        presets=presets,
        total=len(presets),
    )


@mcp.tool()
def get_schema() -> str:
    """Get the BRIEF.json schema.

    Returns:
        JSON schema as string
    """
    schema_path = SCHEMAS_DIR / "generation-brief.schema.json"
    if schema_path.exists():
        return schema_path.read_text(encoding="utf-8")
    else:
        # Return stub schema for initial test
        return json.dumps({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": ["schema_version", "brief_id", "mode", "language", "title"],
        })


if __name__ == "__main__":
    mcp.run(transport="stdio")