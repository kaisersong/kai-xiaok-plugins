import type { IRDocument, IRBlock, IRSection } from '../../parser/ir-parser.js';
import { escHtml, escHtmlText } from '../escape.js';

/** The two deterministic animated render modes. */
export type AnimatedMode = 'scrollytelling' | 'iridescence';

export interface ChartSeriesData {
  labels: string[];
  datasets: Array<{ name: string; data: number[] }>;
}

/** Parse `labels: [..]` + `datasets:` out of a :::chart body (bar/line/pie). */
export function parseChartSeries(body: string): ChartSeriesData {
  const out: ChartSeriesData = { labels: [], datasets: [] };
  let current: { name: string; data: number[] } | null = null;
  for (const raw of body.trim().split('\n')) {
    const line = raw.trim();
    const labels = line.match(/^labels:\s*\[(.+)\]$/);
    if (labels) {
      out.labels = labels[1]!.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    if (/^datasets:/.test(line)) continue;
    const name = line.match(/^-?\s*name:\s*(.+)$/);
    if (name && !current) {
      current = { name: name[1]!.trim().replace(/^['"]|['"]$/g, ''), data: [] };
      continue;
    }
    if (current) {
      const data = line.match(/^(-?\s*)?data:\s*\[(.+)\]$/);
      if (data) {
        current.data = data[2]!.split(',').map(s => parseFloat(s.trim()));
        out.datasets.push(current);
        current = null;
      }
    }
  }
  return out;
}

/** KPI extraction shared with the standard shell (report-summary contract). */
export function extractKpis(doc: IRDocument): Array<{ label: string; value: string; trend: string }> {
  const kpis: Array<{ label: string; value: string; trend: string }> = [];
  for (const block of doc.blocks) {
    if (block.tag !== 'kpi') continue;
    const lines = block.body.split('\n');
    let current: { label?: string; value?: string; trend?: string } | null = null;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('- label:') || t.startsWith('-label:')) {
        if (current && current.label) kpis.push({ label: current.label, value: current.value ?? '', trend: current.trend ?? '' });
        const m = t.match(/label:\s*(.+)/);
        current = { label: m ? m[1]!.trim().replace(/^['"]|['"]$/g, '') : '' };
      } else if (current) {
        if (t.startsWith('value:')) { const m = t.match(/value:\s*(.+)/); if (m) current.value = m[1]!.trim().replace(/^['"]|['"]$/g, ''); }
        if (t.startsWith('trend:')) { const m = t.match(/trend:\s*(.+)/); if (m) current.trend = m[1]!.trim().replace(/^['"]|['"]$/g, ''); }
      }
    }
    if (current && current.label) kpis.push({ label: current.label, value: current.value ?? '', trend: current.trend ?? '' });
  }
  return kpis.slice(0, 6);
}

/** Mono label stack — CJK fallbacks last so Chinese labels never fall to a random serif. */
export const MONO_STACK = `'JetBrains Mono',Menlo,'Microsoft YaHei','PingFang SC',monospace`;
export const SANS_STACK = `'Microsoft YaHei','PingFang SC',sans-serif`;
export const SERIF_CJK_STACK = `'Microsoft YaHei','PingFang SC',serif`;

/**
 * Keyboard section paging + play mode, shared by both animated modes
 * (overview.md frame chrome #1/#2). Sections page via scrollIntoView; the
 * nav index is owned by `navSec` and re-synced by a per-section observer.
 */
export const CHROME_JS = `    <script>
    (function(){
      var secs=[].slice.call(document.querySelectorAll('section[data-sec]'));
      if(!secs.length) return;
      var navSec=0;

      function goSec(i){
        navSec=Math.max(0,Math.min(secs.length-1,i));
        secs[navSec].scrollIntoView({behavior:'smooth'});
      }
      function syncNav(i){
        navSec=i;
        var dots=document.querySelectorAll('#nav-sections a');
        for(var k=0;k<dots.length;k++) dots[k].classList.toggle('active',k===i);
      }

      document.addEventListener('keydown',function(e){
        var tag=(document.activeElement&&document.activeElement.tagName)||'';
        if(tag==='INPUT'||tag==='TEXTAREA') return;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); goSec(navSec+1); }
        if(e.key==='ArrowLeft'||e.key==='ArrowUp'||e.key==='PageUp'){ e.preventDefault(); goSec(navSec-1); }
        if(e.key==='Home'){ e.preventDefault(); goSec(0); }
        if(e.key==='End'){ e.preventDefault(); goSec(secs.length-1); }
        if(e.key==='F5'&&!e.metaKey&&!e.ctrlKey){ e.preventDefault(); togglePlay(); }
        if(e.key==='Escape'&&document.body.classList.contains('playing')) exitPlay();
      });

      var playBtn=document.getElementById('play-btn');
      var hint=document.querySelector('.scroll-hint');
      var wheelLock=0;
      function enterPlay(){
        document.body.classList.add('playing');
        if(playBtn) playBtn.textContent='||';
        if(hint) hint.classList.add('hidden');
        if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      }
      function exitPlay(){
        document.body.classList.remove('playing');
        if(playBtn) playBtn.textContent='▶';
        if(hint) hint.classList.remove('hidden');
        if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen();
      }
      function togglePlay(){ document.body.classList.contains('playing')?exitPlay():enterPlay(); }
      if(playBtn) playBtn.addEventListener('click',togglePlay);
      document.addEventListener('fullscreenchange',function(){ if(!document.fullscreenElement) exitPlay(); if(window.__onViewportChange) window.__onViewportChange(); });

      document.addEventListener('wheel',function(e){
        if(!document.body.classList.contains('playing')) return;
        e.preventDefault();
        var now=Date.now();
        if(now-wheelLock<700) return;
        wheelLock=now;
        goSec(navSec+(e.deltaY>0?1:-1));
      },{passive:false});

      document.addEventListener('click',function(e){
        if(!document.body.classList.contains('playing')) return;
        if(e.target.closest('#play-btn')||e.target.closest('#nav-sections')) return;
        goSec(e.clientX<window.innerWidth*.25?navSec-1:navSec+1);
      });

      window.__animatedNav={goSec:goSec,syncNav:syncNav,secs:secs};
    })();
    </script>`;

export interface AnimatedBuildCtx {
  doc: IRDocument;
  mode: AnimatedMode;
  lang: string;
  version: string;
  irHash: string;
  primaryColor: string;
  warnings: string[];
}

export interface SectionItem {
  kind: 'prose' | 'kpi' | 'chart' | 'table' | 'callout' | 'list' | 'timeline' | 'code' | 'image';
  text?: string;
  block?: IRBlock;
}

/** Split a section into ordered items (prose paragraphs interleaved with blocks). */
export function sectionItems(section: IRSection): SectionItem[] {
  const items: SectionItem[] = [];
  const queue = [...section.blocks];
  const lines = section.content.split('\n');
  let inBlock = false;
  let skip = false;
  let prose: string[] = [];
  const flush = () => {
    if (prose.length) {
      const t = prose.join(' ').trim();
      if (t) items.push({ kind: 'prose', text: t });
      prose = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (skip) { if (line === ':::') skip = false; continue; }
    if (/^#{1,6}\s/.test(line)) { flush(); continue; }
    const open = line.match(/^:::\s*(\w+)\b/);
    if (open) {
      flush();
      if (['cover', 'toc', 'section'].includes(open[1]!)) { skip = open[1] === 'toc'; continue; }
      inBlock = true;
      continue;
    }
    if (line === ':::') {
      inBlock = false;
      const block = queue.shift();
      if (block) items.push({ kind: block.tag as SectionItem['kind'], block });
      continue;
    }
    if (inBlock) continue;
    if (!line) { flush(); continue; }
    prose.push(line);
  }
  flush();
  return items;
}

/** Hero copy per IR mapping: poster_title > title; abstract as subtitle. */
export function heroCopy(doc: IRDocument): { title: string; sub: string } {
  return {
    title: doc.frontmatter.poster_title?.trim() || doc.frontmatter.title || 'Report',
    sub: doc.frontmatter.abstract ?? '',
  };
}

const PLACEHOLDER_RE = /\[(?:INSERT VALUE|数据待填写)\]/;

function hasRealNumber(value: string): boolean {
  return /\d/.test(value) && !PLACEHOLDER_RE.test(value);
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, '').trim();
}

/** summary KPI contract — every page KPI needs a real number in report-summary. */
export function validateSummaryKpis(html: string): string[] {
  const findings: string[] = [];
  const summaryMatch = html.match(/<script\b[^>]*id="report-summary"[^>]*>\s*([\s\S]*?)\s*<\/script>/);
  if (!summaryMatch) {
    findings.push('missing report-summary JSON');
    return findings;
  }
  try {
    const summary = JSON.parse(summaryMatch[1] ?? '{}') as { kpis?: Array<{ value?: unknown }> };
    if (Array.isArray(summary.kpis)) {
      for (const item of summary.kpis) {
        const value = String(item?.value ?? '').trim();
        if (value && !hasRealNumber(value)) findings.push(`invalid summary KPI value "${value}"`);
      }
      if (summary.kpis.length === 0) findings.push('report-summary has no KPIs — every page KPI must appear here');
    } else {
      findings.push('report-summary missing kpis array');
    }
  } catch {
    findings.push('invalid report-summary JSON');
  }
  return findings;
}

/** Pinned GSAP/CountUp CDNs with SRI — mirrored from scrollytelling.md. */
export const SCROLLYTELLING_SCRIPTS = [
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', integrity: 'sha512-7eHRwcbYkK4d9g/6tD/mhkf++eoTHwpNM9woBxtPUBWm67zeAfFC+HrdoE2GanKeocly/VxeLvIqwvCdk7qScg==' },
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js', integrity: 'sha512-onMTRKJBKz8M1TnqqDuGBlowlH0ohFzMXYRNebz+yOcc5TQr/zAKsthzhuv0hiyUKEiQEQXEynnXCvNTOk50dg==' },
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/countup.js/2.8.0/countUp.umd.min.js', integrity: 'sha512-kUIpdMjMlkYUVQgR3wVXJtmuwoD+G69Zt9JBa2rPH4C/+VPlAsQWKcqCv0SpJ8AnezBjfuM2JDjnc58Ee8Filw==' },
];

export function isAllowedScriptSrc(src: string): boolean {
  return SCROLLYTELLING_SCRIPTS.some(s => s.src === src);
}

/**
 * Animated-profile assertions (replaces standard shell L2), ported from
 * html_quality_gate.py: chrome IDs, mode/theme agreement, pinned-script
 * allow-list (scrollytelling) / zero-CDN (iridescence), shader fallback,
 * summary KPI contract.
 */
export function validateAnimatedOutput(html: string, mode: AnimatedMode, version: string): { chromeFindings: string[]; kpiFindings: string[] } {
  const findings: string[] = [];
  const htmlTag = /<html\b[^>]*>/.exec(html)?.[0] ?? '';

  if (!htmlTag.includes('data-template="kai-report-creator"')) findings.push('missing data-template on <html>');
  if (!htmlTag.includes(`data-version="${version}"`)) findings.push('missing data-version on <html>');
  if (!htmlTag.includes('data-render-mode="animated"')) findings.push('missing data-render-mode="animated" on <html>');
  if (!htmlTag.includes(`data-animation="${mode}"`)) findings.push(`missing data-animation="${mode}" on <html>`);
  if (!htmlTag.includes(`data-theme="${mode}"`)) findings.push('data-theme must equal data-animation (got mismatch)');

  // Chrome IDs must be real elements (markup), not strings inside scripts
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  if (!markup.includes('id="play-btn"')) findings.push('chrome contract: missing id="play-btn"');
  if (!markup.includes('id="nav-sections"')) findings.push('chrome contract: missing id="nav-sections"');

  // Script allow-list
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]!);
  if (mode === 'scrollytelling') {
    if (srcs.length !== SCROLLYTELLING_SCRIPTS.length) {
      findings.push(`pinned-script allow-list: expected exactly ${SCROLLYTELLING_SCRIPTS.length} CDN scripts, found ${srcs.length}`);
    }
    for (const s of SCROLLYTELLING_SCRIPTS) {
      const tag = `<script src="${s.src}"`;
      if (!html.includes(tag)) findings.push(`pinned-script allow-list: missing ${s.src}`);
      else if (!html.slice(html.indexOf(tag)).slice(0, 400).includes(`integrity="${s.integrity}"`)) findings.push(`pinned-script allow-list: ${s.src} missing SRI integrity`);
    }
    for (const src of srcs) {
      if (!isAllowedScriptSrc(src)) findings.push(`pinned-script allow-list: unexpected external script ${src}`);
    }
  } else {
    if (srcs.length > 0) findings.push(`iridescence is zero-CDN: found external script(s) ${srcs.join(', ')}`);
    const links = [...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map(m => m[1]!);
    const externalLinks = links.filter(h => /^https?:\/\//.test(h));
    if (externalLinks.length > 0) findings.push(`iridescence is zero-CDN: found external stylesheet(s) ${externalLinks.join(', ')}`);
    if (!html.includes('canvas.style.background')) findings.push('shader fallback missing: getContext("webgl") failure must assign canvas.style.background');
    if (!html.includes('IntersectionObserver')) findings.push('hero canvas must pause via IntersectionObserver when scrolled out');
  }

  const kpiFindings = validateSummaryKpis(html);
  return { chromeFindings: findings, kpiFindings };
}

export { escHtml, escHtmlText };
