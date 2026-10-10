# Animated Shell (动效网页报告) — Overview

Route here when frontmatter has `animations: scrollytelling` or
`animations: iridescence`, or the user asks for a **动效网页 / 滚动叙事 /
scrollytelling / 动画长页 / 虹彩 / iridescence** page. This mode produces ONE
animated single-file HTML **web page** (scroll narrative), not the standard
report shell.

Mode recipes: [scrollytelling.md](scrollytelling.md) (dark, GSAP) ·
[iridescence.md](iridescence.md) (light, WebGL hero, zero CDN).

## What changes vs the standard shell

- `references/html-shell/*.md` do **NOT** apply: no TOC sidebar, card mode,
  edit mode, or export menu. **Skip the L2 standard shell ID checks** in
  SKILL.md `--generate` step 11.
- Charts are **hand-built** (SVG + GSAP draw-ins, or CSS bar fills). The
  「ECharts for ALL charts」 rule does NOT apply in this mode.
- Theme CSS files (`templates/themes/*.css`) do not apply; the visual system
  is defined by the mode recipe. `theme_overrides.primary_color` may tint the
  brand ramp.

## Pipeline invariants (still REQUIRED)

1. `scripts/guard_validate.py` on the IR before render.
2. Never fabricate numbers. Undisclosed fields render as 「未公开」 with ghost
   bars (see mode recipes) — never estimate to fill a chart.
   **Every figure on the page must trace back to the IR or to the sources
   section.** A number that appears in neither is a contract violation even if
   it came from a real article — either add it to the IR and disclose the
   source, or drop it.
3. `<html lang>` + JSON-LD metadata per [output-metadata.md](../output-metadata.md).
4. `report-summary` JSON script (machine-readable KPIs), same contract as the
   standard shell.
5. Root `<html>` attributes (the gate reads `data-render-mode` off the
   document's **first** start tag, so these belong on `<html>` itself):
   `data-template="kai-report-creator"`, `data-version="<skill version>"`,
   `data-theme="<animation mode>"`, `data-render-mode="animated"`,
   `data-animation="scrollytelling|iridescence"`.
   `data-theme` **must equal** `data-animation` (the gate enforces this).
6. **Chrome element IDs are a contract**: the play button must be
   `id="play-btn"` and the section-navigation container `id="nav-sections"`.
   The gate checks these as real elements (HTMLParser, not substring), because
   whether the keys actually page can only be verified in a browser.
7. Every KPI shown on the page must also appear in the `report-summary` JSON
   with a real number — when the numbers live in JS, that JSON is the only
   auditable surface.
8. Post-render gate: `scripts/html_quality_gate.py <file>` — the animated
   profile is detected from `data-render-mode="animated"` on the root element
   and replaces the standard shell checks with animated assertions (chrome IDs,
   mode/theme agreement, font policy, pinned-script allow-list, shader
   fallback, summary KPI contract).

## IR mapping

| IR | Animated page |
|---|---|
| `title` / `poster_title` / `abstract` | Hero title + subtitle |
| `##` section | One full scroll section with mono kicker `0N / NAME` |
| `:::kpi` items | KPI cards (CountUp or big-number entrance) |
| `:::chart` | Hand-built animated chart (bars scaleY, line dash draw-in, rings) |
| `:::table` | Comparison table section |
| `:::callout` | Conclusion cel / risk card |
| `must_include` | Sources section content (every claim gets its source + date) |

Drop sections the data cannot support; never pad. 8–10 sections is the
default arc (see mode recipes).

## Frame chrome (both modes, always)

1. **Keyboard section paging**: `→/↓/PageDown/Space` next, `←/↑/PageUp` prev,
   `Home/End` first/last via `scrollIntoView({behavior:'smooth'})`. Maintain a
   dedicated `navSec` index: `goSec()` sets it **immediately**, and a
   per-section observer re-syncs it on real scroll — never step from the
   scroll-tracked index alone. Skip when focus is in an input/textarea.
2. **Play (present) mode**: round ▶ button + `F5` toggle `body.playing` +
   fullscreen; wheel (`passive:false`, ~700ms lock) and click (left quarter =
   back) page exactly ONE section per gesture; `Esc` / leaving fullscreen
   exits. Hide the scroll hint while playing. Do NOT set `overflow:hidden` on
   `body.playing` — it breaks `scrollIntoView` paging.

## Delivery & QA

Write to the requested path (default report filename rules apply).

**The gate cannot verify behaviour** — it only proves the chrome elements exist.
So the browser pass is mandatory, not optional. Walk this checklist once:

1. Scroll end-to-end: every chart fires exactly once, no console errors,
   KPIs are not stuck at 0.
2. `→ / ↓ / PageDown / Space` advance one section; `← / ↑ / PageUp` go back;
   `Home / End` jump to first/last.
3. `F5` (or the ▶ button) enters fullscreen play mode; wheel and click page one
   section per gesture; `Esc` exits and restores the ▶ icon.
4. iridescence only: the shader animates, pauses when the hero scrolls out of
   view, and the page issues no network requests besides the file itself.
5. Every figure on the page traces back to the IR or the sources section.

Then run `python scripts/html_quality_gate.py <file>` and fix findings until it
passes.
