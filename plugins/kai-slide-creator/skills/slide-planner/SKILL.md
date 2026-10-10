---
name: slide-planner
description: Use when user wants to create HTML slide decks, presentations, pitch decks, or reports. Triggers on slide/presentation/deck/ppt/pitch/路演/幻灯片/演示.
version: 3.5.0
user-invocable: true
metadata: {"emoji":"🎞","os":["darwin","linux","windows"]}
---

# slide-planner

Generate zero-dependency HTML slide decks via BRIEF.json IR + MCP rendering.

## HARD CONSTRAINT

**NEVER write HTML/CSS/JS yourself.** Only generate BRIEF.json. Only `mcp__slide-renderer__render_slide` may produce HTML.

## Workflow (6 steps)

1. **Understand** — Parse user request: topic, audience, style, language.
2. **Load contract and compose** — Call `get_model_context(preset)` for the selected style. Build complete BRIEF.json in memory using its skeleton and evidence rules. Normally read `references/generation-contract.md`; technical content also uses `references/technical-language.md`. The renderer owns the full CSS/JS and runtime.
3. **Validate** — Call `mcp__slide-renderer__validate_brief(brief_json)`.
4. **Fix (max 1 round)** — If invalid, fix and re-validate ONCE. Still fails → report and stop.
5. **Render** — Call `mcp__slide-renderer__render_slide(brief_json, output_path)`.
6. **Done** — HTML file at output_path is the ONLY final artifact.

## BRIEF.json Schema

Call `mcp__slide-renderer__get_schema` for full schema. Key fields:

| Field | Notes |
|-------|-------|
| `schema_version` | Must be `1` |
| `brief_id` | Unique identifier |
| `mode` | `auto` (fast) or `polish` (deep) |
| `language` | ISO code: `zh`, `en` |
| `title` | Deck title |
| `audience` | Target audience |
| `desired_action` | What audience should do after |
| `deck.page_count` | 5–20 |
| `deck.output_format` | `html-slides` |
| `style.preset` | Preset name (see below) |
| `style.visual_density` | `low` / `medium` / `high` |
| `narrative.thesis` | Core argument |
| `narrative.slides[]` | Each: role, title, key_point, visual |
| `narrative.slides[].title_emphasis` | Optional: exact phrase within that title to visually emphasize (semantic title emphasis). If omitted, renderer may infer a fallback for emphasis-capable presets |
| `runtime.presenter_mode` | Default `true` |
| `runtime.editing_mode` | Default `true` |

## Available Presets

Call `mcp__slide-renderer__list_presets` for current list. Production presets:

- **Swiss Modern** — Corporate, data, reports
- **Enterprise Dark** — B2B, investor, strategy
- **Data Story** — KPI, analytics, review
- **Blue Sky** — SaaS, AI/tech, launches

Content type routing:

| Content Type | Presets |
|---|---|
| Data report | Data Story, Enterprise Dark, Swiss Modern |
| Pitch / VC | Enterprise Dark, Blue Sky, Swiss Modern |
| Product / SaaS | Blue Sky, Enterprise Dark, Data Story |
| Dev tools / API | Data Story, Blue Sky, Enterprise Dark |
| Research | Swiss Modern, Data Story, Chinese Chan |
| Philosophy | Chinese Chan, Swiss Modern |
| Strategy | Enterprise Dark, Swiss Modern, Data Story |

All 22 presets valid when explicitly requested. Honor user choice.

## MCP Tool Reference

| Tool | Params | Returns |
|------|--------|---------|
| `validate_brief` | `brief_json: str` | `{valid, errors, warnings}` |
| `render_slide` | `brief_json: str`, `output_path: str`, `requested_preset?: str` | `{success, html, preset, quality_tier, errors, stats}` |
| `list_presets` | — | `{presets[], total}` |
| `get_model_context` | `preset: str` | Compact style contract, BRIEF skeleton and evidence rules |
| `get_schema` | — | JSON Schema string |

All tools prefixed with `mcp__slide-renderer__`.

## Critical Rules

1. **Never generate HTML** — only BRIEF.json, then delegate to render_slide.
2. **Always validate before render** — never skip.
3. **Page count: 5–20** — no fewer, no more.
4. **Assertion-style titles** — no "Overview", "Introduction", "Summary". Multi-line titles must be balanced: no orphan lines, no collapsed middle lines, no forced wraps from overly narrow measure.
5. **Narrative arc** — each slide distinct role; no consecutive same-layout.
6. **Output path** — user's working directory, e.g. `./<slug>.html`.
7. **No intermediate files** — don't write BRIEF.json unless user asks.

## Command Routing

| User Intent | Action |
|---|---|
| Create slides / make a deck | Full: compose → validate → render |
| Plan only / structure first | Compose → validate → show plan (skip render) |
| Specific style mentioned | Use that preset in `style.preset` |
| Fast / quick draft | `mode: "auto"` |
| Deep / polished | `mode: "polish"` |
| Re-render with changes | Edit BRIEF in memory → validate → render |

## Formal upstream alignment

Source: slide-creator 2.32.0 at `31a6ef1426b0d9764a37432370f20a8526ec7226`.
When the user explicitly selects a style, preserve that choice independently of the model-authored BRIEF and pass the original choice as `requested_preset`. A mismatch rejects rendering before touching the existing output; correct BRIEF, never change the user choice to pass validation. This is the MCP equivalent of upstream's request-file guard and keeps IR in memory.
Keep observations, measurements, targets and hypotheses distinct. Preserve entities, units, conditions and source language; use local supporting facts on each page without repeating global evidence. For a restyle, extract the existing content into a valid BRIEF and render again through MCP.

## Animated covers (formal upstream 2.32.0)

When users ask for animated covers or a moving first slide, load `references/animated-covers.md`. Shipped choices: 极光封面 (`custom:shader-hero`), 奇幻彩虹 (`custom:fantasy-rainbow`), 熔金流体 (`custom:molten-flow`), 星核跃迁 (`custom:stellar-vortex`). Default an unspecified animated opening to 极光封面. No GPU or animation page-range question is needed. These are complete themes; content and closing pages remain static. Call `get_model_context` for the selected theme and render valid BRIEF through MCP. Local HTML playback is offline; reduced motion/unavailable graphics has a static fallback. Static export intent strips the GPU canvas/runtime. Preserve user content as editable DOM.
