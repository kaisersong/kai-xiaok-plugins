---
name: kai-report-creator
description: Use when the user wants to CREATE or GENERATE a report, business summary, data dashboard, or research doc. Handles Chinese and English. The model generates IR (.report.md) and delegates rendering to the MCP report-renderer server.
version: 2.2.0
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
cover: hero
abstract: One-line summary for machine reading
author: Author Name
poster_title: Short Poster Title
poster_subtitle: One-line subtitle for summary card
poster_note: Brief note for summary card left panel
---

:::cover
eyebrow: 2026 Q2 BUSINESS REVIEW
chips:
  - 增长
  - 提效
  - 风控
  - 组织
cards:
  - label: GROWTH
    title: 营收增长 18%
    text: 核心业务线连续三个季度加速
    accent: true
  - label: EFFICIENCY
    title: 人效提升 12%
    text: 流程自动化覆盖率过半
  - label: RISK
    title: 风险敞口收窄
    text: 逾期率降至 1.4%
watermark: REVIEW
:::

## Section Heading

:::component_type param=value
body content
:::

Prose text between blocks.
```

## Cover (`cover: hero`)

全屏封面：headline/meta/摘要卡按钮移到 100vh 封面上，`<html>` 标记 `data-cover="hero"`，`#report-cover` 是 `.report-wrapper` 的前置兄弟节点，全文唯一 `<h1>` 在封面内。

- `title` 中可用 `[[…]]` 标记一个强调短语，渲染为高亮 `span`（如 `title: 季度经营[[复盘]]报告`）。标记只允许出现在 `title`，绝不能泄漏到最终 HTML。
- `:::cover` fence 至多一个，位于所有 `##` 之前。字段：`eyebrow`（一行 ≤60 字符）、`chips`（≤4 个，超出自动丢弃）、`cards`（必须 3 张或没有；`accent: true` 至多第一张生效，否则整条卡片带丢弃）、`watermark`（底部大字水印）。
- `theme: forest-editorial` 隐含封面，无关闭开关。
- `cover: hero` 与 `animations: scrollytelling|iridescence` 组合是 `contract_conflict`，渲染器会拒绝并回退为纯 animated 页。

## Animated Render Mode

frontmatter 写 `animations: scrollytelling`（暗色 GSAP 滚动叙事）或 `animations: iridescence`（浅色 WebGL 虹彩、零 CDN）时，进入**动效网页渲染模式**——不再是标准报告 shell。用户说「动效网页 / 滚动叙事 / scrollytelling / 动画长页 / 虹彩」也路由到这里。**此模式下仍然禁止手写 HTML**——只需在 IR frontmatter 设置 `animations` 值，MCP 渲染器会生成整个动效单文件页面。

与标准 shell 的差异（渲染器自动处理）：

- 无 TOC 侧栏、摘要卡按钮、编辑模式、导出菜单；标准 shell L2 ID 检查不适用。
- 图表由渲染器手工构建（SVG + GSAP / CSS 条形），不用 ECharts。支持 `bar`/`line`/`pie`；其他 chart 类型以数据表格诚实呈现，绝不虚构视觉。
- scrollytelling 恰好加载 3 个带 SRI 的固定 CDN（GSAP + ScrollTrigger + CountUp）；iridescence 零外部请求。
- 输出契约（渲染器内置断言）：`<html data-render-mode="animated" data-animation="<mode>" data-theme="<mode>">`（data-theme 必须等于 data-animation）、chrome ID `play-btn` / `nav-sections`、`report-summary` KPI 契约、键盘翻页 + 演示模式。
- `theme:` 字段被忽略；品牌色用 `theme_overrides.primary_color`（默认极光紫 `#5842EA`）。
- `cover:` 与 animated 模式互斥（contract_conflict）。

浏览器 QA 仍需人工走一遍：滚动一遍确认每张图只触发一次、KPI 不卡 0、`→/↓/PageDown/Space` 翻节、F5 进出演示模式。

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
- `forest-editorial` — 米绿纸感编辑风：浅色纸底 + 深林绿锚区 + 金橙点缀，大圆角卡片。适合复盘/总结/提案类报告。图表配色：`#0b6b55 #c7951d #de6d40 #4e6a9f #93a098`（ECharts 不读 CSS 变量，需在 chart IR 中显式指定）

## MCP Tool Reference

The following tools are available as `mcp__report-renderer__<tool_name>`:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `validate_ir` | `ir_content: string` | Validate IR content, returns errors/warnings |
| `render_report` | `ir_content: string`, `output_path: string`, `theme?: string` | Render IR to HTML file |
| `list_themes` | — | List all available themes |
| `preview_section` | `ir_content: string`, `section_index: number` | Preview a single section as HTML fragment |

## Renderer Output Metadata

渲染后的 HTML 会在 `<head>` 中自动注入 `<script type="application/ld+json">` 结构化元数据（schema.org），字段从 frontmatter 派生：

| JSON-LD 字段 | 来源 frontmatter 字段 | 影响 |
|---|---|---|
| `name` | `title` | 搜索标题、RAG 索引名 |
| `description` | `abstract` | 摘要检索、LLM 上下文 |
| `creator` | `author`（有则 Person，无则 Organization fallback） | 作者归属 |
| `dateCreated` | `date` | 时间排序 |
| `inLanguage` | `lang`（zh→zh-CN，en→en-US） | 语言标签 |
| `audience` | `audience` | 受众标签 |
| `about` | `decision_goal` | 决策目标 |
| `genre` | `report_class` | 类型分类 |
| `additionalType` | `archetype` | 子类型（research/brief/comparison/update） |

**因此 frontmatter 中的 `title`、`abstract`、`author`、`audience`、`decision_goal` 填写质量直接影响产物的可检索性和语义标注质量。** 生成 IR 时应尽量从用户输入中提取这些字段，即使 IR 渲染本身不依赖它们。

不需要在 IR 中手写任何 JSON-LD——renderer 自动从 frontmatter 派生。

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
| "带封面的报告" / 封面 / hero cover | frontmatter 加 `cover: hero` + `:::cover` fence → render |
| "动效网页" / "滚动叙事" / scrollytelling / 动画长页 | frontmatter `animations: scrollytelling` → render |
| "虹彩" / iridescence / WebGL 动效 | frontmatter `animations: iridescence` → render |
