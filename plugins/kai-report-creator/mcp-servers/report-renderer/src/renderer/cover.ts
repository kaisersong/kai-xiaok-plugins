import yaml from 'js-yaml';
import { escHtml, escHtmlText } from './escape.js';

/** Raw :::cover fence payload (all fields optional, pre-normalisation). */
export interface CoverSpec {
  eyebrow?: string;
  watermark?: string;
  chips?: string[];
  cards?: Array<{ label?: string; title?: string; text?: string; accent?: boolean }>;
}

export interface NormalisedCover {
  eyebrow: string | null;
  watermark: string | null;
  chips: string[];
  cards: Array<{ label: string; title: string; text: string; accent: boolean }>;
}

export function isAnimatedMode(animations: boolean | string | undefined): animations is string {
  return typeof animations === 'string'
    && (animations === 'scrollytelling' || animations === 'iridescence');
}

export function shouldRenderCover(
  coverFlag: string | undefined,
  effectiveTheme: string,
): boolean {
  return coverFlag === 'hero' || effectiveTheme === 'forest-editorial';
}

/**
 * Split a `[[accent]]` phrase out of a title.
 * `[[…]]` is parsed in `title` only. The plain form is used everywhere the
 * title appears as text (<title>, report-summary, JSON-LD); the html form
 * renders the phrase as <span class="cover-highlight">.
 */
export function splitAccentPhrase(title: string): { plain: string; html: string } {
  const plain = title.replace(/\[\[([^\[\]]+)\]\]/g, '$1');
  if (plain === title) return { plain: title, html: escHtmlText(title) };
  const html = escHtmlText(title).replace(/\[\[([^\[\]]+)\]\]/g, '<span class="cover-highlight">$1</span>');
  return { plain, html };
}

export function parseCoverBody(body: string): CoverSpec | null {
  const trimmed = body.trim();
  if (!trimmed) return {};
  try {
    const parsed = yaml.load(trimmed) as Record<string, unknown> | null;
    return (parsed ?? {}) as CoverSpec;
  } catch {
    return {};
  }
}

/**
 * Normalisation is the renderer's job, not the author's:
 * - eyebrow: one line, ≤ 60 characters
 * - chips: keep the first 4, drop the rest
 * - cards: render 3 or none (1/2/4+ → drop the strip entirely)
 * - accent: keep the first `true`, render later ones plain
 * - watermark: one line
 */
export function normaliseCover(spec: CoverSpec | null, warnings: string[]): NormalisedCover {
  const cover: NormalisedCover = { eyebrow: null, watermark: null, chips: [], cards: [] };
  if (!spec) return cover;

  if (spec.eyebrow) {
    let eyebrow = String(spec.eyebrow).split('\n')[0]!.trim();
    if (eyebrow.length > 60) {
      warnings.push(`cover eyebrow trimmed to 60 characters`);
      eyebrow = eyebrow.slice(0, 60);
    }
    if (eyebrow) cover.eyebrow = eyebrow;
  }

  if (Array.isArray(spec.chips)) {
    cover.chips = spec.chips.map(c => String(c).trim()).filter(Boolean).slice(0, 4);
  }

  if (spec.watermark) {
    cover.watermark = String(spec.watermark).split('\n')[0]!.trim() || null;
  }

  if (Array.isArray(spec.cards)) {
    const cards = spec.cards
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map(c => ({
        label: String(c['label'] ?? '').trim(),
        title: String(c['title'] ?? '').trim(),
        text: String(c['text'] ?? '').trim(),
        accent: c['accent'] === true,
      }));
    if (cards.length !== 0 && cards.length !== 3) {
      warnings.push(`cover cards must be 3 or none (got ${cards.length}); card strip dropped`);
    } else if (cards.length === 3) {
      let accentSeen = false;
      cover.cards = cards.map(c => {
        const accent = c.accent && !accentSeen;
        if (c.accent && accentSeen) warnings.push('cover card accent kept only on the first card');
        if (accent) accentSeen = true;
        return { ...c, accent };
      });
    }
  }

  return cover;
}

export interface CoverRenderInput {
  cover: NormalisedCover;
  titleHtml: string;
  abstract: string;
  author: string;
  date: string;
  lang: string;
}

export function renderCoverSection(input: CoverRenderInput): string {
  const zh = input.lang === 'zh';
  const cardBtnText = zh ? '⊞ 摘要卡' : '⊞ Summary';
  const cardBtnTitle = zh ? '摘要卡片' : 'Summary Card';

  const parts: string[] = [];
  parts.push('      <section class="report-cover" id="report-cover">');
  if (input.cover.eyebrow) {
    parts.push(`        <p class="cover-eyebrow">${escHtmlText(input.cover.eyebrow)}</p>`);
  }
  parts.push('        <div class="cover-title-row">');
  parts.push(`          <h1>${input.titleHtml}</h1>`);
  parts.push(`          <button class="card-mode-btn" id="card-mode-btn" title="${escHtml(cardBtnTitle)}">${escHtml(cardBtnText)}</button>`);
  parts.push('        </div>');
  if (input.abstract) {
    parts.push(`        <p class="cover-lead">${escHtmlText(input.abstract)}</p>`);
  }
  const metaBits = [input.author, input.date].filter(Boolean).map(escHtml).join(' · ');
  if (metaBits) {
    parts.push(`        <p class="cover-meta">${metaBits}</p>`);
  }
  if (input.cover.chips.length > 0) {
    parts.push('        <div class="cover-chips">');
    for (const chip of input.cover.chips) {
      parts.push(`          <span class="cover-chip">${escHtmlText(chip)}</span>`);
    }
    parts.push('        </div>');
  }
  if (input.cover.cards.length === 3) {
    parts.push('        <div class="cover-cards">');
    for (const card of input.cover.cards) {
      const accentAttr = card.accent ? ' data-accent="true"' : '';
      parts.push(`          <div class="cover-card"${accentAttr}>`);
      parts.push(`            <p class="cover-card-label">${escHtmlText(card.label)}</p>`);
      parts.push(`            <p class="cover-card-title">${escHtmlText(card.title)}</p>`);
      parts.push(`            <p class="cover-card-text">${escHtmlText(card.text)}</p>`);
      parts.push('          </div>');
    }
    parts.push('        </div>');
  }
  if (input.cover.watermark) {
    parts.push(`        <div class="cover-watermark" aria-hidden="true">${escHtmlText(input.cover.watermark)}</div>`);
  }
  parts.push('      </section>');
  return parts.join('\n');
}

/**
 * Cover CSS lives in the shell (not theme files) so every theme gets it via
 * the --cover-* custom-property palette; themes may override the palette.
 * Ported from report-creator references/html-shell/cover.md (v1.28.0).
 */
export const COVER_CSS = `
/* === Report Cover (hero) === */
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
`;
