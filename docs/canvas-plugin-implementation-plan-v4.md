# kai-canvas-creator 实现方案 v4（tldraw 最终版）

> 基于 tldraw（cascading license，开源项目适用）+ 独立 HTTP server + 离线 MCP。
> 经历 v1→v2→v3→v4 四轮评审。v4 回归 tldraw，保留 v2/v3 所有架构改进。

## 决策记录

用户确认 kai-xiaok-plugins 是纯开源项目、不会商业化，tldraw 的 cascading license 适用。

### v4 vs v3 变化

| 组件 | v3（Excalidraw） | v4（tldraw） | 影响 |
|---|---|---|---|
| 画布库 | Excalidraw (MIT) | **tldraw** | 回归 v1 选择 |
| 图片存储 | base64 内嵌 → 需要图片代理层 | **原生 asset URL 引用** | 删除整个 image-proxy.mjs |
| 远程同步 | 无合并机制 → debounce 守卫 | **mergeRemoteChanges + preserveLocalChanges** | 前端更简单，无数据丢失风险 |
| 前端数据流 | excalidrawAPI ref workaround | **store.listen + getStoreSnapshot** | 标准 tldraw 模式 |
| 代码量 | ~300 行 + 图片代理层 170 行 | **~200 行**（tldraw 原生处理） | 净减少 |
| schema 迁移 | 手动 | **migrateSnapshot 自动迁移** | 数据兼容性更好 |

### v4 保留的 v2/v3 架构改进

- ✅ 独立 HTTP server（不依赖 Vite middleware）
- ✅ MCP 离线优先（直读写文件系统）
- ✅ 进程生命周期（PID 双重验证 + SSE 连接计数超时）
- ✅ 跨平台 Node.js 脚本
- ✅ toolPermissions
- ✅ registry.json 完整声明
- ✅ 图片生成功能 Phase 2 条件性

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                       xiaok Desktop                          │
│                                                               │
│  ┌──────────┐                                                │
│  │ xiaok    │                                                │
│  │ Skills   │                                                │
│  └─────┬────┘                                                │
│        │                                                     │
│        ├──────────────────────┐                              │
│        ▼                      ▼                              │
│  ┌──────────┐          ┌──────────────┐                      │
│  │ canvas   │          │ canvas-http  │                      │
│  │ MCP      │          │ server       │                      │
│  │ (stdio)  │          │              │                      │
│  │          │          │ REST API     │                      │
│  │ 直读写   │          │ SSE 推送     │                      │
│  │ 文件系统 │          │ 静态资源     │                      │
│  └────┬─────┘          │ serve dist/  │                      │
│       │                └──────┬───────┘                      │
│       │  read/write           │ read/write                   │
│       │  canvas/              │      canvas/                 │
│       └──────────────▶ FS ◀───┘                              │
│                       pages/<page-id>/                       │
│                         canvas.json (asset URL 引用)          │
│                         assets/ (实际图片文件)                │
│                                                               │
│  ┌──────────────────────────────────────────┐               │
│  │ Browser / WebView  :43217                │               │
│  │ ┌──────────────────────────────────┐    │               │
│  │ │ tldraw Canvas (React SPA)        │    │               │
│  │ │ store.listen → debounce PUT      │    │               │
│  │ │ SSE → mergeRemoteChanges         │    │               │
│  │ │ AI 图片占位框 (frame shape)      │    │               │
│  │ │ 标注箭头 (arrow shape)           │    │               │
│  │ └──────────────────────────────────┘    │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

## 二、目录结构

```
plugins/kai-canvas-creator/
├── plugin.json
├── README.md
├── package.json                         # @tldraw/tldraw, react, react-dom, vite
├── vite.config.ts                       # 仅前端构建 + dev proxy
├── tsconfig.json
├── index.html
│
├── src/                                 # 前端（TypeScript）
│   ├── main.tsx
│   ├── App.tsx                          # tldraw 集成 + store 同步
│   ├── styles.css
│   └── shapes/
│       ├── AiImageHolderTool.tsx        # AI 图片占位框工具
│       └── AnnotationTool.tsx           # 标注箭头工具
│
├── server/                              # 独立 HTTP server（纯 .mjs）
│   ├── index.mjs                        # HTTP server 入口
│   ├── routes.mjs                       # REST API
│   ├── storage.mjs                      # per-page 文件持久化
│   ├── events.mjs                       # SSE 事件广播
│   └── lifecycle.mjs                    # PID + 健康检查 + 超时
│
├── mcp-servers/canvas-server/
│   ├── server.mjs                       # MCP JSON-RPC
│   ├── tools/
│   │   ├── get-selection.mjs            # 读选区（直读文件）
│   │   └── insert-image.mjs             # 插入图片（直写文件）
│   └── lib/
│       ├── tldraw-helpers.mjs           # store snapshot 操作
│       ├── image-utils.mjs              # 图片尺寸（magic bytes）
│       └── placement.mjs                # 防重叠布局
│
├── scripts/
│   ├── start-canvas.mjs                 # 跨平台启动
│   └── build.sh                         # release 构建
│
├── skills/
│   ├── canvas-open/SKILL.md
│   ├── canvas-insert/SKILL.md
│   └── canvas-annotate/SKILL.md         # Phase 2 条件性
│
├── dist/                                # gitignore
└── tests/
    ├── server.test.mjs
    └── mcp.test.mjs
```

**vs v3 变化**：删除 `server/image-proxy.mjs`（tldraw 原生支持 asset URL，不需要代理层）。

## 三、核心组件设计

### 3.1 前端 — tldraw（标准模式，无需 workaround）

```typescript
// src/App.tsx

import { Tldraw, useEditor, useValue, createShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { useEffect, useRef, useCallback, useState } from 'react'

export default function App() {
  const [ready, setReady] = useState(false)

  return (
    <div className="canvas-container">
      {!ready && <div className="status">Loading canvas...</div>}
      <Tldraw persistenceKey="kai-canvas">
        <CanvasSync onReady={() => setReady(true)} />
      </Tldraw>
    </div>
  )
}

function CanvasSync({ onReady }: { onReady: () => void }) {
  const editor = useEditor()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const baselineStore = useRef<object>({})
  const lastPutTimestamp = useRef<number>(0)
  const isApplyingRemote = useRef(false)

  // 1. 初始化：从后端加载已有快照
  useEffect(() => {
    if (!editor) return

    fetch('/api/canvas')
      .then(r => r.json())
      .then(({ snapshot }) => {
        if (!snapshot?.store) { onReady(); return }
        editor.store.mergeRemoteChanges(() => {
          const migrated = editor.store.migrateSnapshot(snapshot)
          editor.store.put(Object.values(migrated.store))
        })
        baselineStore.current = editor.store.getStoreSnapshot().store
        onReady()
      })
      .catch(() => onReady())
  }, [editor, onReady])

  // 2. 变更监听：debounce PUT 全量快照
  useEffect(() => {
    if (!editor) return

    const unsubscribe = editor.store.listen(() => {
      // 如果是远程变更触发的，不要 PUT 回去
      if (isApplyingRemote.current) return

      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const snapshot = editor.store.getStoreSnapshot()
        lastPutTimestamp.current = Date.now()
        await fetch('/api/canvas', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(snapshot)
        })
        baselineStore.current = editor.store.getStoreSnapshot().store
      }, 500)
    }, { source: 'user', scope: 'document' })

    return unsubscribe
  }, [editor])

  // 3. SSE 监听：用 mergeRemoteChanges 安全合并
  useEffect(() => {
    if (!editor) return

    let eventSource: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function refreshFromServer() {
      // 守卫：本地有 < 1秒内的 PUT → 延迟刷新
      const sinceLastPut = Date.now() - lastPutTimestamp.current
      if (sinceLastPut < 1000) {
        setTimeout(refreshFromServer, 1000 - sinceLastPut)
        return
      }

      const res = await fetch('/api/canvas')
      const { snapshot } = await res.json()
      if (!snapshot?.store) return

      isApplyingRemote.current = true
      const migrated = editor.store.migrateSnapshot(snapshot)

      // tldraw 原生能力：合并远程变更，保留本地未保存的修改
      editor.store.mergeRemoteChanges(() => {
        const recordsToPut = Object.values(migrated.store).filter(record => {
          const local = editor.store.get(record.id)
          if (!local) return true
          return JSON.stringify(local) !== JSON.stringify(record)
        })
        if (recordsToPut.length > 0) editor.store.put(recordsToPut)
      })

      isApplyingRemote.current = false
      baselineStore.current = editor.store.getStoreSnapshot().store
    }

    eventSource = new EventSource('/api/canvas-events')
    eventSource.addEventListener('canvas-changed', refreshFromServer)
    eventSource.onerror = () => {
      eventSource?.close()
      eventSource = null
      pollTimer = setInterval(refreshFromServer, 3000)
    }

    return () => { eventSource?.close(); clearInterval(pollTimer!) }
  }, [editor])

  // 4. 选区持久化
  useEffect(() => {
    if (!editor) return
    const unsubscribe = editor.store.listen(() => {
      const selectedShapes = editor.getSelectedShapes()
      const selectionState = {
        selectedShapes: selectedShapes.map(s => ({
          id: s.id,
          type: s.type,
          x: s.x, y: s.y,
          props: { w: s.props?.w, h: s.props?.h, name: s.props?.name },
          meta: s.meta
        })),
        updatedAt: new Date().toISOString()
      }

      fetch('/api/selection', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(selectionState)
      })
    }, { source: 'user', scope: 'session' })

    return unsubscribe
  }, [editor])

  return null
}
```

**关键点**：
- `store.listen` 的 `{ source: 'user' }` 过滤器确保只捕获用户操作，远程变更不会触发回写
- `mergeRemoteChanges` 包裹块内的 put 操作不会触发 `source: 'user'` 监听
- `migrateSnapshot` 自动处理 schema 版本差异
- 图片用 asset record 的 URL 引用（`/page-assets/xxx`），不经过 base64

### 3.2 独立 HTTP Server

**文件**: `server/index.mjs`

与 v3 方案完全一致。核心功能：
- 原生 `node:http` 创建服务
- REST API：`/api/canvas`, `/api/selection`, `/api/view-state`, `/api/health`, `/api/notify`
- SSE：`/api/canvas-events`
- 静态资源：serve `dist/` + `canvas/assets/` + `canvas/pages/*/assets/`
- 进程生命周期：PID 文件 + SSE 连接计数超时

详见 v3 方案的 `server/index.mjs` 和 `server/lifecycle.mjs` 设计，v4 保持不变。

### 3.3 文件存储格式（tldraw 原生，无代理层）

**v4 的最大简化**：直接使用 tldraw 的 store snapshot 格式，图片用 asset URL 引用。

```
<project-dir>/canvas/
├── pages/
│   ├── manifest.json
│   ├── <page-id-encoded>/
│   │   ├── canvas.json              # tldraw store snapshot（该页面）
│   │   └── assets/                   # 该页面的图片资源
│   │       ├── screenshot-001.png    # 实际图片文件
│   │       └── generated-002.jpg
│   └── <page-id-encoded>/
│       ├── canvas.json
│       └── assets/
├── canvas-selection.json
└── canvas-view-state.json
```

**canvas.json 中的图片引用**（非 base64）:

```json
{
  "typeName": "asset",
  "type": "image",
  "id": "asset:img-abc123",
  "props": {
    "name": "screenshot-001.png",
    "src": "/page-assets/page1/screenshot-001.png",
    "w": 1920,
    "h": 1080,
    "mimeType": "image/png",
    "fileSize": 524288
  }
}
```

10 张 500KB 图片 → canvas.json ≈ 50KB（只有路径引用），图片文件在 assets/ 目录。**不需要图片代理层。**

### 3.4 后端存储逻辑（per-page 拆分）

```javascript
// server/storage.mjs

// 保存：按 page 拆分写入
async function saveCanvasSnapshot(snapshot, canvasDir) {
  const pages = Object.values(snapshot.store)
    .filter(r => r?.typeName === 'page')
    .sort((a, b) => String(a.index ?? '').localeCompare(String(b.index ?? '')))

  if (pages.length === 0) {
    // legacy 单文件
    await atomicWrite(join(canvasDir, 'canvas.json'), snapshot)
    return { storage: 'legacy-single-file' }
  }

  // 清理已删除页面的目录
  await removeStalePageDirs(canvasDir, pages.map(p => p.id))

  // 按 page 拆分
  for (const page of pages) {
    const pageSnapshot = extractPageSnapshot(snapshot, page.id)
    // 本地化 data: URL → 文件（tldraw 粘贴图片时产生 data: URL）
    const localized = await localizeAssets(pageSnapshot, page.id, canvasDir)
    const pageDir = join(canvasDir, 'pages', pageDirName(page.id))
    await atomicWrite(join(pageDir, 'canvas.json'), localized)
  }

  return { storage: 'per-page' }
}

// 加载：合并所有 page
async function loadCanvasSnapshot(canvasDir) {
  const pageSnapshots = await readAllPageSnapshots(canvasDir)
  if (pageSnapshots.length === 0) {
    return tryReadLegacyFile(canvasDir)
  }

  const mergedStore = {}
  for (const { snapshot } of pageSnapshots) {
    Object.assign(mergedStore, snapshot.store)
  }

  return {
    snapshot: { schema: pageSnapshots[0].schema, store: mergedStore },
    storage: 'per-page'
  }
}
```

**资源本地化**（用户粘贴 data: URL 时，保存到文件）:

```javascript
async function localizeAssets(pageSnapshot, pageId, canvasDir) {
  const entries = await Promise.all(
    Object.entries(pageSnapshot.store).map(async ([id, record]) => {
      if (record?.typeName !== 'asset') return [id, record]
      return [id, await localizeAsset(record, pageId, canvasDir)]
    })
  )
  return { ...pageSnapshot, store: Object.fromEntries(entries) }
}

async function localizeAsset(asset, pageId, canvasDir) {
  const src = asset?.props?.src
  if (!src || typeof src !== 'string' || /^https?:\/\//.test(src)) return asset
  if (src.startsWith('/page-assets/')) return asset  // 已本地化

  const localized = structuredClone(asset)

  // data: URL → 文件
  if (src.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(src)
    if (!match) return localized
    const [, mimeType, base64] = match
    const buffer = Buffer.from(base64, 'base64')
    const ext = mimeToExt(mimeType)
    const fileName = `${asset.id.replace(':', '-')}-.${ext}`
    const assetsDir = join(canvasDir, 'pages', pageDirName(pageId), 'assets')
    await mkdir(assetsDir, { recursive: true })
    await writeFile(join(assetsDir, fileName), buffer)
    localized.props.src = `/page-assets/${pageDirName(pageId)}/${fileName}`
    localized.props.name = fileName
    localized.props.fileSize = buffer.length
  }

  return localized
}
```

### 3.5 MCP Server（离线优先，与 v3 一致）

MCP 工具直接读写文件系统，不依赖 HTTP server。设计完全沿用 v3：

- `kai_canvas_get_selection`：读 `canvas-selection.json`
- `kai_canvas_insert_image`：读 snapshot → 添加 asset record + image shape → 写回文件 → 可选 POST /api/notify

**MCP 插入图片时创建的 asset record**（URL 引用，非 base64）:

```javascript
const assetRecord = {
  id: assetId,
  typeName: 'asset',
  type: 'image',
  props: {
    name: fileName,
    src: `/page-assets/${pageDirName(pageId)}/${fileName}`,  // URL 引用
    w: imageSize.width,
    h: imageSize.height,
    fileSize: stat.size,
    mimeType,
    isAnimated: false
  },
  meta: {}
}
```

### 3.6 进程生命周期

与 v3 完全一致：PID 文件 + 双重验证（进程存在 + 命令行匹配）+ SSE 连接计数超时。

### 3.7 图片尺寸读取

与 v3 一致：纯 magic bytes 实现，支持 PNG/JPEG/GIF/WebP（含 VP8/VP8L/VP8X）。无外部依赖。

### 3.8 plugin.json + registry.json

与 v3 一致，toolPermissions + 跨平台声明 + install 步骤。

### 3.9 SKILL.md（3 个独立 skill）

与 v3 一致：
- `canvas-open`：打开画布
- `canvas-insert`：插入图片
- `canvas-annotate`：Phase 2 条件性（标注改图）

## 四、REST API 规范

| 端点 | 方法 | 说明 |
|---|---|---|
| `GET /api/health` | GET | `{ status, canvasDir, pid, uptime, sseClients }` |
| `GET /api/canvas` | GET | 全量 store snapshot（合并所有 page） |
| `PUT /api/canvas` | PUT | 保存快照（按 page 拆分 + 资源本地化） |
| `GET /api/selection` | GET | 当前选区状态 |
| `PUT /api/selection` | PUT | 保存选区 |
| `GET /api/view-state` | GET | 视口状态 |
| `PUT /api/view-state` | PUT | 保存视口 |
| `GET /api/canvas-events` | SSE | 画布变更事件流 |
| `POST /api/notify` | POST | MCP 插入后触发 SSE |
| `GET /page-assets/*` | GET | 页面级图片资源 |
| `GET /assets/*` | GET | 全局图片资源（legacy） |

## 五、实现步骤

### Phase 0：前置验证

| 步骤 | 验证内容 | 通过标准 |
|---|---|---|
| 0.1 | tldraw + React 19 + Vite 7 能正常渲染 | demo 页面可交互 |
| 0.2 | store.listen + mergeRemoteChanges + migrateSnapshot 工作正常 | 控制台无错误 |
| 0.3 | 确认 xiaok 图片生成能力（有/无） | 明确结论 |

### Phase 1：基础画布 MVP

| # | 文件 | 说明 |
|---|---|---|
| 1.1 | `package.json` | @tldraw/tldraw, react, react-dom, vite, fractional-indexing |
| 1.2 | `src/main.tsx` + `src/App.tsx` | tldraw 集成 + store 同步 |
| 1.3 | `server/index.mjs` | 独立 HTTP server |
| 1.4 | `server/routes.mjs` | REST API |
| 1.5 | `server/storage.mjs` | per-page 存储 + 资源本地化 |
| 1.6 | `server/events.mjs` | SSE + 连接计数 |
| 1.7 | `server/lifecycle.mjs` | PID + 双重验证 + 超时 |
| 1.8 | `scripts/start-canvas.mjs` | 跨平台启动 |
| 1.9 | `mcp-servers/canvas-server/server.mjs` | MCP JSON-RPC |
| 1.10 | `mcp-servers/canvas-server/tools/get-selection.mjs` | 读选区 |
| 1.11 | `mcp-servers/canvas-server/tools/insert-image.mjs` | 插入图片 |
| 1.12 | `mcp-servers/canvas-server/lib/image-utils.mjs` | 图片尺寸（magic bytes） |
| 1.13 | `mcp-servers/canvas-server/lib/placement.mjs` | 防重叠布局 |
| 1.14 | `plugin.json` + `skills/` | xiaok 集成 |
| 1.15 | registry.json 更新 | 注册插件 |
| 1.16 | `tests/` | 单元测试 |

### Phase 2：条件性功能

| # | 说明 | 前置条件 |
|---|---|---|
| 2.1 | AI 图片占位框（frame shape + meta） | Phase 1 完成 |
| 2.2 | 标注箭头工具 | Phase 1 完成 |
| 2.3 | AI 图片生成到画布 | xiaok 有图片生成能力 |
| 2.4 | 标注截图改图 | 同上 |

### Phase 3：打磨发布

| # | 说明 |
|---|---|
| 3.1 | PNG/SVG 导出（editor.exportAs） |
| 3.2 | release workflow 预构建 dist/ |
| 3.3 | evals/ 质量评估 |
| 3.4 | README.md 文档 |

## 六、v4 相比 v3 的简化

| 组件 | v3 | v4 |
|---|---|---|
| 图片代理层 (image-proxy.mjs) | 170 行 | **删除**（tldraw 原生 asset URL） |
| 前端 onChange workaround | excalidrawAPI ref + isRefreshingFromServer | **删除**（store.listen source 过滤） |
| 远程合并守卫 | debounce 时间戳 + 延迟刷新 | **mergeRemoteChanges** 原生处理 |
| elements.json 文件大小 | 需代理层控制 | **天然小**（URL 引用） |
| 前端总代码量 | ~470 行 | **~200 行** |

## 七、xiaok Desktop 集成

### 7.1 插件发现机制

xiaok Desktop（Electron）的插件加载链路：

```
deploy-bundled-plugins.ts          启动时把 bundled-plugins 复制到 ~/.xiaok/plugins/
    ↓
loadPlugins() (loader.ts:15)       扫描 ~/.xiaok/plugins/*/plugin.json
    ↓
parsePluginManifest() (manifest.ts)  解析 plugin.json → PluginManifest
    ↓
desktop-services.ts:837            遍历 plugin.mcpServers，对 type=stdio 启动子进程
```

**关键源码位置**：
- 插件加载：`xiaok-cli/src/platform/plugins/loader.ts:15`
- manifest 解析：`xiaok-cli/src/platform/plugins/manifest.ts:55`
- MCP 启动：`xiaok-cli/desktop/electron/desktop-services.ts:837`
- 预构建打包：`xiaok-cli/desktop/electron/deploy-bundled-plugins.ts`

### 7.2 MCP Server 注册

xiaok 的 `plugin.json` 中 `mcpServers` 是**数组格式**（不是 `.mcp.json` 文件）。每个条目：

```json
{
  "name": "server-name",
  "type": "stdio",
  "command": "node",
  "args": ["mcp-servers/canvas-server/server.mjs"],
  "env": { "KAI_CANVAS_PROJECT_DIR": "%PROJECT_DIR%" }
}
```

`manifest.ts:87-149` 的 `parseMcpServers` 支持 4 种 type：
- `stdio`：本地子进程（canvas 插件用这个）
- `sse` / `http` / `ws`：远程服务

**args 中的相对路径会自动 resolve 到插件目录**（`manifest.ts:105`）。所以 `"mcp-servers/canvas-server/server.mjs"` 会被解析为 `~/.xiaok/plugins/kai-canvas-creator/mcp-servers/canvas-server/server.mjs`。

**canvas 插件的完整 plugin.json**：

```json
{
  "name": "kai-canvas-creator",
  "version": "0.1.0",
  "platforms": ["darwin", "linux", "win32"],
  "interface": {
    "display_name": "无限画布",
    "short_description": "tldraw 驱动的本地无限画布",
    "category": "visual-collaboration",
    "capabilities": ["infinite-canvas", "image-upload", "annotation"],
    "keywords": ["canvas", "tldraw", "whiteboard", "画布", "白板"]
  },
  "skills": ["skills/canvas-open", "skills/canvas-insert"],
  "mcpServers": [
    {
      "name": "canvas-server",
      "type": "stdio",
      "command": "node",
      "args": ["mcp-servers/canvas-server/server.mjs"]
    }
  ],
  "toolPermissions": {
    "defaultPermission": "write",
    "tools": {
      "kai_canvas_get_selection": "safe",
      "kai_canvas_insert_image": "write"
    }
  },
  "hooks": [],
  "commands": [],
  "agents": []
}
```

### 7.3 界面嵌入 — Electron iframe 方案

xiaok Desktop 是 **Electron** 应用，已有 iframe 渲染基础设施。

**现有组件**：
- `desktop/renderer/src/components/ArtifactIframe.tsx` — artifact HTML 渲染（用 `srcDoc`）
- `desktop/renderer/src/components/CanvasPreview.tsx` — 文件预览（HTML/图片/PDF）
- `desktop/electron/security.ts:isAllowedNavigationUrl` — 已放行 `http://127.0.0.1`

**Canvas 嵌入方式**：canvas-open skill 启动 HTTP server 后，返回 URL `http://127.0.0.1:43217`，Desktop 前端在聊天区域用 iframe 加载。

```tsx
// 参照 ArtifactIframe.tsx 的模式，新增 CanvasIframe 组件
function CanvasIframe({ url }: { url: string }) {
  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-[var(--c-border)]">
      <iframe
        src={url}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Canvas"
      />
    </div>
  )
}
```

**CSP 兼容性**：
- `security.ts:isAllowedNavigationUrl` 只允许 `http://127.0.0.1` — canvas server 绑定 `127.0.0.1:43217` ✅
- iframe 的 `sandbox` 属性需包含 `allow-same-origin` 让 tldraw 正常工作
- tldraw 不需要 `allow-downloads`，画布数据通过 REST API 保存

**用户交互流程**：

```
用户："打开画布"
  → canvas-open skill 执行: node scripts/start-canvas.mjs --project-dir $CWD
  → HTTP server 启动在 127.0.0.1:43217
  → skill 输出: "画布已就绪: http://127.0.0.1:43217"
  → Desktop 渲染 CanvasIframe 加载该 URL
  → 用户在 iframe 内使用 tldraw 画布

用户："把这张图放到画布上"
  → canvas-insert skill 调用 MCP: kai_canvas_insert_image
  → MCP 直读写 <project>/canvas/ 文件
  → 如果 HTTP server 在运行 → POST /api/notify → SSE 推送
  → iframe 内 tldraw 通过 mergeRemoteChanges 刷新
```

### 7.4 Bundled Plugin 打包

如果 canvas 插件作为 bundled plugin（随 Desktop 安装包发布），需要：

1. **注册到 deploy-bundled-plugins.ts**：

```typescript
// xiaok-cli/desktop/electron/deploy-bundled-plugins.ts
const BUNDLED_PLUGINS = [
  'kai-report-creator',
  'kai-slide-creator',
  'cua-computer-use',
  'kai-canvas-creator'  // 新增
];
```

2. **release workflow 预构建 dist/**：

canvas 插件的 `npm install && npm run build` 需要在打包前完成。参照 kai-report-creator 的模式（release workflow checkout kai-xiaok-plugins → 构建 → 复制到 bundled-plugins/）。

3. **Node.js 运行时**：

MCP server 和 HTTP server 都是纯 Node.js（.mjs），不需要额外运行时（不像 kai-slide-creator 需要 Python）。Desktop 已内置 Node.js runtime（`xiaok-cli/desktop/electron/desktop-services.ts` 里的 `process.execPath`）。

### 7.5 环境变量传递

MCP server 需要知道当前用户项目目录。两种方式：

**方式 A（推荐）**：plugin.json mcpServers env 字段

```json
{
  "mcpServers": [{
    "name": "canvas-server",
    "type": "stdio",
    "command": "node",
    "args": ["mcp-servers/canvas-server/server.mjs"],
    "env": {
      "KAI_CANVAS_PROJECT_DIR": "${XIAOK_PROJECT_DIR}"
    }
  }]
}
```

> 注：需要确认 xiaok Desktop 是否支持 `${XIAOK_PROJECT_DIR}` 变量插值。如果不支持，MCP tool 的参数中接收 `projectDir`（当前设计已支持）。

**方式 B（兜底）**：MCP tool 参数

`kai_canvas_get_selection` 和 `kai_canvas_insert_image` 都接受 `projectDir` 参数。skill 在调用时传入当前工作目录。

---

## 八、验收标准

- [ ] `npm run build` 后 `node server/index.mjs` 独立运行
- [ ] 浏览器打开显示 tldraw 画布
- [ ] 画图后刷新页面内容仍在
- [ ] 图片用 URL 引用，canvas.json 不含 base64
- [ ] MCP 插入图片不需要 HTTP server 运行
- [ ] SSE 刷新用 mergeRemoteChanges，不覆盖正在绘制的笔画
- [ ] 端口被占时自动回退
- [ ] 关闭浏览器 30 分钟后 server 自动退出
- [ ] `node scripts/start-canvas.mjs` 在 Windows 上可运行
- [ ] `xiaok plugin install kai-canvas-creator` 自动 npm install + build
- [ ] toolPermissions 正确生效
- [ ] plugin.json 被 xiaok loadPlugins 正确加载（mcpServers 数组格式）
- [ ] MCP server 被 desktop-services.ts 正确启动为 stdio 子进程
- [ ] iframe 能加载 http://127.0.0.1:43217 且 tldraw 正常渲染
- [ ] iframe 内画布操作（画图、保存）正常工作
