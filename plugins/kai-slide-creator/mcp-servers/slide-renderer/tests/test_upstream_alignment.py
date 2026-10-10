"""Regression contracts introduced by the formal 2.31.0 upstream sync."""
import json
from pathlib import Path

from server import render_slide, get_model_context

FIXTURE = Path(__file__).parent / "fixtures" / "valid-brief.json"


def test_user_preset_mismatch_preserves_existing_output(tmp_path):
    output = tmp_path / "deck.html"
    output.write_text("existing deck")
    result = render_slide(FIXTURE.read_text(), str(output), requested_preset="Blue Sky")
    assert not result.success
    assert "PRESET MISMATCH" in " ".join(result.errors)
    assert output.read_text() == "existing deck"


def test_user_preset_alias_renders_through_canonical_path(tmp_path):
    result = render_slide(FIXTURE.read_text(), str(tmp_path / "deck.html"), requested_preset="data-story")
    assert result.success, result.errors
    assert 'data-validate-strict="pass"' in result.html


def test_compact_context_has_current_evidence_contract_without_runtime():
    context = get_model_context("Blue Sky")
    assert context["brief_skeleton"]["style"]["preset"] == "Blue Sky"
    assert "supporting_facts" in context["slide_optional"]
    assert any("requested_preset" in rule for rule in context["rules"])
    encoded = json.dumps(context)
    assert "<script" not in encoded and "<style" not in encoded


import pytest
from bs4 import BeautifulSoup

@pytest.mark.parametrize("theme,user_name", [("shader-hero", "极光封面"), ("molten-flow", "熔金流体"), ("stellar-vortex", "星核跃迁")])
@pytest.mark.parametrize("intent", ["none", "png"])
def test_new_cover_theme_preserves_facts_and_static_export(theme, user_name, intent, tmp_path):
    brief = json.loads((FIXTURE.parent / "animated-covers" / (theme + ".json")).read_text())
    brief["runtime"]["export_intent"] = intent
    brief["narrative"]["slides"][1]["supporting_facts"] = ["客户增长 18%", "成本下降 12%", "三个月内完成迁移"]
    result = render_slide(json.dumps(brief), str(tmp_path / "deck.html"), requested_preset=user_name)
    assert result.success, result.errors
    soup = BeautifulSoup(result.html, "html.parser")
    assert len(soup.select(".sh-scene--cover")) == 1
    assert len(soup.select("canvas")) == (1 if intent == "none" else 0)
    assert not soup.select(".sh-scene--content canvas, .sh-scene--closing canvas")
    assert "客户增长 18%" in soup.select(".slide")[1].get_text()
    assert 'data-validate-strict="pass"' in result.html
