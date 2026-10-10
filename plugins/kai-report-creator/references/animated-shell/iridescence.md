# Animated Mode: Iridescence (流动虹彩浅色版)

Light theme with a full-viewport WebGL shader hero — and **ZERO CDNs** (no
GSAP; vanilla JS only, fonts via stacks — never Google Fonts). Read
[overview.md](overview.md) first for pipeline invariants, IR mapping, and
shared frame chrome (keyboard paging + play mode are REQUIRED here too,
implemented vanilla).

## Theme & page arc

- **Theme**: white body, ink `#0a0a12`, hairline `#e8e8ee`; one accent hue
  (brand color) + per-item colors on cards/bars. Mono for kickers/labels
  (`'JetBrains Mono',Menlo,'Microsoft YaHei','PingFang SC',monospace`),
  CJK-first sans for body (`'Microsoft YaHei','PingFang SC',sans-serif`).
- **Page arc**: `#hero`(100vh WebGL) → cards grid → bar metrics (2-col) →
  structured conclusions (2×2 cel grid) → comparison table → dark `#sources`
  block (`#0a0a12`, every claim gets its source + 采集日期) → footer.
- **Section chrome**: each block has mono index kicker (`02 / PLATFORMS`),
  big tight title (clamp, letter-spacing −.03em), right-aligned mono desc.
- **Data honesty**: declare **all** data as `const` blocks at the top of the
  script (one per series/section is fine) and keep them consistent with the IR;
  render functions must contain no literal data. Undisclosed fields are `null`,
  rendered as 「未公开」 with a **ghost bar**
  (`repeating-linear-gradient(45deg,#d9d9e2 0 6px,#ececf2 6px 12px)`, width ~8%)
  — never fabricate a value to fill a chart.
- **Hero layers**: `<canvas>` z-0 → white `veil` gradient overlay z-1
  (`rgba(255,255,255,.08)→.02→.45` top-to-bottom, keeps text readable) →
  content z-2 (nav, mono tag, clamp 44–108px title with accent `<em>`, sub,
  meta line, stats row) → bobbing `SCROLL ↓` cue.

## WebGL hero (inline verbatim; raw WebGL1, no library)

Uniforms: `color=[0.984,0.992,1] speed=1.0 amplitude=0.1 mouse fixed (0.5,0.5)`;
fragment shader:

```glsl
precision highp float;
uniform float uTime;uniform vec3 uColor;uniform vec3 uResolution;
uniform vec2 uMouse;uniform float uAmplitude;uniform float uSpeed;
varying vec2 vUv;
void main(){
  float mr=min(uResolution.x,uResolution.y);
  vec2 uv=(vUv.xy*2.0-1.0)*uResolution.xy/mr;
  uv+=(uMouse-vec2(0.5))*uAmplitude;
  float d=-uTime*0.5*uSpeed;
  float a=0.0;
  for(float i=0.0;i<8.0;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}
  d+=uTime*0.5*uSpeed;
  vec3 col=vec3(cos(uv*vec2(d,a))*0.6+0.4,cos(a+d)*0.5+0.5);
  col=cos(col*cos(vec3(d,a,2.5))*0.5+0.5)*uColor;
  gl_FragColor=vec4(col,1.0);
}
```

Vertex shader: passthrough quad (`attribute vec2 uv/position; vUv=uv;
gl_Position=vec4(position,0,1)`), TRIANGLE_FAN over
`[-1,-1,0,0, 1,-1,1,0, 1,1,1,1, -1,1,0,1]` (stride 16, uv offset 8).

## Hard rules

1. `getContext('webgl')` may fail (headless/no GPU) → assign a static
   `canvas.style.background` gradient and skip the RAF loop. The gate checks
   that the assignment exists, **not** which colours it uses — tint the
   fallback to match the report's brand.
2. Clamp DPR: `Math.min(devicePixelRatio||1,2)`; resize canvas from
   `getBoundingClientRect()` on `resize`.
3. **IntersectionObserver on the canvas** (threshold .05): pause the RAF loop
   when the hero scrolls out, resume on re-enter — never burn GPU below the fold.
4. Tint via `uColor` only (near-white = pastel rainbow; multiply by brand tint
   for a branded wash). Do NOT edit the shader math.
5. Bars animate by setting `.bar-fill` width (CSS transition
   `.8s cubic-bezier(.2,.7,.2,1)`), triggered once per chart block by an
   IntersectionObserver (threshold ~.35) — no chart lib. Cards hover:
   `translateY(-4px)` + soft shadow.
6. **Frame chrome (overview.md #1/#2) implemented vanilla** — the play button
   must carry `id="play-btn"` and the section nav `id="nav-sections"`:
   `secs=[...querySelectorAll('#hero,section.block')]`; `navSec` synced by an
   IntersectionObserver (`rootMargin:'-45% 0px -45% 0px'`) and set immediately
   in `goSec()`; fixed round ▶ button + `F5` toggle `body.playing` +
   fullscreen; wheel (`passive:false`, ~700ms lock) and click (left quarter =
   back) page ONE section while playing; `Esc`/`fullscreenchange` exits. Do
   NOT set `overflow:hidden` on `body.playing` — it breaks `scrollIntoView`
   paging; the wheel `preventDefault` is enough.
7. Zero network requests besides the file itself (verify in devtools).
