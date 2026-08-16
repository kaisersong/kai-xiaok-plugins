import type { IRDocument } from '../../parser/ir-parser.js';
import { escHtml, escHtmlPreserveInline, escHtmlText } from '../escape.js';
import { buildReportJsonLd, escapeJsonLdForHtml } from '../jsonld.js';
import {
  AnimatedBuildCtx,
  CHROME_JS,
  MONO_STACK,
  SANS_STACK,
  extractKpis,
  heroCopy,
  parseChartSeries,
  sectionItems,
} from './common.js';

/**
 * Light iridescent mode, ported from report-creator
 * references/animated-shell/iridescence.md (v1.28.0):
 * - ZERO CDNs: no GSAP, no fonts CDN — vanilla JS + font stacks
 * - white body, ink #0a0a12, hairlines, one accent hue
 * - full-viewport WebGL shader hero (raw WebGL1, DPR-clamped, IO-paused,
 *   static-gradient fallback when getContext fails)
 * - CSS bar fills triggered once per block by IntersectionObserver
 */
export function buildIridescence(ctx: AnimatedBuildCtx): string {
  const { doc, lang, version, irHash, primaryColor } = ctx;
  const hero = heroCopy(doc);
  const kpis = extractKpis(doc);

  const summary = {
    title: doc.frontmatter.title,
    theme: 'iridescence',
    lang,
    date: doc.frontmatter.date ?? '',
    abstract: doc.frontmatter.abstract ?? '',
    poster_title: doc.frontmatter.poster_title ?? '',
    poster_subtitle: doc.frontmatter.poster_subtitle ?? '',
    poster_note: doc.frontmatter.poster_note ?? '',
    kpis,
    sections: doc.sections.map(s => ({ title: s.heading, slug: s.slug })),
  };

  const fmForLd = { ...doc.frontmatter, theme: 'iridescence' };
  const jsonLd = buildReportJsonLd({ frontmatter: fmForLd, irHash, rendererVersion: version });

  const sections = buildBlocks(ctx);
  const navDots = sections
    .map((s, i) => `        <a href="#${s.id}" title="${escHtml(s.heading)}"><span></span>${escHtmlText(s.heading)}</a>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}" data-template="kai-report-creator" data-version="${version}" data-theme="iridescence" data-render-mode="animated" data-animation="iridescence">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="kai-report-creator iridescence v${version}">
    <meta name="ir-hash" content="${irHash}">
    <title>${escHtml(doc.frontmatter.title || 'Report')}</title>
    <script type="application/ld+json">${escapeJsonLdForHtml(jsonLd)}</script>
    <style>
${IRIDESCENCE_CSS(primaryColor)}
    </style>
</head>
<body>
    <script type="application/json" id="report-summary">${JSON.stringify(summary)}</script>

    <nav class="navsecs" id="nav-sections" aria-label="Sections">
${navDots}
    </nav>
    <button class="playbtn" id="play-btn" title="Play (F5)">▶</button>

    <section class="hero" id="s0" data-sec data-heading="${escHtml(hero.title)}">
      <canvas id="iridescence-canvas"></canvas>
      <div class="veil"></div>
      <div class="hero-content">
        <p class="mono-tag">${escHtmlText((doc.frontmatter.date ?? '').replace(/-/g, '.'))} / REPORT</p>
        <h1>${accentTitle(hero.title, primaryColor)}</h1>
        ${hero.sub ? `<p class="hero-sub">${escHtmlText(hero.sub)}</p>` : ''}
        <p class="hero-meta mono">${escHtmlText([doc.frontmatter.author, doc.frontmatter.date].filter(Boolean).join(' · '))}</p>
        ${kpis.length ? `<div class="hero-stats">${kpis.slice(0, 4).map(k => `<div><span class="mono">${escHtmlText(k.label)}</span><strong>${escHtmlText(k.value)}</strong></div>`).join('')}</div>` : ''}
      </div>
      <div class="scroll-hint">SCROLL ↓</div>
    </section>

    <main>
${sections.slice(1).map(s => s.html).join('\n')}
    </main>

${CHROME_JS}
${IRIDESCENCE_RUNTIME}
</body>
</html>`;
}

function accentTitle(title: string, accent: string): string {
  const t = escHtmlText(title);
  const cut = Math.ceil(t.length / 2);
  const idx = t.slice(0, cut).length;
  const head = t.slice(0, idx);
  const tail = t.slice(idx);
  return tail ? `${head}<em style="color:${escHtml(accent)}">${tail}</em>` : t;
}

interface BuiltSection { id: string; heading: string; html: string }

function buildBlocks(ctx: AnimatedBuildCtx): BuiltSection[] {
  const { doc } = ctx;
  const out: BuiltSection[] = [{ id: 's0', heading: heroCopy(doc).title, html: '' }];

  doc.sections.forEach((section, idx) => {
    const id = `s${idx + 1}`;
    const items = sectionItems(section);
    const inner: string[] = [];
    for (const item of items) {
      inner.push(renderItem(item, ctx));
    }
    out.push({
      id,
      heading: section.heading,
      html: `      <section class="block" id="${id}" data-sec data-heading="${escHtml(section.heading)}">
        <div class="block-head">
          <p class="mono kicker">${String(idx + 2).padStart(2, '0')} / ${escHtmlText(section.heading.toUpperCase())}</p>
          <h2>${escHtmlText(section.heading)}</h2>
        </div>
${inner.join('\n')}
      </section>`,
    });
  });

  return out;
}

function renderItem(item: { kind: string; text?: string; block?: import('../../parser/ir-parser.js').IRBlock }, ctx: AnimatedBuildCtx): string {
  const { block } = item;
  const accent = ctx.primaryColor;
  switch (item.kind) {
    case 'prose':
      return `        <p class="prose">${escHtmlPreserveInline(item.text ?? '')}</p>`;
    case 'kpi': {
      const cards = extractKpis({ ...ctx.doc, blocks: [block!] }).map(k => `
          <div class="card">
            <p class="mono card-label">${escHtmlText(k.label)}</p>
            <p class="card-value">${escHtmlText(k.value)}</p>
            ${k.trend ? `<p class="card-trend" style="color:${escHtml(accent)}">${escHtmlText(k.trend)}</p>` : ''}
          </div>`).join('');
      return `        <div class="cards-grid" data-reveal>${cards}
        </div>`;
    }
    case 'chart': {
      const type = block!.params['type'] ?? 'bar';
      const data = parseChartSeries(block!.body);
      if (type === 'bar' && data.datasets.length > 0) {
        const all = data.datasets.flatMap(d => d.data.filter(v => isFinite(v)));
        const max = Math.max(0, ...all);
        const rows = data.labels.map((label, i) => {
          const v = data.datasets[0]!.data[i];
          const known = isFinite(v) && v !== null;
          const pct = known && max > 0 ? Math.round((v / max) * 100) : 0;
          const fill = known
            ? `<div class="bar-fill" data-w="${pct}" style="background:${escHtml(accent)}"></div>`
            : `<div class="bar-fill ghost" data-w="8"></div>`;
          return `          <div class="bar-row">
            <span class="mono bar-label">${escHtmlText(label)}</span>
            <div class="bar-track">${fill}</div>
            <span class="mono bar-value">${known ? escHtmlText(String(v)) : '未公开'}</span>
          </div>`;
        }).join('\n');
        return `        <div class="bars" data-bars>
${rows}
        </div>`;
      }
      // non-bar charts render as an honest table — never fabricate visuals
      const head = `<tr><th>${escHtmlText(data.datasets.map(d => d.name).join(' / ') || 'value')}</th>${data.labels.map(l => `<th>${escHtmlText(l)}</th>`).join('')}</tr>`;
      const rows = data.datasets.map(d => `<tr><td class="rowname">${escHtmlText(d.name)}</td>${d.data.map(v => `<td>${isFinite(v) ? v : '未公开'}</td>`).join('')}</tr>`).join('');
      return `        <div class="tablewrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'table': {
      const lines = block!.body.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) return '';
      const cells = (line: string) => line.split('|').map(c => c.trim()).filter(c => c && !/^[-:]+$/.test(c));
      const head = `<tr>${cells(lines[0]!).map(c => `<th>${escHtmlPreserveInline(c)}</th>`).join('')}</tr>`;
      const rows = lines.slice(2).map(l => `<tr>${cells(l).map(c => `<td>${escHtmlPreserveInline(c)}</td>`).join('')}</tr>`).join('');
      return `        <div class="tablewrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'callout':
      return `        <div class="cel"><p>${escHtmlPreserveInline(block!.body.trim())}</p></div>`;
    case 'list': {
      const items = block!.body.trim().split('\n').map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      return `        <ul class="dolist">
${items.map(i => `          <li><span class="mono">▸</span> ${escHtmlPreserveInline(i)}</li>`).join('\n')}
        </ul>`;
    }
    case 'timeline': {
      const items = block!.body.trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => {
        const m = l.trim().slice(1).trim().match(/^(.+?):\s+(.+)$/);
        return m ? { date: m[1]!, content: m[2]! } : { date: '', content: l.trim().slice(1).trim() };
      });
      return `        <div class="cels-grid">
${items.map(i => `          <div class="cel"><p class="mono cel-date">${escHtmlText(i.date)}</p><p>${escHtmlPreserveInline(i.content)}</p></div>`).join('\n')}
        </div>`;
    }
    case 'code':
      return `        <pre class="code">${escHtmlText(block!.body.trim())}</pre>`;
    case 'image': {
      const src = block!.params['src'] ?? '';
      const alt = block!.params['alt'] ?? '';
      const caption = block!.params['caption'] ?? block!.body.trim();
      if (!src) return '';
      return `        <figure class="fig"><img src="${escHtml(src)}" alt="${escHtml(alt)}">${caption ? `<figcaption class="mono">${escHtmlText(caption)}</figcaption>` : ''}</figure>`;
    }
    default:
      return '';
  }
}

function IRIDESCENCE_CSS(accent: string): string {
  return `
:root{
  --ink:#0a0a12;
  --hairline:#e8e8ee;
  --accent:${accent};
  --mono:${MONO_STACK};
  --sans:${SANS_STACK};
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:var(--ink);font-family:var(--sans);overflow-x:hidden}
.mono,.mono-tag,.kicker,.card-label,.bar-label,.bar-value,.hero-meta,figcaption,.cel-date{font-family:var(--mono)}
.hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
#iridescence-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.veil{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02) 40%,rgba(255,255,255,.45))}
.hero-content{position:relative;z-index:2;text-align:center;padding:0 clamp(1.25rem,6vw,5rem);max-width:64rem}
.mono-tag{font-size:.7rem;letter-spacing:.28em;text-transform:uppercase;color:var(--ink);opacity:.6;margin-bottom:1.4rem}
.hero h1{font-size:clamp(2.75rem,8vw,6.75rem);font-weight:900;letter-spacing:-.03em;line-height:1.04}
.hero h1 em{font-style:normal}
.hero-sub{margin-top:1.6rem;font-size:clamp(.95rem,1.4vw,1.15rem);line-height:1.8;opacity:.78;max-width:38rem;margin-left:auto;margin-right:auto}
.hero-meta{margin-top:1.2rem;font-size:.72rem;letter-spacing:.08em;opacity:.55}
.hero-stats{display:flex;gap:2.6rem;justify-content:center;margin-top:2.4rem;flex-wrap:wrap}
.hero-stats span{display:block;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin-bottom:.4rem}
.hero-stats strong{font-size:1.5rem;font-weight:800;font-variant-numeric:tabular-nums lining-nums}
.scroll-hint{position:absolute;bottom:4.5vh;left:50%;transform:translateX(-50%);z-index:2;font-family:var(--mono);font-size:.62rem;letter-spacing:.3em;opacity:.55;animation:bob 1.8s ease-in-out infinite}
.scroll-hint.hidden{display:none}
@keyframes bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}
.block{padding:5.5rem clamp(1.25rem,7vw,7rem);border-top:1px solid var(--hairline)}
.block-head{display:flex;flex-direction:column;gap:1rem;margin-bottom:2.4rem}
.kicker{font-size:.66rem;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.block h2{font-size:clamp(1.7rem,4vw,2.8rem);font-weight:900;letter-spacing:-.03em;line-height:1.1}
.prose{max-width:44rem;line-height:1.85;opacity:.82;margin-bottom:1.2rem;font-size:1rem}
.cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1.1rem}
.card{border:1px solid var(--hairline);border-radius:16px;padding:1.5rem 1.3rem;transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(10,10,18,.08)}
.card-label{font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin-bottom:.8rem}
.card-value{font-size:1.7rem;font-weight:800;font-variant-numeric:tabular-nums lining-nums}
.card-trend{font-size:.72rem;margin-top:.45rem}
.bars{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:2.4rem 3rem}
.bar-row{display:grid;grid-template-columns:minmax(4.5rem,auto) 1fr auto;gap:.8rem;align-items:center;margin-bottom:1rem}
.bar-label{font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;opacity:.6}
.bar-track{height:12px;background:#f0f0f6;border-radius:99px;overflow:hidden}
.bar-fill{height:100%;width:0;border-radius:99px;transition:width .8s cubic-bezier(.2,.7,.2,1)}
.bar-fill.ghost{background:repeating-linear-gradient(45deg,#d9d9e2 0 6px,#ececf2 6px 12px)}
.bar-value{font-size:.72rem;font-variant-numeric:tabular-nums lining-nums;opacity:.75}
.tablewrap{overflow-x:auto;margin-top:.5rem}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);text-align:left;padding:.6rem;border-bottom:2px solid var(--ink)}
td{padding:.6rem;border-bottom:1px solid var(--hairline);font-variant-numeric:tabular-nums lining-nums}
td.rowname{font-weight:700}
.cel{border:1px solid var(--hairline);border-radius:16px;padding:1.6rem}
.cel p{line-height:1.75;opacity:.85}
.cel-date{font-size:.66rem;letter-spacing:.12em;color:var(--accent);margin-bottom:.6rem}
.cels-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1.1rem}
.dolist li{list-style:none;padding:.55rem 0;border-bottom:1px solid var(--hairline);display:flex;gap:.7rem;line-height:1.7;opacity:.85}
.dolist .mono{color:var(--accent)}
.code{background:#f6f6fa;border:1px solid var(--hairline);border-radius:14px;padding:1.2rem 1.4rem;font-family:var(--mono);font-size:.78rem;line-height:1.7;overflow-x:auto}
.fig{text-align:center}
.fig img{max-width:100%;border-radius:14px;border:1px solid var(--hairline)}
.fig figcaption{font-size:.64rem;margin-top:.7rem;opacity:.6}
.navsecs{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:50;display:flex;flex-direction:column;gap:12px;align-items:flex-end}
.navsecs a{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font-family:var(--mono);font-size:.6rem;letter-spacing:.14em;opacity:.7}
.navsecs a span{width:8px;height:8px;border-radius:50%;background:#d9d9e2;transition:all .25s}
.navsecs a.active span{background:var(--accent);box-shadow:0 0 10px var(--accent)}
.navsecs a:not(:hover){font-size:0;gap:0}
.navsecs a:hover{opacity:1}
.playbtn{position:fixed;right:18px;bottom:18px;z-index:50;width:46px;height:46px;border-radius:50%;border:1px solid var(--hairline);background:#fff;box-shadow:0 6px 20px rgba(10,10,18,.1);color:var(--ink);font-size:1rem;cursor:pointer}
@media (max-width:768px){
  .navsecs{display:none}
  .block{padding:3.5rem 1.25rem}
}
@media print{.navsecs,.playbtn,.scroll-hint{display:none!important}.hero{min-height:auto}.block{page-break-inside:avoid}}
`.trim();
}

const IRIDESCENCE_RUNTIME = `    <script>
    (function(){
      /* --- nav sync (vanilla observer) --- */
      var secs=[].slice.call(document.querySelectorAll('#s0,section[data-sec]'));
      if('IntersectionObserver' in window){
        var io=new IntersectionObserver(function(entries){
          entries.forEach(function(e){
            if(!e.isIntersecting)return;
            var i=secs.indexOf(e.target);
            if(i>-1&&window.__animatedNav) window.__animatedNav.syncNav(i);
          });
        },{rootMargin:'-45% 0px -45% 0px'});
        secs.forEach(function(s){io.observe(s);});
      }

      /* --- bar fills: once per chart block --- */
      var barsBlocks=[].slice.call(document.querySelectorAll('[data-bars]'));
      if('IntersectionObserver' in window){
        var bio=new IntersectionObserver(function(entries,obs){
          entries.forEach(function(e){
            if(!e.isIntersecting)return;
            obs.unobserve(e.target);
            e.target.querySelectorAll('.bar-fill').forEach(function(f){f.style.width=(f.dataset.w||0)+'%';});
          });
        },{threshold:.35});
        barsBlocks.forEach(function(b){bio.observe(b);});
      } else {
        barsBlocks.forEach(function(b){b.querySelectorAll('.bar-fill').forEach(function(f){f.style.width=(f.dataset.w||0)+'%';});});
      }

      /* --- WebGL iridescent hero (raw WebGL1, zero CDN) --- */
      var canvas=document.getElementById('iridescence-canvas');
      if(canvas){
        var gl=canvas.getContext('webgl');
        if(!gl){
          canvas.style.background='linear-gradient(135deg,#f6f4ff 0%,#eef7f6 50%,#f9f4fb 100%)';
        } else {
          var vsrc='attribute vec2 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0.,1.);}';
          var fsrc='precision highp float;uniform float uTime;uniform vec3 uColor;uniform vec3 uResolution;uniform vec2 uMouse;uniform float uAmplitude;uniform float uSpeed;varying vec2 vUv;void main(){float mr=min(uResolution.x,uResolution.y);vec2 uv=(vUv.xy*2.0-1.0)*uResolution.xy/mr;uv+=(uMouse-vec2(0.5))*uAmplitude;float d=-uTime*0.5*uSpeed;float a=0.0;for(float i=0.0;i<8.0;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}d+=uTime*0.5*uSpeed;vec3 col=vec3(cos(uv*vec2(d,a))*0.6+0.4,cos(a+d)*0.5+0.5);col=cos(col*cos(vec3(d,a,2.5))*0.5+0.5)*uColor;gl_FragColor=vec4(col,1.0);}';
          function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
          var prog=gl.createProgram();
          gl.attachShader(prog,sh(gl.VERTEX_SHADER,vsrc));
          gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fsrc));
          gl.linkProgram(prog);gl.useProgram(prog);
          var buf=gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER,buf);
          gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,0, 1,-1,1,0, 1,1,1,1, -1,1,0,1]),gl.STATIC_DRAW);
          var pos=gl.getAttribLocation(prog,'position'),uv=gl.getAttribLocation(prog,'uv');
          gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);
          gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
          var uT=gl.getUniformLocation(prog,'uTime'),uR=gl.getUniformLocation(prog,'uResolution');
          var uC=gl.getUniformLocation(prog,'uColor'),uM=gl.getUniformLocation(prog,'uMouse');
          var uA=gl.getUniformLocation(prog,'uAmplitude'),uS=gl.getUniformLocation(prog,'uSpeed');
          gl.uniform3f(uC,0.984,0.992,1.0);gl.uniform1f(uS,1.0);gl.uniform1f(uA,0.1);gl.uniform2f(uM,0.5,0.5);
          function resize(){
            var rect=canvas.getBoundingClientRect();
            var dpr=Math.min(window.devicePixelRatio||1,2);
            canvas.width=Math.max(rect.width*dpr,1);canvas.height=Math.max(rect.height*dpr,1);
            gl.viewport(0,0,canvas.width,canvas.height);
            gl.uniform3f(uR,canvas.width,canvas.height,1.0);
          }
          resize();window.addEventListener('resize',resize);
          var running=true,t0=performance.now();
          function frame(now){
            if(running){gl.uniform1f(uT,(now-t0)/1000);gl.drawArrays(gl.TRIANGLE_FAN,0,4);}
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
          if('IntersectionObserver' in window){
            new IntersectionObserver(function(entries){
              running=entries[0]&&entries[0].isIntersecting;
            },{threshold:.05}).observe(canvas);
          }
        }
      }
    })();
    </script>`;
