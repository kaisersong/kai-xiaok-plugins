---
name: kai-report-creator
description: Use when the user wants to CREATE or GENERATE a report, business summary, data dashboard, or research doc. Handles Chinese and English. The model generates IR (.report.md) and delegates rendering to the MCP report-renderer server.
version: 2.0.0
user-invocable: true
metadata: {"openclaw": {"emoji": "📊"}}
---

# kai-report-creator

Compose `.report.md` IR (Intermediate Representation) content that describes report structure, then render to HTML via the MCP report-renderer tools. The IR is passed directly as a string — never saved to disk. This plugin mirrors the standalone `kai-report-creator` quality contract while keeping rendering inside the MCP server.

## ⛔ HARD CONSTRAINT — DO NOT VIOLATE

**NEVER write HTML, CSS, or JavaScript content yourself.** You are FORBIDDEN from:
- Using the `Write` tool to create `.html` files
- Using the `Write` tool to create `.md` or `.report.md` files (IR stays in memory)
- Generating `<html>`, `<style>`, `<script>`, or any HTML markup in file content
- Inlining CSS styles, Google Fonts, or CDN links in any file you write
- Using ` ```mermaid ` code blocks (renderer does not support mermaid)

**ONLY** the MCP tool `mcp__report-renderer__render_report` may produce HTML. If you write HTML directly, the output will be broken, unthemed, and rejected.

Your job: Compose IR in memory → Call `mcp__report-renderer__render_report` with `ir_content` string → Done. Only one file should exist at the end: the `.html` output.

## Workflow

1. **User request** → Understand intent, gather data
2. **Compose IR** → Compose the `.report.md` IR content in memory (DO NOT use `Write` tool to save it to disk)
3. **Validate** → Call `mcp__report-renderer__validate_ir` with the IR content string to check correctness
4. **Fix (max 1 round)** → If validation fails, fix errors and re-validate ONCE. Do not loop more than once.
5. **Render** → Call `mcp__report-renderer__render_report` with `ir_content` (the IR text string) and `output_path` (HTML output path)
6. **Done** → The HTML file is the ONLY final artifact delivered to the user

**CRITICAL**: Step 5 (render) is MANDATORY. Never stop after validation. If validation still fails after one fix attempt, render anyway — the renderer handles minor issues gracefully.

The renderer runs output gates after rendering: no raw `:::` leakage, shell metadata, required TOC/summary/export/edit IDs, and real numeric KPI values in both visible cards and `report-summary`.

**NO INTERMEDIATE FILES**: Do NOT use the `Write` tool to save `.report.md` or any other intermediate file. The `ir_content` parameter of `render_report` accepts the IR string directly. The user should only see the final `.html` file in their Downloads/working directory.

**Budget warning**: You have limited iterations. Do NOT spend multiple rounds reading/editing files. Compose IR correctly the first time, validate once, fix once if needed, then IMMEDIATELY render.

## IR Format Spec

```markdown
---
title: Report Title
theme: corporate-blue
date: 2026-05-09
lang: zh
report_class: mixed|kpi-dashboard|narrative|comparison
audience: Target Audience
toc: true
animations: true
abstract: One-line summary for machine reading
author: Author Name
poster_title: Short Poster Title
poster_subtitle: One-line subtitle for summary card
poster_note: Brief note for summary card left panel
---

## Section Heading

:::component_type param=value
body content
:::

Prose text between blocks.
```

## Available Components (9 types)

| Component | Params | Body |
|-----------|--------|------|
| `kpi` | — | YAML items: `- label/value/trend` |
| `chart` | `type=bar\|line\|pie\|radar\|scatter\|funnel\|sankey` | `labels`, `datasets` |
| `timeline` | — | `- Date: Description` per line |
| `table` | — | Markdown table |
| `callout` | `type=note\|tip\|warning\|danger` | Text content |
| `diagram` | `type=sequence\|flowchart\|tree\|mindmap` | Structured YAML |
| `code` | `lang=python\|js\|...` `title=optional` | Code content |
| `image` | `src=url` `alt=text` `caption=text` | — |
| `list` | `style=ordered\|unordered` | `- item` per line |

## Available Themes

- `corporate-blue` — Professional business theme (default)
- `minimal` — Clean white, minimal accents
- `dark-tech` — Dark mode, tech-focused
- `dark-board` — Dark mode, dashboard style
- `data-story` — Colorful data storytelling
- `newspaper` — Print-inspired serif layout
- `regular-lumen` — Warm editorial consulting layout
- `fangsong` — Chinese fangsong editorial layout

## MCP Tool Reference

The following tools are available as `mcp__report-renderer__<tool_name>`:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `validate_ir` | `ir_content: string` | Validate IR content, returns errors/warnings |
| `render_report` | `ir_content: string`, `output_path: string`, `theme?: string` | Render IR to HTML file |
| `list_themes` | — | List all available themes |
| `preview_section` | `ir_content: string`, `section_index: number` | Preview a single section as HTML fragment |

## Critical Rules

1. **Never generate HTML yourself** — Only generate IR. The renderer handles HTML deterministically.
2. **Always render after generating IR** — The HTML file is the deliverable, not the IR.
3. **Never fabricate data** — Use `[INSERT VALUE]` placeholders if data is missing, but never inside KPI `value`; downgrade that KPI to `callout`, `list`, or `table` until a real number is available.
4. **One component per block** — Each `:::` block contains exactly one component.
5. **Timeline = chronological only** — Items must have temporal ordering. Use `list` for non-sequential items.
6. **Diagram = directional only** — Use only when showing flow/dependency/branching. Use `callout` for parallel points.
7. **Output path** — Save HTML to the user's working directory (e.g., `./report-<topic>.html`), not in the plugin directory.
8. **No raw mermaid** — NEVER use ` ```mermaid ` code blocks. The renderer does NOT support mermaid syntax. Use `:::diagram type=mindmap|flowchart|sequence|tree` with structured YAML body instead. If unsure, use `:::list` or `:::callout` as a simpler alternative.
9. **No intermediate files** — Do NOT write `.report.md` or any other file to disk. Pass IR content directly as a string to `validate_ir` and `render_report`.
10. **HTML only in IR** — HTML tags (`<span class="badge">`, `<p class="highlight-sentence">`, `<div class="lead-block">`, etc.) must ONLY appear inside the IR content string passed to `render_report`. In your chat reply to the user, use plain text or standard Markdown only. Never output raw HTML tags in conversational messages.

## Content Quality Rules

1. **BLUF** — Every `## Section` opens with one conclusion sentence, not background. ❌ "本周工作内容包括…" ✅ "本周完成核心模块开发，PR 合并率 89%。"
2. **Specific headings** — No generic labels (概述/总结/下一步). Headings must carry data or insight.
3. **Takeaway after data** — Every `:::kpi`, `:::chart`, `:::table` must be followed by a prose sentence interpreting what the numbers mean.
4. **Prose cadence blocks** — Use HTML elements in prose to create visual rhythm:
   - `<p class="highlight-sentence">Key insight here</p>` — bold primary-color statement with left border
   - `<div class="lead-block">Opening paragraph</div>` — indented block with left accent border
   - `<div class="section-quote">Notable quote or insight</div>` — rounded card with gradient background
   - `<div class="action-grid"><div class="action-card"><strong>Title</strong><p>Description</p></div>...</div>` — 2-column action card grid
5. **Badge usage** — Use `<span class="badge badge--green">Label</span>` for status/category tags. Available variants: `badge--blue`, `badge--green`, `badge--purple`, `badge--orange`, `badge--red`, `badge--gray`, `badge--teal`, `badge--done`, `badge--wip`, `badge--todo`, `badge--ok`, `badge--warn`, `badge--err`.
6. **KPI value quality** — KPI `value` must contain a real number and be short (≤8 chars preferred), never a status word or sentence. ❌ `value: 完成` ❌ `value: 完成了12个任务` ✅ `value: 12`
7. **Text wall guard** — If a section has >3 consecutive plain prose paragraphs with no component or visual anchor, insert a cadence block (highlight-sentence, lead-block, or callout) to break monotony.
8. **Scan-anchor per section** — Every `## Section` must contain at least one visual scan anchor: a `:::kpi`, `:::chart`, `:::table`, badge, or cadence block. Pure text sections are not allowed.
9. **Summary Card** — Set `poster_title` (short, impactful, ≤6 chars ideal), `poster_subtitle`, and `poster_note` in frontmatter. These populate the summary card poster view accessed via the "⊞ 摘要卡" button.

## Command Routing

| User intent | Action |
|-------------|--------|
| "生成报告" / "create report" | compose IR → `mcp__report-renderer__render_report` → output HTML |
| "报告规划" / "plan report" | compose IR → `mcp__report-renderer__validate_ir` (no render) |
| "换主题" / "change theme" | `mcp__report-renderer__render_report` with `theme` param |
| "检查报告" / "validate" | `mcp__report-renderer__validate_ir` |
