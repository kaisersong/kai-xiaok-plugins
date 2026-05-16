---
name: slide-planner
description: Use when user wants to create HTML slide decks, presentations, pitch decks, or reports. Triggers on slide/presentation/deck/ppt/pitch/路演/幻灯片/演示.
version: 3.2.0
user-invocable: true
metadata: {"emoji":"🎞","os":["darwin","linux","windows"]}
---

# slide-planner

Generate zero-dependency HTML slide decks via BRIEF.json IR + MCP rendering.

## HARD CONSTRAINT

**NEVER write HTML/CSS/JS yourself.** Only generate BRIEF.json. Only `mcp__slide-renderer__render_slide` may produce HTML.

## Workflow (6 steps)

1. **Understand** — Parse user request: topic, audience, style, language.
2. **Compose BRIEF.json** — Build IR in memory. DO NOT Write to disk unless user asks.
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
| Pitch / VC | Bold Signal, Aurora Mesh, Enterprise Dark |
| Product / SaaS | Blue Sky, Aurora Mesh, Glassmorphism |
| Dev tools / API | Terminal Green, Neo-Retro Dev Deck |
| Research | Modern Newspaper, Paper & Ink, Swiss Modern |
| Philosophy | Chinese Chan |
| Strategy | Strategy Consulting, Enterprise Dark, Swiss Modern |

All 22 presets valid when explicitly requested. Honor user choice.

## MCP Tool Reference

| Tool | Params | Returns |
|------|--------|---------|
| `validate_brief` | `brief_json: str` | `{valid, errors, warnings}` |
| `render_slide` | `brief_json: str`, `output_path: str` | `{success, html, preset, quality_tier, errors, stats}` |
| `list_presets` | — | `{presets[], total}` |
| `get_schema` | — | JSON Schema string |

All tools prefixed with `mcp__slide-renderer__`.

## Critical Rules

1. **Never generate HTML** — only BRIEF.json, then delegate to render_slide.
2. **Always validate before render** — never skip.
3. **Page count: 5–20** — no fewer, no more.
4. **Assertion-style titles** — no "Overview", "Introduction", "Summary".
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
