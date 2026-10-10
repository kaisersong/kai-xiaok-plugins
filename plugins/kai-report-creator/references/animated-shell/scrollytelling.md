# Animated Mode: Scrollytelling (滚动叙事暗色版)

Dark, GSAP-driven scroll narrative. Read [overview.md](overview.md) first for
pipeline invariants, IR mapping, and shared frame chrome.

## Contract

- **One HTML file**, everything inline. Exactly **three CDNs allowed** — pin
  versions AND integrity (SRI) so a CDN compromise cannot inject code:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
    integrity="sha512-7eHRwcbYkK4d9g/6tD/mhkf++eoTHwpNM9woBxtPUBWm67zeAfFC+HrdoE2GanKeocly/VxeLvIqwvCdk7qScg=="
    crossorigin="anonymous"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
    integrity="sha512-onMTRKJBKz8M1TnqqDuGBlowlH0ohFzMXYRNebz+yOcc5TQr/zAKsthzhuv0hiyUKEiQEQXEynnXCvNTOk50dg=="
    crossorigin="anonymous"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/countup.js/2.8.0/countUp.umd.min.js"
    integrity="sha512-kUIpdMjMlkYUVQgR3wVXJtmuwoD+G69Zt9JBa2rPH4C/+VPlAsQWKcqCv0SpJ8AnezBjfuM2JDjnc58Ee8Filw=="
    crossorigin="anonymous"></script>
  ```
  These three `(src, integrity)` pairs are mirrored in
  `scripts/html_quality_gate.py` (`SCROLLYTELLING_ALLOWED_SCRIPTS`) and the gate
  requires the page to load **exactly** them — bumping a version means updating
  both this recipe and that set, which is the point of pinning.
  **No fonts CDN, no local assets** — declare font stacks with graceful
  fallbacks. Default UI stack is **CJK-first**: `'Microsoft YaHei','PingFang
  SC',sans-serif`. 金句/标题 stack on CJK pages: `'Microsoft YaHei','PingFang
  SC',serif` + `font-style:italic` (synthesized oblique) — **do NOT lead with
  Georgia**: its old-style figures make digits inside prose (e.g. “ARR ÷ 365”)
  render 高低不齐. Reserve real serif faces for pure-Latin pages. Labels
  `'JetBrains Mono',Menlo,'Microsoft YaHei','PingFang SC',monospace`.
- Real data only (source material / user numbers). Chinese copy follows the
  conversation language; keep 金句 short and punchy.
- Vanilla JS + GSAP; no frameworks.

## Defaults for bare prompts (user gives only topic + data)

The user should never need to write a spec — apply these defaults and generate
directly; do not ask style questions.

- **Chapter arc (8–10 sections)**: Hero → 核心 KPI → 总体趋势(柱+线) →
  结构/构成(桑基或环) → 多序列对比(river/双轴) → 分组画像(雷达或排名) →
  体感换算锚点卡 → 风险/展望(risk-mode 收尾)。Drop sections the data cannot
  support; never pad.
- **Colors**: use the brand color if known/stated (derive base/bright/highlight
  by lightening); otherwise default to the aurora purple ramp
  (#5842EA / #9463FF / #C9BBFF) with teal #00B3A6 as complement.
- **金句 formula**: one verdict + one tension, ≤14 chars per line
  (e.g. 「量利齐升、结构向优。」「增长的含金量，藏在第二条曲线里。」).
- Only ask when data is missing or ambiguous; everything visual is decided by
  this recipe.

## Design system (adapt colors to the topic/brand)

- Near-black gradient bg (`#030604→#0b0d0b` style) + **two fixed radial glows at
  3–5% opacity** (brand hue top-left, complement bottom-right). **禁止星空/极光/粒子**。
- One brand color ramp (base/bright/highlight) + one complement for second series.
- Type trio: serif italic **仅用于金句/章节标题** · sans (YaHei-first) for
  UI/body · mono for kickers/labels (uppercase, letter-spacing .2em+). Two hard
  rules: ① the mono stack MUST end with CJK fallbacks
  (`...,'Microsoft YaHei','PingFang SC',monospace`) or Chinese inside labels
  falls back to a random serif; ② **every numeric display (KPI 值/锚点大数)
  uses the sans stack bold + `font-variant-numeric:tabular-nums lining-nums`**
  — never Georgia for digits (old-style figures render 高低不齐).
- Glass cards: `background:rgba(...,.03-.42); backdrop-filter:blur(20px);
  border:1px solid rgba(brand,.1-.16); border-radius:18-20px`.

## Frame chrome (always)

1. Top **2px white progress bar** — `gsap.to(bar,{scaleX:1,scrollTrigger:{scrub:.3}})`.
2. Fixed centered **brand bar** (mono, uppercase, blurred pill).
3. Right **pill nav** (container `id="nav-sections"`): one dot per section; hover shows label; active dot =
   bright + glow. Wire with a per-section `ScrollTrigger{start:'top 50%',
   end:'bottom 50%',onToggle}` — NOT `Math.round(scrollY/innerHeight)` (breaks
   when sections ≠ 100vh).
4. Round **back-to-top** button (appears after ~500px); the play button uses
   `id="play-btn"`.
5. **Curtain flash** on chapter change: fixed white overlay,
   `gsap.fromTo(curtain,{opacity:0},{opacity:.12,duration:.15,yoyo:true,repeat:1})`.
6. **Keyboard section paging (always on)** — see overview.md frame chrome #1;
   sync `navSec` from the same per-section ScrollTrigger as the pill nav.
7. **Play (present) mode** — see overview.md frame chrome #2. On
   `fullscreenchange` always call `ScrollTrigger.refresh()` (viewport size
   changed → trigger windows are stale).

## Section patterns (pick per story; ~8–10 sections)

- **Hero**: 2 counter-rotating dashed orbit circles (SVG circles + gsap rotation,
  `svgOrigin:'cx cy'`), ~26 floating micro-glows (divs, CSS keyframes), inline
  brand SVG logo with a one-shot light sweep + click ripple; subtitle lines in
  `overflow:hidden` masks sliding up (`yPercent:110→0`, stagger). Mouse parallax
  **gated behind a ~1.7s ready flag**. No tickers/chips/clocks on the hero.
- **KPI CountUp**: 4 glass cards; numbers via CountUp in the section's onEnter.
- **Bar + line combo**: bars `scaleY:0→1` staggered; overlay line via
  stroke-dash draw-in; value labels fade in after.
- **Concentric rings**: `C=2πr`; set `strokeDasharray:C, strokeDashoffset:C`,
  animate to `C*(1-pct)`; rotate -90° so it starts at 12 o'clock.
- **River / multi-line**: Catmull-Rom → cubic Bézier (helper below), one path
  per series, staggered dash draw-in; dots pop with `back.out`.
- **Sankey**: columns of node rects — **solid highlight-color fill, rx≈4, NO
  stroke** (框线在深底上是噪音;颜色编码交给缎带); ribbons are cubic Bézier
  **strokes with stroke-width = value×scale**; accumulate `outOff`/`inOff` per
  node while building links (see helper), draw ribbons behind nodes, animate
  dash + opacity.
- **Dual-axis**: bars (left axis) + percent line (right axis, complement color).
- **Radar**: N-axis polygon grid; data polygons enter with
  `gsap.fromTo(poly,{scale:0},{scale:1,svgOrigin:'cx cy'})`.
- **Anchor cards**: translate huge numbers into 物理参照 (≈国家 GDP 等),
  serif italic equivalents.
- **Risk mode finale**: toggling section adds `body.risk-mode`
  (`filter:hue-rotate(-20deg)` on the bg layer) — this trigger intentionally has
  **NO `once:true`** and removes the class on leave/leaveBack.

## 铁律 (hard rules)

1. Every chart is **built/animated inside its own
   `ScrollTrigger.create({trigger:'#sN',start:'top 55-65%',once:true,onEnter})`**;
   CountUp starts in the SAME onEnter as its section's chart.
2. **Never CSS `transform-origin` on SVG elements** — use GSAP `svgOrigin`
   (or animate attributes). Bars start at `scaleY:0` with
   `svgOrigin:'<xCenter> <yBottom>'`.
3. `stroke-dash` draw-ins must measure `getTotalLength()` after setting `d`.
4. The risk section is the only non-`once:true` trigger.
5. `window.addEventListener('load',()=>ScrollTrigger.refresh())`.

## Pitfalls (from real generations)

- **Mask-line reveal**: if the hidden state comes from CSS
  `transform:translateY(112%)`, GSAP parses it as a **pixel `y`** that persists
  when you tween `yPercent` — the line never enters the mask. Always
  `gsap.set(lines,{y:0,yPercent:112})` first, then tween `yPercent:0`.
- **CountUp global**: `countUp.umd.min.js` exposes `countUp.CountUp`;
  `countUp.min.js` differs. Guard: `if(window.countUp&&countUp.CountUp)` else use
  a tiny rAF fallback counter — never let a CDN quirk zero out the KPIs.
- Loading Google Fonts adds a 4th origin — **violates the 3-CDN rule**; use stacks.
- Give radar/rings a viewBox centered at the animation origin (e.g.
  `viewBox="-220 -210 440 420"`) so `svgOrigin:'0 0'` is trivial.
- Keep glass borders/labels readable: labels ≥10px mono, grid lines ≤8% white.

## Helpers (inline verbatim)

```js
function catmullRomPath(p){ if(p.length<2)return '';
  let d=`M ${p[0][0]} ${p[0][1]}`;
  for(let i=0;i<p.length-1;i++){
    const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
    d+=` C ${b[0]+(c[0]-a[0])/6} ${b[1]+(c[1]-a[1])/6}, ${c[0]-(e[0]-b[0])/6} ${c[1]-(e[1]-b[1])/6}, ${c[0]} ${c[1]}`;
  } return d; }

// sankey ribbon: call per link, AFTER laying out node x/y/h (value*scale)
function ribbon(g,s,t,v,scale,color){
  s.outOff=s.outOff||0; t.inOff=t.inOff||0;
  const y1=s.y+s.outOff+v*scale/2, y2=t.y+t.inOff+v*scale/2,
        x1=s.x+s.w, x2=t.x, cx=(x1+x2)/2;
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d',`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`);
  p.setAttribute('fill','none'); p.setAttribute('stroke',color);
  p.setAttribute('stroke-width',Math.max(v*scale,2)); p.setAttribute('opacity',.5);
  g.insertBefore(p,g.firstChild);
  s.outOff+=v*scale; t.inOff+=v*scale; return p; }
```
