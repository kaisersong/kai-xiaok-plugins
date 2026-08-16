import type { IRDocument } from '../../parser/ir-parser.js';
import { escHtml, escHtmlPreserveInline, escHtmlText } from '../escape.js';
import { buildReportJsonLd, escapeJsonLdForHtml } from '../jsonld.js';
import {
  AnimatedBuildCtx,
  CHROME_JS,
  MONO_STACK,
  SANS_STACK,
  SCROLLYTELLING_SCRIPTS,
  SERIF_CJK_STACK,
  extractKpis,
  heroCopy,
  parseChartSeries,
  sectionItems,
} from './common.js';

/**
 * Dark GSAP scroll narrative, ported from report-creator
 * references/animated-shell/scrollytelling.md (v1.28.0):
 * - exactly 3 pinned CDN scripts (GSAP + ScrollTrigger + CountUp, SRI)
 * - near-black gradient + two fixed radial glows, glass cards
 * - frame chrome: progress bar, brand bar, pill nav (#nav-sections),
 *   play button (#play-btn), curtain flash, keyboard paging, play mode
 * - every chart is built + animated inside its own once:true ScrollTrigger
 */
export function buildScrollytelling(ctx: AnimatedBuildCtx): string {
  const { doc, lang, version, irHash, primaryColor } = ctx;
  const hero = heroCopy(doc);
  const kpis = extractKpis(doc);
  const sections = buildSections(ctx);

  const summary = {
    title: doc.frontmatter.title,
    theme: 'scrollytelling',
    lang,
    date: doc.frontmatter.date ?? '',
    abstract: doc.frontmatter.abstract ?? '',
    poster_title: doc.frontmatter.poster_title ?? '',
    poster_subtitle: doc.frontmatter.poster_subtitle ?? '',
    poster_note: doc.frontmatter.poster_note ?? '',
    kpis,
    sections: doc.sections.map(s => ({ title: s.heading, slug: s.slug })),
  };

  const fmForLd = { ...doc.frontmatter, theme: 'scrollytelling' };
  const jsonLd = buildReportJsonLd({ frontmatter: fmForLd, irHash, rendererVersion: version });

  const navDots = sections
    .map((s, i) => `        <a href="#${s.id}" data-i="${i}" title="${escHtml(s.heading)}"><span></span>${escHtmlText(s.heading)}</a>`)
    .join('\n');

  const cdnTags = SCROLLYTELLING_SCRIPTS
    .map(s => `    <script src="${s.src}" integrity="${s.integrity}" crossorigin="anonymous"></script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}" data-template="kai-report-creator" data-version="${version}" data-theme="scrollytelling" data-render-mode="animated" data-animation="scrollytelling">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="kai-report-creator scrollytelling v${version}">
    <meta name="ir-hash" content="${irHash}">
    <title>${escHtml(doc.frontmatter.title || 'Report')}</title>
    <script type="application/ld+json">${escapeJsonLdForHtml(jsonLd)}</script>
${cdnTags}
    <style>
${SCROLLYTELLING_CSS(primaryColor)}
    </style>
</head>
<body>
    <script type="application/json" id="report-summary">${JSON.stringify(summary)}</script>

    <div class="progress" id="progress"></div>
    <div class="brandbar">${escHtmlText(doc.frontmatter.title || 'REPORT')}</div>
    <nav class="navsecs" id="nav-sections" aria-label="Sections">
${navDots}
    </nav>
    <button class="playbtn" id="play-btn" title="Play (F5)">▶</button>
    <button class="totop" id="totop" title="Back to top">↑</button>
    <div class="curtain" id="curtain"></div>
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>

    <main>
${sections.map(s => s.html).join('\n')}
    </main>

${CHROME_JS}
${SCROLLYTELLING_RUNTIME}
</body>
</html>`;
}

interface BuiltSection { id: string; heading: string; html: string }

function buildSections(ctx: AnimatedBuildCtx): BuiltSection[] {
  const { doc } = ctx;
  const out: BuiltSection[] = [];
  const hero = heroCopy(doc);
  const heroIdx = 0;

  // Hero section
  out.push({
    id: 's0',
    heading: hero.title,
    html: `      <section class="sec hero" id="s0" data-sec data-heading="${escHtml(hero.title)}">
        <div class="orbits" aria-hidden="true">
          <svg viewBox="0 0 400 400"><circle class="orbit orbit-a" cx="200" cy="200" r="180"/><circle class="orbit orbit-b" cx="200" cy="200" r="130"/></svg>
        </div>
        <p class="kicker">01 / ${escHtmlText((doc.frontmatter.date ?? '').replace(/-/g, '.'))}</p>
        <h1 class="hero-title">${escHtmlText(hero.title)}</h1>
        ${hero.sub ? `<p class="hero-sub">${escHtmlText(hero.sub)}</p>` : ''}
        <div class="scroll-hint">SCROLL ↓</div>
      </section>`,
  });

  doc.sections.forEach((section, idx) => {
    const n = heroIdx + 1 + idx;
    const id = `s${n}`;
    const items = sectionItems(section);
    const inner: string[] = [];
    for (const item of items) {
      inner.push(renderItem(item, id, ctx));
    }
    out.push({
      id,
      heading: section.heading,
      html: `      <section class="sec" id="${id}" data-sec data-heading="${escHtml(section.heading)}">
        <div class="sec-inner">
          <p class="kicker">${String(n + 1).padStart(2, '0')} / ${escHtmlText(section.heading.toUpperCase())}</p>
          <h2>${escHtmlText(section.heading)}</h2>
${inner.join('\n')}
        </div>
      </section>`,
    });
  });

  return out;
}

function renderItem(item: { kind: string; text?: string; block?: import('../../parser/ir-parser.js').IRBlock }, secId: string, ctx: AnimatedBuildCtx): string {
  const { block } = item;
  switch (item.kind) {
    case 'prose':
      return `          <p class="prose">${escHtmlPreserveInline(item.text ?? '')}</p>`;
    case 'kpi': {
      const cards = extractKpis({ ...ctx.doc, blocks: [block!] }).map(k => {
        const m = String(k.value).match(/^([^0-9.-]*)(-?[\d.,]+)(.*)$/);
        const prefix = m ? m[1]! : '';
        const value = m ? m[2]! : String(k.value);
        const suffix = m ? m[3]! : '';
        return `            <div class="kpi glass">
              <p class="kpi-label">${escHtmlText(k.label)}</p>
              <p class="kpi-value" data-prefix="${escHtml(prefix)}" data-value="${escHtml(value)}" data-suffix="${escHtml(suffix)}">${escHtmlText(k.value)}</p>
              ${k.trend ? `<p class="kpi-trend">${escHtmlText(k.trend)}</p>` : ''}
            </div>`;
      }).join('\n');
      return `          <div class="kpi-grid">
${cards}
          </div>`;
    }
    case 'chart': {
      const type = block!.params['type'] ?? 'bar';
      if (['bar', 'line', 'pie'].includes(type)) {
        const data = parseChartSeries(block!.body);
        const payload = JSON.stringify({ type, ...data });
        return `          <div class="chart glass" data-chart="${escHtml(payload)}"></div>`;
      }
      // Unsupported chart types render as an honest data table — never fabricate visuals
      const data = parseChartSeries(block!.body);
      const head = `<tr><th>${escHtmlText(data.datasets.map(d => d.name).join(' / ') || 'value')}</th>${data.labels.map(l => `<th>${escHtmlText(l)}</th>`).join('')}</tr>`;
      const rows = data.datasets.map(d => `<tr><td class="rowname">${escHtmlText(d.name)}</td>${d.data.map(v => `<td>${v}</td>`).join('')}</tr>`).join('');
      return `          <div class="chart-table glass"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'table': {
      const lines = block!.body.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) return '';
      const cells = (line: string) => line.split('|').map(c => c.trim()).filter(c => c && !/^[-:]+$/.test(c));
      const head = `<tr>${cells(lines[0]!).map(c => `<th>${escHtmlPreserveInline(c)}</th>`).join('')}</tr>`;
      const rows = lines.slice(2).map(l => `<tr>${cells(l).map(c => `<td>${escHtmlPreserveInline(c)}</td>`).join('')}</tr>`).join('');
      return `          <div class="glass tablewrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'callout':
      return `          <div class="cel glass"><p class="cel-quote">${escHtmlPreserveInline(block!.body.trim())}</p></div>`;
    case 'list': {
      const items = block!.body.trim().split('\n').map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      return `          <ul class="dolist glass">\n${items.map(i => `        <li>${escHtmlPreserveInline(i)}</li>`).join('\n')}\n          </ul>`;
    }
    case 'timeline': {
      const items = block!.body.trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => {
        const m = l.trim().slice(1).trim().match(/^(.+?):\s+(.+)$/);
        return m ? { date: m[1]!, content: m[2]! } : { date: '', content: l.trim().slice(1).trim() };
      });
      return `          <div class="steps">\n${items.map(i => `        <div class="step glass"><span class="step-date">${escHtmlText(i.date)}</span><span>${escHtmlPreserveInline(i.content)}</span></div>`).join('\n')}\n          </div>`;
    }
    case 'code':
      return `          <pre class="glass code">${escHtmlText(block!.body.trim())}</pre>`;
    case 'image': {
      const src = block!.params['src'] ?? '';
      const alt = block!.params['alt'] ?? '';
      const caption = block!.params['caption'] ?? block!.body.trim();
      if (!src) return '';
      return `          <figure class="fig"><img src="${escHtml(src)}" alt="${escHtml(alt)}">${caption ? `<figcaption>${escHtmlText(caption)}</figcaption>` : ''}</figure>`;
    }
    default:
      return '';
  }
}

function SCROLLYTELLING_CSS(primary: string): string {
  return `
:root{
  --brand:${primary};
  --bright:color-mix(in srgb,var(--brand) 60%,#c9bbff);
  --high:color-mix(in srgb,var(--brand) 30%,#fff);
  --complement:#00B3A6;
  --ink:#eef1ee;
  --ink-dim:rgba(238,241,238,.68);
  --mono:${MONO_STACK};
  --sans:${SANS_STACK};
  --serif:${SERIF_CJK_STACK};
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:auto}
body{background:linear-gradient(160deg,#030604,#0b0d0b 60%,#030604);color:var(--ink);font-family:var(--sans);overflow-x:hidden}
.glow{position:fixed;width:60vmax;height:60vmax;border-radius:50%;pointer-events:none;z-index:0}
.glow-a{top:-20vmax;left:-20vmax;background:radial-gradient(circle,var(--brand) 0%,transparent 60%);opacity:.05}
.glow-b{bottom:-20vmax;right:-20vmax;background:radial-gradient(circle,var(--complement) 0%,transparent 60%);opacity:.04}
.progress{position:fixed;top:0;left:0;width:100%;height:2px;background:#fff;transform-origin:0 50%;transform:scaleX(0);z-index:60}
.brandbar{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:50;font-family:var(--mono);font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-dim);background:rgba(10,13,11,.55);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:.45rem 1.1rem;white-space:nowrap;max-width:70vw;overflow:hidden;text-overflow:ellipsis}
.navsecs{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:50;display:flex;flex-direction:column;gap:12px;align-items:flex-end}
.navsecs a{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink-dim);font-family:var(--mono);font-size:.6rem;letter-spacing:.14em;opacity:.75}
.navsecs a span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.28);transition:all .25s}
.navsecs a.active span{background:var(--high);box-shadow:0 0 12px var(--bright)}
.navsecs a:not(:hover){font-size:0;gap:0}
.navsecs a:hover{opacity:1}
.playbtn{position:fixed;right:18px;bottom:18px;z-index:50;width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(10,13,11,.55);backdrop-filter:blur(20px);color:var(--ink);font-size:1rem;cursor:pointer}
.totop{position:fixed;right:18px;bottom:74px;z-index:50;width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(10,13,11,.55);backdrop-filter:blur(20px);color:var(--ink);font-size:1rem;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s}
.totop.show{opacity:1;pointer-events:auto}
.curtain{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:70}
.glass{background:rgba(255,255,255,.04);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.12);border-radius:18px}
.sec{position:relative;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:14vh clamp(1.25rem,7vw,7rem) 10vh;z-index:1}
.sec-inner{width:100%;max-width:64rem}
.kicker{font-family:var(--mono);font-size:.68rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--bright);margin-bottom:1.1rem}
.sec h1,.sec h2{font-family:var(--sans);font-weight:900;letter-spacing:-.02em;line-height:1.08;margin-bottom:1.6rem}
.sec h1{font-size:clamp(2.2rem,6vw,4.4rem)}
.sec h2{font-size:clamp(1.6rem,3.6vw,2.6rem)}
.prose{color:var(--ink-dim);line-height:1.85;max-width:44rem;margin-bottom:1.2rem;font-size:1.02rem}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr));gap:1rem;margin:1.4rem 0}
.kpi{padding:1.3rem 1.2rem}
.kpi-label{font-family:var(--mono);font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:.8rem}
.kpi-value{font-family:var(--sans);font-weight:800;font-variant-numeric:tabular-nums lining-nums;font-size:1.9rem;color:var(--high)}
.kpi-trend{font-family:var(--mono);font-size:.66rem;color:var(--complement);margin-top:.5rem}
.chart{margin:1.6rem 0;padding:1.4rem;min-height:12rem}
.chart svg{width:100%;height:auto;display:block}
.chart-table,.tablewrap{margin:1.4rem 0;padding:1rem 1.2rem;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.86rem}
th{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--bright);text-align:left;padding:.55rem .6rem;border-bottom:1px solid rgba(255,255,255,.14)}
td{padding:.55rem .6rem;color:var(--ink-dim);border-bottom:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums lining-nums}
td.rowname{color:var(--ink)}
.cel{margin:1.6rem 0;padding:2rem 2.2rem;border-color:color-mix(in srgb,var(--brand) 35%,transparent)}
.cel-quote{font-family:var(--serif);font-style:italic;font-size:clamp(1.15rem,2.2vw,1.5rem);line-height:1.7;color:var(--high)}
.dolist{margin:1.4rem 0;padding:1.4rem 1.8rem}
.dolist li{list-style:none;color:var(--ink-dim);line-height:1.9;padding-left:1.2rem;position:relative}
.dolist li::before{content:'';position:absolute;left:0;top:.85em;width:5px;height:5px;border-radius:50%;background:var(--bright)}
.steps{display:flex;flex-direction:column;gap:.8rem;margin:1.4rem 0}
.step{display:flex;gap:1rem;align-items:baseline;padding:.95rem 1.2rem}
.step-date{font-family:var(--mono);font-size:.66rem;letter-spacing:.12em;color:var(--complement);white-space:nowrap}
.code{margin:1.4rem 0;padding:1.3rem;font-family:var(--mono);font-size:.78rem;line-height:1.7;overflow-x:auto;color:var(--ink-dim)}
.fig{margin:1.6rem 0;text-align:center}
.fig img{max-width:100%;border-radius:14px}
.fig figcaption{font-family:var(--mono);font-size:.64rem;color:var(--ink-dim);margin-top:.7rem}
.hero .orbits{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.4;pointer-events:none}
.hero .orbits svg{width:min(80vmin,560px);height:auto}
.orbit{fill:none;stroke:rgba(255,255,255,.16);stroke-dasharray:4 10;stroke-width:1}
.orbit-a{transform-origin:200px 200px;animation:spin 60s linear infinite}
.orbit-b{transform-origin:200px 200px;animation:spin 42s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.hero-sub{color:var(--ink-dim);max-width:40rem;line-height:1.85;margin:0 auto}
.scroll-hint{position:absolute;bottom:5vh;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:.62rem;letter-spacing:.3em;color:var(--ink-dim);animation:bob 1.8s ease-in-out infinite}
.scroll-hint.hidden{display:none}
@keyframes bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}
@media (max-width:768px){
  .navsecs{display:none}
  .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sec{padding:12vh 1.25rem 8vh;min-height:auto}
}
@media print{.navsecs,.playbtn,.totop,.brandbar,.progress,.scroll-hint,.glow{display:none!important}.sec{min-height:auto;page-break-inside:avoid}}
`.trim();
}

const SCROLLYTELLING_RUNTIME = `    <script>
    (function(){
      if(!window.gsap){return;}
      gsap.registerPlugin(ScrollTrigger);

      gsap.to('#progress',{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.3}});

      var totop=document.getElementById('totop');
      window.addEventListener('scroll',function(){ if(totop) totop.classList.toggle('show',window.scrollY>500); },{passive:true});
      if(totop) totop.addEventListener('click',function(){ window.scrollTo({top:0,behavior:'smooth'}); });

      var secs=[].slice.call(document.querySelectorAll('section[data-sec]'));
      var curtain=document.getElementById('curtain');

      secs.forEach(function(sec,i){
        ScrollTrigger.create({
          trigger:sec,start:'top 50%',end:'bottom 50%',
          onToggle:function(self){
            if(self.isActive&&window.__animatedNav) window.__animatedNav.syncNav(i);
          }
        });
        if(i>0){
          ScrollTrigger.create({
            trigger:sec,start:'top 65%',once:true,onEnter:function(){
              if(curtain) gsap.fromTo(curtain,{opacity:0},{opacity:.12,duration:.15,yoyo:true,repeat:1});
              gsap.fromTo(sec.querySelectorAll('.kicker,h2,.prose'),{y:34,opacity:0},{y:0,opacity:1,duration:.7,stagger:.08,ease:'power3.out'});
            }
          });
        }
        buildChartsFor(sec);
      });

      function countUp(el){
        var target=parseFloat(el.dataset.value);
        if(isNaN(target)){return;}
        var prefix=el.dataset.prefix||'',suffix=el.dataset.suffix||'';
        var isFloat=String(target).indexOf('.')!==-1;
        var decimals=isFloat?String(target).split('.')[1].length:0;
        var raw=String(el.dataset.value).replace(/,/g,'');
        if(window.countUp&&countUp.CountUp){
          try{ new countUp.CountUp(el,parseFloat(raw),{decimalPlaces:decimals,prefix:prefix,suffix:suffix,duration:1.6}); return; }catch(e){}
        }
        var t0=null;
        function frame(ts){
          if(!t0)t0=ts;
          var p=Math.min((ts-t0)/1400,1),e=1-Math.pow(1-p,3);
          var cur=isFloat?(e*target).toFixed(decimals):Math.floor(e*target).toLocaleString();
          el.textContent=prefix+cur+suffix;
          if(p<1)requestAnimationFrame(frame);else el.textContent=prefix+(isFloat?target.toFixed(decimals):target.toLocaleString())+suffix;
        }
        requestAnimationFrame(frame);
      }

      function catmullRomPath(p){ if(p.length<2)return '';
        var d='M '+p[0][0]+' '+p[0][1];
        for(var i=0;i<p.length-1;i++){
          var a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
          d+=' C '+(b[0]+(c[0]-a[0])/6)+' '+(b[1]+(c[1]-a[1])/6)+','+(c[0]-(e[0]-b[0])/6)+' '+(c[1]-(e[1]-b[1])/6)+','+c[0]+' '+c[1];
        } return d; }

      function buildChart(el){
        var data;
        try{ data=JSON.parse(el.dataset.chart); }catch(e){ return; }
        var NS='http://www.w3.org/2000/svg';
        var W=800,H=340,PAD=46;
        var svg=document.createElementNS(NS,'svg');
        svg.setAttribute('viewBox','0 0 '+W+' '+H);
        var labels=data.labels||[],sets=data.datasets||[];
        var all=sets.reduce(function(acc,s){return acc.concat(s.data);},[0]);
        var max=Math.max.apply(null,all.map(function(v){return isFinite(v)?v:0;}));

        function ramp(i){ var hue=[getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()||'#5842EA','#9463FF','#00B3A6','#C9BBFF','#eab308'][i%5]; return hue; }

        if(data.type==='bar'){
          var groups=labels.length,series=sets.length;
          var inner=W-PAD*2,bw=inner/groups,gw=bw*0.68/Math.max(series,1);
          sets.forEach(function(s,si){
            s.data.forEach(function(v,gi){
              var h=max?(v/max)*(H-PAD*2-24):0;
              var x=PAD+gi*bw+(bw-gw*series)/2+si*gw;
              var r=document.createElementNS(NS,'rect');
              r.setAttribute('x',x);r.setAttribute('y',H-PAD-h);
              r.setAttribute('width',Math.max(gw-3,2));r.setAttribute('height',Math.max(h,1));
              r.setAttribute('rx',3);r.setAttribute('fill',ramp(si));
              svg.appendChild(r);
              gsap.set(r,{scaleY:0,svgOrigin:(x+gw/2)+' '+(H-PAD)});
              gsap.to(r,{scaleY:1,duration:.7,delay:gi*.06+si*.1,ease:'power3.out',
                onComplete:(function(val,xx){return function(){
                  var t=document.createElementNS(NS,'text');
                  t.setAttribute('x',xx);t.setAttribute('y',H-PAD-6);t.setAttribute('text-anchor','middle');
                  t.setAttribute('class','val');t.textContent=val;
                  svg.appendChild(t);gsap.fromTo(t,{opacity:0},{opacity:1,duration:.3});
                };})(v,x+gw/2)});
            });
          });
          labels.forEach(function(l,gi){
            var t=document.createElementNS(NS,'text');
            t.setAttribute('x',PAD+gi*bw+bw/2);t.setAttribute('y',H-PAD+22);t.setAttribute('text-anchor','middle');t.setAttribute('class','lab');
            t.textContent=l;svg.appendChild(t);
          });
        } else if(data.type==='line'){
          var innerW=W-PAD*2,innerH=H-PAD*2-24;
          sets.forEach(function(s,si){
            var pts=s.data.map(function(v,i){
              return [PAD+(labels.length>1?i*innerW/(labels.length-1):innerW/2),H-PAD-(max?v/max*innerH:0)];
            });
            var p=document.createElementNS(NS,'path');
            p.setAttribute('d',catmullRomPath(pts));
            p.setAttribute('fill','none');p.setAttribute('stroke',ramp(si));p.setAttribute('stroke-width',2.5);
            svg.appendChild(p);
            var L=p.getTotalLength();
            p.style.strokeDasharray=L;p.style.strokeDashoffset=L;
            gsap.to(p,{strokeDashoffset:0,duration:1.4,delay:si*.25,ease:'power2.inOut'});
            pts.forEach(function(pt,pi){
              var c=document.createElementNS(NS,'circle');
              c.setAttribute('cx',pt[0]);c.setAttribute('cy',pt[1]);c.setAttribute('r',4);c.setAttribute('fill',ramp(si));
              svg.appendChild(c);
              gsap.fromTo(c,{scale:0,svgOrigin:pt[0]+' '+pt[1]},{scale:1,duration:.4,delay:.5+si*.25+pi*.05,ease:'back.out(2)'});
            });
          });
          labels.forEach(function(l,i){
            var t=document.createElementNS(NS,'text');
            t.setAttribute('x',PAD+(labels.length>1?i*innerW/(labels.length-1):innerW/2));t.setAttribute('y',H-PAD+22);
            t.setAttribute('text-anchor','middle');t.setAttribute('class','lab');t.textContent=l;svg.appendChild(t);
          });
        } else if(data.type==='pie'){
          var vals=(sets[0]&&sets[0].data)||[];
          var total=vals.reduce(function(a,b){return a+b;},0)||1;
          var cx=W/2,cy=H/2,baseR=Math.min(W,H)/2-60;
          vals.forEach(function(v,i){
            var r=baseR-i*34;if(r<=10)return;
            var C=2*Math.PI*r,pct=v/total;
            var ring=document.createElementNS(NS,'circle');
            ring.setAttribute('cx',cx);ring.setAttribute('cy',cy);ring.setAttribute('r',r);
            ring.setAttribute('fill','none');ring.setAttribute('stroke',ramp(i));ring.setAttribute('stroke-width',18);
            ring.setAttribute('stroke-dasharray',C+' '+C);
            ring.setAttribute('transform','rotate(-90 '+cx+' '+cy+')');
            var track=ring.cloneNode();
            track.setAttribute('stroke','rgba(255,255,255,.07)');
            svg.insertBefore(track,svg.firstChild);
            svg.appendChild(ring);
            ring.setAttribute('stroke-dashoffset',C);
            gsap.to(ring,{attr:{'stroke-dashoffset':C*(1-pct)},duration:1.2,delay:i*.15,ease:'power2.out'});
            var lab=document.createElementNS(NS,'text');
            lab.setAttribute('x',cx);lab.setAttribute('y',cy-baseR+i*34+4);lab.setAttribute('text-anchor','middle');lab.setAttribute('class','lab');
            lab.textContent=(labels[i]||'')+' '+(Math.round(pct*1000)/10)+'%';
            svg.appendChild(lab);
          });
        }
        el.appendChild(svg);
      }

      function buildChartsFor(sec){
        var charts=sec.querySelectorAll('[data-chart]');
        if(!charts.length)return;
        var kpis=sec.querySelectorAll('.kpi-value');
        ScrollTrigger.create({
          trigger:sec,start:'top 58%',once:true,
          onEnter:function(){
            charts.forEach(buildChart);
            kpis.forEach(countUp);
          }
        });
      }

      window.addEventListener('load',function(){ScrollTrigger.refresh();});
      window.__onViewportChange=function(){ScrollTrigger.refresh();};
    })();
    </script>`;
