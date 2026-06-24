---
name: canvas-open
description: >
  打开本地无限画布。触发词：打开画布、open canvas、infinite canvas、
  手绘画布、sketch canvas、白板、新建画布、恢复画布、之前的画布。不用于：
  幻灯片/演示（用 slide-planner）、报告/看板（用 report-creator）。
version: 0.9.0
metadata: {"emoji":"🎨","os":["darwin","linux","win32"]}
---

# Canvas Open

Open or restore a canvas in xiaok desktop. Each session gets its own canvas — no cross-session interference.

## Decision tree

When user says "打开画布" / "新建画布":
→ Open the current session's canvas (Step 1 + 2)

When user says "恢复画布" / "之前的画布" / "打开之前画的" / "历史画布":
→ List saved canvases (Step 0), let user choose, then resume

## Step 0: List historical canvases (only when user wants to restore)

```bash
node /Users/song/projects/kai-xiaok-plugins/plugins/kai-infinity-canvas/scripts/start-canvas.mjs --list
```

This prints a JSON array like:
```json
[{"id":"sess_abc123","title":"Canvas abc123","updatedAt":"2025-06-23T12:00:00Z","shapes":5}]
```

Show the list to the user as a simple numbered list. Ask which one to open.
When they choose, run:

```bash
node /Users/song/projects/kai-xiaok-plugins/plugins/kai-infinity-canvas/scripts/start-canvas.mjs --resume <chosen-id>
```

Then proceed to Step 2.

## Step 1: Ensure server is running (new or current session)

```bash
node /Users/song/projects/kai-xiaok-plugins/plugins/kai-infinity-canvas/scripts/start-canvas.mjs
```

No arguments needed. The script:
- Detects the current session ID from `XIAOK_CODE_SESSION_ID` env var
- Creates/reuses `~/.xiaok/canvas/sessions/<sessionId>/` as the canvas data dir
- Reuses a healthy server already serving this session → prints `reuse:PORT:id`
- Or kills old + starts fresh → prints `started:PORT:id`

## Step 2: Write launcher HTML

Use the Write tool to write `~/.xiaok/artifacts/canvas.html`:

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>无限画布</title>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#fff}#c{width:100%;height:100%}.l{display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#64646b;flex-direction:column;gap:12px}.s{width:32px;height:32px;border:3px solid #e4e4e7;border-top-color:#0b6e6e;border-radius:50%;animation:sp .8s linear infinite}.e{color:#dc2626;font-size:13px;padding:16px;text-align:center}.b{padding:8px 20px;border:none;border-radius:8px;background:#0b6e6e;color:#fff;font-size:14px;cursor:pointer}@keyframes sp{to{transform:rotate(360deg)}}</style>
</head><body><div id="c"><div class="l"><div class="s"></div><span>正在加载画布…</span></div></div>
<script>
var B='http://127.0.0.1:43217';
function L(){var c=document.getElementById('c');c.innerHTML='<div class="l"><div class="s"></div><span>正在加载画布…</span></div>';fetch(B+'/api/health',{signal:AbortSignal.timeout(3000)}).then(function(r){return r.json()}).then(function(h){if(h.status!=='ok')throw new Error('unhealthy');return fetch(B+'/')}).then(function(r){return r.text()}).then(function(h){h=h.replace('<head>','<head><base href="'+B+'/">');document.open();document.write(h);document.close()}).catch(function(e){var c=document.getElementById('c');c.innerHTML='<div class="l"><div class="e">画布未启动<br>'+e.message+'</div><button class="b" onclick="L()">重试</button></div>'})}
window.addEventListener('offline',function(){var c=document.getElementById('c');if(!c.querySelector('.e'))c.innerHTML='<div class="l"><div class="e">连接断开</div><button class="b" onclick="L()">重新连接</button></div>'});
L();
</script>
</body></html>
```

Then say: "画布已打开！" — do NOT output any URL.

## How session isolation works

```
~/.xiaok/canvas/sessions/
├── sess_abc123/          ← session A's canvas
│   ├── pages/page/canvas.json
│   ├── pages/page/assets/
│   └── .canvas-meta.json
├── sess_def456/          ← session B's canvas
│   ├── pages/page/canvas.json
│   └── ...
└── default/              ← fallback (no session ID)
```

- Each session's canvas is fully isolated — no cross-session data pollution
- Saying "打开画布" again in the SAME session → reuses/restarts with same data, previous content intact
- Saying "打开画布" in a DIFFERENT session → gets a blank canvas
- Saying "恢复之前的画布" → shows list of all historical canvases, user picks one to reopen

## Do NOT

- Do NOT tell the user a URL
- Do NOT skip the Write step — the HTML file IS the canvas panel
- Do NOT pass session ID manually — the script reads it from env
