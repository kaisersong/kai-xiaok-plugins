# Report Cover

Load this file only when the report renders a cover: `theme: forest-editorial`
(always) or `cover: hero` in frontmatter (any other theme).

## When a cover renders

- `forest-editorial` always renders one. There is no way to turn it off.
- Any other theme renders one only when frontmatter says `cover: hero`.
- A cover plus `animations: scrollytelling|iridescence` is `contract_conflict`:
  refuse and tell the user, do not pick one.
- Stamp `data-cover="hero"` on `<html>`, next to `data-theme`.

## What moves onto the cover

The in-wrapper title block is **not** rendered when a cover renders. The
headline, the `abstract`, the author/date line and the summary-card button all
live on the cover instead:

- `<h1>` — the document's only one
- `abstract` → `.cover-lead`
- author / date → `.cover-meta`
- `#card-mode-btn` — the document's only one

Rendering both would print the same headline twice.

## Accent phrase

`title` may wrap one phrase in `[[…]]`:

```yaml
title: 先建立[[业务语义中枢]]，再让 AI 接管全球履约
```

Render it as `<span class="cover-highlight">业务语义中枢</span>` and strip the
brackets. Consume the markers everywhere the title appears — `<h1>`, `<title>`,
`report-summary`, JSON-LD `name` — never print `[[` or `]]`.

`[[…]]` is parsed in `title` only. Not in `abstract`, not in card copy.

## `:::cover` fence

At most once, before every `##` heading. All fields optional — a report with no
fence still gets a cover carrying title, lead and meta.

```markdown
:::cover
eyebrow: LINGEE AIP · SEMANTIC OPERATING LAYER
watermark: ONTOLOGY → CONTEXT → ACTION
chips:
  - 基于会议纪要：2026.08.03
  - 参考架构：Semantic Layer API / MCP
chips_more: no more than four
cards:
  - label: CORE DECISION / 核心判断
    title: 本体是起点，语义中枢才是产品
    text: Ontology 负责定义业务世界；语义中枢再叠加上下文与规则，才足以承载 AIP。
    accent: true
  - label: BUSINESS TARGET / 业务目标
    title: 从小时级响应，推进到分钟级响应
    text: 打通飞书、ERP 与客户系统，人工只处理特例。
  - label: OPERATING MODEL / 交付节奏
    title: 一周一循环，双轨并行
    text: 清晰模块整包推进；模糊场景快速验证。
:::
```

Normalisation is the renderer's job, not the author's:

| Field | Rule |
|---|---|
| `eyebrow` | one line, ≤ 60 characters |
| `chips` | keep the first 4, drop the rest |
| `cards` | render 3 or none; with 1, 2 or 4+ supplied, drop the card strip entirely and say so |
| `cards[].accent` | keep the first `true`, render later ones plain |
| `watermark` | one line, always `aria-hidden="true"` |

## Markup

```html
<div class="main-with-toc">
  <section class="report-cover" id="report-cover">
    <p class="cover-eyebrow">[eyebrow]</p>
    <div class="cover-title-row">
      <h1>[title, with [[…]] rendered as span.cover-highlight]</h1>
      <button class="card-mode-btn" id="card-mode-btn" title="[Summary card|摘要卡片]">[⊞ Summary|⊞ 摘要卡]</button>
    </div>
    <p class="cover-lead">[abstract]</p>
    <p class="cover-meta">[author] · [date]</p>
    <div class="cover-chips">
      <span class="cover-chip">[chip]</span>
    </div>
    <div class="cover-cards">
      <div class="cover-card" data-accent="true">
        <p class="cover-card-label">[label]</p>
        <p class="cover-card-title">[title]</p>
        <p class="cover-card-text">[text]</p>
      </div>
    </div>
    <div class="cover-watermark" aria-hidden="true">[watermark]</div>
  </section>
  <div class="report-wrapper">
    <!-- no title block here; sections start immediately -->
  </div>
</div>
```

The cover is a **sibling before** `.report-wrapper`, never inside it.
`.main-with-toc` has no `max-width`, so `width: 100%` is full-bleed with no
`100vw` arithmetic and therefore no horizontal-scrollbar jitter. Nesting it
inside the wrapper silently caps it at 960px.

The headline row is `.cover-title-row`, not the shared `.title-row`, so neither
the shared title rules nor `forest-editorial`'s
`.report-wrapper > .title-row:first-of-type` anchor rules reach inside it.

## CSS

```css
        .main-with-toc { display: flex; flex-direction: column; }
        .report-cover {
          position: relative;
          width: 100%;
          min-height: 100svh;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          padding: clamp(2rem, 6vw, 5rem) clamp(1.25rem, 6vw, 6.5rem) 0;
          background: var(--cover-bg, #14181b);
          color: var(--cover-ink, #f4f6f5);
        }
        .cover-eyebrow {
          margin: 0 0 clamp(1rem, 3vw, 2.2rem);
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: .74rem;
          font-weight: 700;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: var(--cover-accent, var(--accent, #d97706));
        }
        .cover-title-row { display: flex; align-items: flex-start; gap: 1.5rem; }
        .cover-title-row h1 {
          flex: 1;
          margin: 0;
          font-size: clamp(2.4rem, 6.4vw, 5.2rem);
          font-weight: 900;
          line-height: 1.02;
          letter-spacing: -.03em;
          color: var(--cover-ink, #f4f6f5);
          background: none;
          box-shadow: none;
          padding: 0;
        }
        .cover-title-row h1::before { content: none; }
        .cover-highlight { color: var(--cover-highlight, var(--accent, #d97706)); }
        .cover-title-row .card-mode-btn {
          flex-shrink: 0;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.3);
          color: var(--cover-ink, #f4f6f5);
        }
        .cover-title-row .card-mode-btn:hover {
          background: rgba(255,255,255,.22);
          border-color: rgba(255,255,255,.45);
        }
        .cover-lead {
          max-width: 44rem;
          margin: clamp(1rem, 2.5vw, 1.8rem) 0 0;
          font-size: clamp(.95rem, 1.2vw, 1.12rem);
          line-height: 1.75;
          color: var(--cover-ink, #f4f6f5);
        }
        .cover-meta {
          margin: .9rem 0 0;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: .78rem;
          letter-spacing: .04em;
          color: var(--cover-ink, #f4f6f5);
          opacity: .72;
        }
        .cover-chips { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: clamp(1.2rem, 3vw, 2rem); }
        .cover-chip {
          padding: .45rem .95rem;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 999px;
          font-size: .8rem;
          color: var(--cover-ink, #f4f6f5);
        }
        .cover-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          margin-top: auto;
          margin-bottom: 0;
          background: rgba(255,255,255,.18);
          position: relative;
          z-index: 1;
        }
        .cover-card { padding: 1.35rem 1.5rem 1.6rem; background: var(--cover-bg, #14181b); }
        .cover-card[data-accent] { background: var(--cover-accent, var(--accent, #d97706)); }
        .cover-card-label {
          margin: 0 0 .7rem;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: .66rem;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          opacity: .78;
        }
        .cover-card-title { margin: 0 0 .5rem; font-size: 1.02rem; font-weight: 800; line-height: 1.35; }
        .cover-card-text { margin: 0; font-size: .84rem; line-height: 1.6; opacity: .88; }
        .cover-watermark {
          position: absolute;
          left: 0; right: 0; bottom: -.18em;
          font-size: clamp(4rem, 13vw, 11rem);
          font-weight: 900;
          letter-spacing: -.04em;
          white-space: nowrap;
          text-align: center;
          color: var(--cover-ink, #f4f6f5);
          opacity: .06;
          pointer-events: none;
          user-select: none;
        }

        @media (max-width: 768px) {
          .report-cover { min-height: auto; padding-bottom: 2rem; }
          .cover-title-row { flex-direction: column; gap: .9rem; }
          .cover-cards { grid-template-columns: 1fr; margin-top: 2rem; }
          .cover-watermark { display: none; }
        }

        @media print {
          .report-cover { min-height: auto; break-after: page; }
          .cover-watermark { display: none !important; }
        }
```

## Gate

`scripts/html_quality_gate.py` verifies, whenever `<html data-cover="hero">`:
`#report-cover` precedes `.report-wrapper` and is not nested inside it; exactly
one `<h1>`, inside the cover; exactly one `#card-mode-btn`, inside the cover;
`.cover-card` count 0 or 3; at most one
`[data-accent]`; at most 4 `.cover-chip`; `.cover-watermark` carries
`aria-hidden="true"`; no `[[` or `]]` in the cover or `<title>`. A
`forest-editorial` page without `data-cover="hero"` is itself a finding.
