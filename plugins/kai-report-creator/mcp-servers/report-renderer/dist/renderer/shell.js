import { escHtml, escHtmlText } from './escape.js';
export function buildHtmlShell(opts) {
    const zh = opts.lang === 'zh';
    const echartsScript = opts.needsEcharts
        ? '    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>\n'
        : '';
    const highlightjsLink = opts.needsHighlightjs
        ? '    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css">\n    <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>\n'
        : '';
    const tocSidebar = opts.toc ? buildTocSidebar(opts.tocItems, opts.lang) : '';
    const tocToggle = opts.toc ? buildTocToggle(opts.lang) : '';
    const exportMenu = buildExportMenu(opts.lang);
    const summaryCard = buildSummaryCard();
    const scripts = buildScripts(opts);
    const metaLine = opts.author || opts.date
        ? `\n        <p class="report-meta">${opts.author ? escHtml(opts.author) + ' · ' : ''}${escHtml(opts.date)}</p>`
        : '';
    const cardBtnText = zh ? '⊞ 摘要卡' : '⊞ Summary';
    const cardBtnTitle = zh ? '摘要卡片' : 'Summary Card';
    return `<!DOCTYPE html>
<html lang="${opts.lang}" data-template="kai-report-creator" data-version="${opts.version}" data-theme="${opts.theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="kai-report-creator ${opts.theme} v${opts.version}">
    <meta name="ir-hash" content="${opts.irHash}">
    <title>${escHtml(opts.title)}</title>
${echartsScript}${highlightjsLink}    <style>
${opts.css}
    </style>
</head>
<body>
    <script type="application/json" id="report-summary">${opts.reportSummaryJson}</script>

    <div class="edit-hotzone" id="edit-hotzone"></div>
    <button class="edit-toggle" id="edit-toggle" title="Edit mode (E)">✏ Edit</button>

${exportMenu}
${tocToggle}${tocSidebar}
    <div class="main-with-toc">
      <div class="report-wrapper">
        <div class="title-row">
          <h1>${escHtmlText(opts.title)}</h1>
          <button id="card-mode-btn" class="card-mode-btn" title="${cardBtnTitle}">${cardBtnText}</button>
        </div>${metaLine}

${summaryCard}
${opts.bodyContent}

        <footer class="report-footer">kai-report-creator v${opts.version} ${opts.theme}</footer>
      </div>
    </div>
    <div style="display:none;visibility:hidden;opacity:0;font-size:0;line-height:0;height:0;overflow:hidden;" aria-hidden="true" data-watermark="kai-report-creator v${opts.version} ${opts.theme}">kai-report-creator v${opts.version} ${opts.theme}</div>

${scripts}
</body>
</html>`;
}
function buildTocToggle(lang) {
    const label = lang === 'zh' ? '目录' : 'Table of Contents';
    return `    <button class="toc-toggle" id="toc-toggle-btn" aria-label="${label}" aria-expanded="false">☰</button>\n`;
}
function buildTocSidebar(items, lang) {
    const title = lang === 'zh' ? '目录' : 'Contents';
    const navLabel = lang === 'zh' ? '报告目录' : 'Report contents';
    const links = items.map(item => {
        const h3Class = item.level === 3 ? ' class="toc-h3"' : '';
        return `      <a href="#section-${item.slug}" data-section="${escHtml(item.text)}"${h3Class}>${escHtmlText(item.text)}</a>`;
    }).join('\n');
    return `    <nav class="toc-sidebar" id="toc-sidebar" aria-label="${navLabel}">
      <h4>${title}</h4>
${links}
    </nav>\n`;
}
function buildExportMenu(lang) {
    const zh = lang === 'zh';
    return `    <div class="export-menu" id="export-menu">
      <button class="export-item" id="export-print">${zh ? '🖨 打印 / PDF' : '🖨 Print / PDF'}</button>
      <button class="export-item" id="export-png-desktop">${zh ? '🖥 保存图片（桌面）' : '🖥 Desktop PNG'}</button>
      <button class="export-item" id="export-png-mobile">${zh ? '📱 保存图片（手机）' : '📱 Mobile PNG'}</button>
      <button class="export-item" id="export-im-share">${zh ? '💬 IM 长图' : '💬 IM Share'}</button>
    </div>
    <button class="export-btn" id="export-btn" title="Export">${zh ? '↓ 导出' : '↓ Export'}</button>\n`;
}
function buildSummaryCard() {
    return `        <div class="sc-overlay" id="sc-overlay">
          <div class="sc-card" id="sc-card">
            <button class="sc-close" id="sc-close" aria-label="Close">✕</button>
          </div>
        </div>\n`;
}
function buildScripts(opts) {
    const parts = [];
    if (opts.animations)
        parts.push(buildAnimationScript());
    if (opts.toc)
        parts.push(buildTocScript());
    parts.push(buildEditScript());
    parts.push(buildExportScript());
    parts.push(buildSummaryCardScript());
    return parts.join('\n');
}
function buildAnimationScript() {
    return `    <script>
    (function(){
      if (document.body.classList.contains('no-animations')) return;
      var fadeObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('visible'); fadeObserver.unobserve(e.target); }});
      }, {threshold:0.08});
      document.querySelectorAll('.fade-in-up').forEach(function(el){ fadeObserver.observe(el); });

      function staggerGroup(parentSel, childSel, delay){
        document.querySelectorAll(parentSel).forEach(function(parent){
          new IntersectionObserver(function(entries, obs){
            if(!entries[0].isIntersecting) return;
            obs.disconnect();
            parent.classList.add('stagger-ready');
            parent.querySelectorAll(childSel).forEach(function(el,i){
              setTimeout(function(){ el.classList.add('visible'); }, i*delay);
            });
          }, {threshold:0.1}).observe(parent);
        });
      }
      staggerGroup('.kpi-grid','.kpi-card',100);
      staggerGroup('.timeline','.timeline-item',130);

      var kpiObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(!e.isIntersecting) return;
          var el = e.target;
          var target = parseFloat(el.dataset.targetValue);
          if(isNaN(target)) return;
          var prefix = el.dataset.prefix||'';
          var suffix = el.dataset.suffix||'';
          var isFloat = String(target).indexOf('.')!==-1;
          var decimals = isFloat ? String(target).split('.')[1].length : 0;
          var startTime = null;
          var duration = 1200;
          function animate(ts){
            if(!startTime) startTime=ts;
            var progress = Math.min((ts-startTime)/duration,1);
            var ease = 1-Math.pow(1-progress,3);
            var current = isFloat ? (ease*target).toFixed(decimals) : Math.floor(ease*target).toLocaleString();
            el.textContent = prefix+current+suffix;
            if(progress<1) requestAnimationFrame(animate);
            else el.textContent = prefix+(isFloat?target.toFixed(decimals):target.toLocaleString())+suffix;
          }
          requestAnimationFrame(animate);
          kpiObserver.unobserve(el);
        });
      }, {threshold:0.3});
      document.querySelectorAll('.kpi-value[data-target-value]').forEach(function(el){ kpiObserver.observe(el); });
    })();
    </script>`;
}
function buildTocScript() {
    return `    <script>
    (function(){
      var tocBtn = document.getElementById('toc-toggle-btn');
      var tocSidebar = document.getElementById('toc-sidebar');
      if(!tocBtn||!tocSidebar) return;
      var locked=false, closeTimer;
      function openToc(){ clearTimeout(closeTimer); tocSidebar.classList.add('open'); tocBtn.setAttribute('aria-expanded','true'); }
      function scheduleClose(){ closeTimer=setTimeout(function(){ if(!locked){ tocSidebar.classList.remove('open'); tocBtn.setAttribute('aria-expanded','false'); }},150); }
      tocBtn.addEventListener('mouseenter', openToc);
      tocSidebar.addEventListener('mouseenter', openToc);
      tocBtn.addEventListener('mouseleave', scheduleClose);
      tocSidebar.addEventListener('mouseleave', scheduleClose);
      tocBtn.addEventListener('click', function(){ locked=!locked; tocBtn.classList.toggle('locked',locked); if(locked) openToc(); else scheduleClose(); });
      document.querySelectorAll('.toc-sidebar a').forEach(function(a){ a.addEventListener('click',function(){ if(!locked) scheduleClose(); }); });
      var tocLinks = document.querySelectorAll('.toc-sidebar a[data-section]');
      if(tocLinks.length){
        var sectionObserver = new IntersectionObserver(function(entries){
          entries.forEach(function(e){
            var id = e.target.dataset.section;
            var link = document.querySelector('.toc-sidebar a[data-section="'+CSS.escape(id)+'"]');
            if(link) link.classList.toggle('active', e.isIntersecting);
          });
        }, {rootMargin:'-10% 0px -60% 0px'});
        document.querySelectorAll('section[data-section]').forEach(function(s){ sectionObserver.observe(s); });
      }
    })();
    </script>`;
}
function buildEditScript() {
    return `    <script>
    (function(){
      var hotzone = document.getElementById('edit-hotzone');
      var toggle = document.getElementById('edit-toggle');
      if(!hotzone||!toggle) return;
      var active=false, hideTimer;
      function showBtn(){ clearTimeout(hideTimer); toggle.classList.add('show'); }
      function schedHide(){ hideTimer=setTimeout(function(){ if(!active) toggle.classList.remove('show'); },400); }
      hotzone.addEventListener('mouseenter', showBtn);
      hotzone.addEventListener('mouseleave', schedHide);
      toggle.addEventListener('mouseenter', showBtn);
      toggle.addEventListener('mouseleave', schedHide);
      function enterEdit(){
        active=true; toggle.classList.add('active','show'); toggle.textContent='✓ Done';
        document.body.classList.add('edit-mode');
        document.querySelectorAll('h1,h2,h3,p,li,td,th,figcaption').forEach(function(el){ el.setAttribute('contenteditable','true'); });
      }
      function exitEdit(){
        active=false; toggle.classList.remove('active'); toggle.textContent='✏ Edit';
        document.body.classList.remove('edit-mode');
        document.querySelectorAll('[contenteditable]').forEach(function(el){ el.removeAttribute('contenteditable'); });
        schedHide();
      }
      hotzone.addEventListener('click', function(){ active?exitEdit():enterEdit(); });
      toggle.addEventListener('click', function(){ active?exitEdit():enterEdit(); });
      document.addEventListener('keydown', function(e){
        if((e.key==='e'||e.key==='E')&&!document.activeElement.getAttribute('contenteditable')){ active?exitEdit():enterEdit(); }
        if((e.ctrlKey||e.metaKey)&&e.key==='s'){
          e.preventDefault();
          var html='<!DOCTYPE html>\\n'+document.documentElement.outerHTML;
          var a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([html],{type:'text/html'})),download:location.pathname.split('/').pop()||'report.html'});
          a.click(); URL.revokeObjectURL(a.href);
        }
      });
    })();
    </script>`;
}
function buildExportScript() {
    return `    <script>
    (function(){
      var exportBtn=document.getElementById('export-btn');
      var exportMenu=document.getElementById('export-menu');
      var printBtn=document.getElementById('export-print');
      var pngDesktop=document.getElementById('export-png-desktop');
      var pngMobile=document.getElementById('export-png-mobile');
      var pngIM=document.getElementById('export-im-share');
      if(!exportBtn||!exportMenu) return;
      var LABEL=exportBtn.textContent;
      var PRINT_MODE_CLASS='print-exporting';

      exportBtn.addEventListener('click',function(e){ e.stopPropagation(); exportMenu.classList.toggle('open'); });
      document.addEventListener('click',function(e){ if(!exportBtn.contains(e.target)&&!exportMenu.contains(e.target)) exportMenu.classList.remove('open'); });

      var libPromise=null;
      function loadLib(){
        if(libPromise) return libPromise;
        libPromise=new Promise(function(resolve){
          if(window.html2canvas){resolve();return;}
          var s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/html2canvas@1/dist/html2canvas.min.js';
          s.onload=resolve; document.head.appendChild(s);
        });
        return libPromise;
      }
      loadLib();

      function restore(){ exportBtn.style.visibility=''; exportBtn.textContent=LABEL; }
      function exportBgColor(){
        var rs=getComputedStyle(document.documentElement);
        var v=(rs.getPropertyValue('--bg')||'').trim();
        if(v) return v;
        var bc=getComputedStyle(document.body).backgroundColor;
        if(bc&&bc!=='rgba(0, 0, 0, 0)'&&bc!=='transparent') return bc;
        return '#ffffff';
      }
      function filename(suffix,ext){
        var d=new Date(),pad=function(n){return String(n).padStart(2,'0');};
        var date=d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate());
        return (document.title||'report').replace(/[\\/\\\\:*?"<>|]/g,'_')+'_'+date+suffix+'.'+ext;
      }
      function saveBlob(canvas,fname,jpeg){
        canvas.toBlob(function(blob){
          var a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname});
          a.click(); URL.revokeObjectURL(a.href); restore();
        }, jpeg?'image/jpeg':'image/png', jpeg?0.92:1);
      }
      function capture(el,cfg,fname,jpeg){
        exportMenu.classList.remove('open');
        exportBtn.style.visibility='hidden'; exportBtn.textContent='…';
        var cardBtn=document.getElementById('card-mode-btn');
        if(cardBtn) cardBtn.style.visibility='hidden';
        if(document.body.classList.contains('card-mode')){
          var card=document.getElementById('sc-card');
          var cardFname=filename('-摘要卡',jpeg?'jpg':'png');
          loadLib().then(function(){return html2canvas(card,{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff'});}).then(function(c){
            if(cardBtn) cardBtn.style.visibility=''; restore(); saveBlob(c,cardFname,jpeg);
          });
          return;
        }
        var tocSidebar=document.getElementById('toc-sidebar');
        var tocToggle=document.getElementById('toc-toggle-btn');
        var tocIsOpen=tocSidebar&&tocSidebar.classList.contains('open');
        if(tocToggle&&!tocIsOpen) tocToggle.style.visibility='hidden';
        document.querySelectorAll('.fade-in-up').forEach(function(e){e.classList.add('visible');});
        loadLib().then(function(){return html2canvas(el,cfg);}).then(function(c){
          if(tocToggle&&!tocIsOpen) tocToggle.style.visibility='';
          if(cardBtn) cardBtn.style.visibility='';
          saveBlob(c,fname,jpeg);
        });
      }

      function preparePrintExport(){
        exportMenu.classList.remove('open');
        exportBtn.style.visibility='hidden';
        document.documentElement.classList.add(PRINT_MODE_CLASS);
        document.documentElement.style.setProperty('--print-bg-color',exportBgColor());
      }
      function cleanupPrintExport(){
        document.documentElement.classList.remove(PRINT_MODE_CLASS);
        document.documentElement.style.removeProperty('--print-bg-color');
        restore();
      }
      window.addEventListener('afterprint',cleanupPrintExport);

      printBtn&&printBtn.addEventListener('click',function(){
        preparePrintExport();
        requestAnimationFrame(function(){requestAnimationFrame(function(){window.print();});});
      });
      pngDesktop&&pngDesktop.addEventListener('click',function(){
        var H=document.documentElement.scrollHeight;
        capture(document.documentElement,{scale:H>4000?2.5:3,useCORS:true,allowTaint:true,scrollX:0,scrollY:0,width:document.documentElement.scrollWidth,height:H,windowWidth:document.documentElement.scrollWidth,windowHeight:H},filename('','png'),false);
      });
      pngMobile&&pngMobile.addEventListener('click',function(){
        var el=document.querySelector('.report-wrapper')||document.documentElement;
        capture(el,{scale:(750/el.offsetWidth)*2,useCORS:true,allowTaint:true,backgroundColor:exportBgColor(),scrollX:0,scrollY:0,width:el.scrollWidth,height:el.scrollHeight},filename('-mobile','jpg'),true);
      });
      pngIM&&pngIM.addEventListener('click',function(){
        var el=document.querySelector('.report-wrapper')||document.documentElement;
        capture(el,{scale:(800/el.offsetWidth)*2,useCORS:true,allowTaint:true,backgroundColor:exportBgColor(),scrollX:0,scrollY:0,width:el.scrollWidth,height:el.scrollHeight},filename('-im','jpg'),true);
      });
    })();
    </script>`;
}
function buildSummaryCardScript() {
    return `    <script>
    (function(){
      var btn=document.getElementById('card-mode-btn');
      var overlay=document.getElementById('sc-overlay');
      var closeBtn=document.getElementById('sc-close');
      if(!btn||!overlay) return;

      function splitPosterTitle(d){
        var t=(d.poster_title||'').trim();
        var s=(d.poster_subtitle||'').trim();
        var raw=(d.title||'').trim();
        return {main:t||raw, sub:t?s:''};
      }
      function summaryCardLabel(){
        var lang=(document.documentElement.lang||'').toLowerCase();
        return lang.startsWith('zh')?'报告摘要':'Report Summary';
      }
      function posterNoteText(d){
        var explicit=(d.poster_note||'').trim();
        if(explicit) return explicit;
        var raw=(d.abstract||'').trim();
        if(!raw) return '';
        var m=raw.match(/^(.{0,72}?[。！？!?]|.{0,120})/);
        var sentence=(m&&m[1])?m[1].trim():raw;
        return sentence.length>72?sentence.slice(0,72).trim()+'…':sentence;
      }
      function buildCard(){
        try{
          var d=JSON.parse(document.getElementById('report-summary').textContent);
          var poster=splitPosterTitle(d);
          var note=posterNoteText(d);
          var leftHtml='<div class="sc-left"><div class="sc-label">'+summaryCardLabel()+'</div><div class="sc-title-main">'+
            (poster.main||'')+'</div>'+(poster.sub?'<div class="sc-title-sub">'+poster.sub+'</div>':'')+
            (note?'<div class="sc-note">'+note+'</div>':'')+'</div>';
          var kpiRowsHtml=(d.kpis||[]).slice(0,6).map(function(k){
            return '<div class="sc-kpi-row"><div class="sc-kpi-row-l">'+(k.label||'')+
              '</div><div class="sc-kpi-row-v">'+(k.value||'')+(k.trend?' <span class="sc-kpi-row-t">'+k.trend+'</span>':'')+
              '</div></div>';
          }).join('');
          var sectionSummaries=Array.from(document.querySelectorAll('section[data-section]')).map(function(s){
            return {name:s.dataset.section||'',text:s.dataset.summary||''};
          }).filter(function(s){return s.name;}).slice(0,3);
          var summariesHtml=sectionSummaries.map(function(s){
            return '<div class="sc-sum-item"><div class="sc-sum-name">'+s.name+'</div>'+
              (s.text?'<div class="sc-sum-text">'+s.text+'</div>':'')+'</div>';
          }).join('');
          var rightHtml='<div class="sc-right">'+(kpiRowsHtml?'<div class="sc-kpi-rows">'+kpiRowsHtml+'</div>':'')+
            (summariesHtml?'<div class="sc-summaries" style="margin-top:.5rem">'+summariesHtml+'</div>':'')+'</div>';
          var card=document.getElementById('sc-card');
          card.insertAdjacentHTML('beforeend',leftHtml+rightHtml);
        }catch(e){
          var card2=document.getElementById('sc-card');
          card2.insertAdjacentHTML('beforeend','<div style="padding:2rem;color:#666">Summary unavailable.</div>');
        }
      }
      var built=false;
      function openCard(){ if(!built){buildCard();built=true;} document.body.classList.add('card-mode'); overlay.setAttribute('aria-hidden','false'); }
      function closeCard(){ document.body.classList.remove('card-mode'); overlay.setAttribute('aria-hidden','true'); }
      btn.addEventListener('click',openCard);
      closeBtn&&closeBtn.addEventListener('click',closeCard);
      overlay.addEventListener('click',function(e){if(e.target===overlay) closeCard();});
      document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.body.classList.contains('card-mode')) closeCard();});
    })();
    </script>`;
}
//# sourceMappingURL=shell.js.map