# kai-canvas-creator 实现方案

> 基于 tldraw（Apache-2.0）自研的 xiaok 无限画布插件，参考 Cowart 架构但代码全新实现。

## 一、项目定位

为 xiaok Desktop 提供本地无限画布能力：构思、标注、图片生成与标注驱动的图片迭代。画布数据持久化在用户当前项目目录下，而非插件目录内。

| 属性 | 值 |
|---|---|
| 插件名 | `kai-canvas-creator` |
| 类别 | `local-automation` / `visual-collaboration` |
| 运行时 | Node.js 18+ |
| 前端框架 | React 19 + tldraw 5 |
| 构建工具 | Vite 7 |
| MCP 协议 | JSON-RPC 2.0 over stdio |
| 数据存储 | 用户项目 `<project>/canvas/` 目录 |
| 默认端口 | 43217 |

## 二、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    xiaok Desktop                         │
│                                                          │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │ xiaok    │────▶│ canvas-mcp   │────▶│ canvas-server│ │
│  │ Skill    │     │ (stdio)      │     │ (HTTP :43217)│ │
│  │ (LLM)    │     │              │     │              │ │
│  └──────────┘     └──────────────┘     └──────┬───────┘ │
│       │                  │                    │         │
│       │           read/write               read/write   │
│       │           selection.json            canvas/     │
│       │                  │                  pages/      │
│       │                  ▼                  assets/     │
│       │           ┌──────────────┐              │       │
│       │           │ filesystem   │◀─────────────┘       │
│       │           │ (project)    │                      │
│       │           └──────────────┘                      │
│       │                                                 │
│       ▼                                                 │
│  ┌──────────────────────────────────────┐              │
│  │ Browser / WebView                    │              │
│  │ http://127.0.0.1:43217              │              │
│  │ ┌────────────────────────────────┐  │              │
│  │ │ tldraw Canvas (React SPA)      │  │              │
│  │ │ - 无限画布                     │  │              │
│  │ │ - AI 图片占位框                │  │              │
│  │ │ - 标注工具                     │  │              │
│  │ │ - 图片形状                     │  │              │
│  │ └────────────────────────────────┘  │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户在画布操作 ──▶ tldraw 前端 ──▶ Vite middleware (REST API)
                                          │
                         ┌────────────────┤
                         ▼                ▼
                   canvas/pages/    canvas-selection.json
                   <page-id>/
                   canvas.json      canvas-view-state.json
                         │
                         ▼
                   canvas/pages/
                   <page-id>/assets/

xiaok LLM ──▶ MCP tool (get_selection / insert_image)
                    │                    │
                    ▼                    ▼
              读 selection.json    HTTP PUT /api/canvas
                                   (通过 canvas-server 写入)
```

## 三、目录结构

```
plugins/kai-canvas-creator/
├── plugin.json                          # xiaok 插件清单
├── README.md                            # 插件文档
├── package.json                         # 前端依赖 (tldraw, react, vite)
├── vite.config.ts                       # Vite 配置 + 自定义 server middleware
├── index.html                           # SPA 入口
│
├── src/                                 # 前端源码
│   ├── main.tsx                         # React 挂载
│   ├── App.tsx                          # 主组件：tldraw 集成
│   ├── styles.css                       # 样式
│   ├── hooks/
│   │   ├── useCanvasSync.ts             # 画布数据双向同步 (REST + SSE)
│   │   ├── useSelectionSync.ts          # 选区状态持久化
│   │   └── useViewStateSync.ts          # 视口状态持久化
│   ├── shapes/
│   │   ├── AiImageHolderTool.tsx        # AI 图片占位框工具
│   │   └── AnnotationTool.tsx           # 标注箭头工具
│   └── utils/
│       └── api.ts                       # REST API 客户端
│
├── server/                              # 画布后端 (Vite middleware)
│   ├── storage.ts                       # 文件系统持久化 (per-page + legacy)
│   ├── routes.ts                        # REST API 路由定义
│   ├── events.ts                        # SSE 事件广播
│   └── assets.ts                        # 图片资源管理
│
├── mcp-servers/
│   └── canvas-server/
│       ├── server.mjs                   # MCP JSON-RPC 入口
│       ├── tools/
│       │   ├── get-selection.mjs        # 读选区工具
│       │   └── insert-image.mjs         # 插入图片工具
│       └── lib/
│           ├── tldraw-helpers.mjs       # tldraw record 操作
│           ├── image-utils.mjs          # 图片尺寸读取
│           └── placement.mjs            # 防重叠布局算法
│
├── scripts/
│   ├── start-canvas.sh                  # 启动画布服务
│   └── build.sh                         # 构建前端 dist
│
├── skills/
│   └── canvas-planner/
│       └── SKILL.md                     # xiaok skill (统一入口)
│
├── dist/                                # 构建产物 (gitignore)
│   └── (vite build output)
│
└── tests/
    ├── server.test.mjs                  # 后端 API 测试
    └── mcp.test.mjs                     # MCP 工具测试
```

## 四、核心组件设计

### 4.1 前端 — tldraw 画布

**技术栈**: React 19 + tldraw 5 + Vite 7

**职责**:
- 渲染无限画布
- 提供工具栏：选择、矩形、椭圆、文本、手绘、箭头、AI图片占位框、标注
- 将画布变更自动同步到后端 REST API
- 持久化选区状态和视口状态

**关键设计**:

```typescript
// src/App.tsx 核心逻辑

// 1. 初始化：从后端加载已有快照
const response = await fetch('/api/canvas')
const { snapshot } = await response.json()
editor.store.mergeRemoteChanges(() => {
  editor.store.put(Object.values(snapshot.store))
})

// 2. 变更监听：debounce 同步到后端
editor.store.listen(onStoreChange, { source: 'user', scope: 'document' })

// 300ms debounce → PUT /api/canvas
function onStoreChange() {
  debounce(async () => {
    const snapshot = editor.store.getStoreSnapshot()
    await fetch('/api/canvas', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot)
    })
  }, 300)
}

// 3. SSE 监听：其他来源的变更（MCP 插入图片）
const eventSource = new EventSource('/api/canvas-events')
eventSource.addEventListener('canvas-changed', (event) => {
  const data = JSON.parse(event.data)
  // 重新从后端加载快照并合并
  refreshCanvasFromServer()
})

// 4. 选区持久化：用于 MCP 工具读取
editor.store.listen(onSelectionChange, { source: 'user', scope: 'session' })

// 5. 自定义工具注册
// AI图片占位框：基于 tldraw frame shape，带 meta.kaiAiImageHolder = true
// 标注工具：基于 tldraw arrow shape，带 meta.kaiAnnotationArrow = true
```

**与参考项目的差异**:

| 方面 | Cowart (参考) | 本方案 |
|---|---|---|
| 语言 | JSX (无 TypeScript) | TSX (TypeScript) |
| 同步策略 | store.listen + debounce | 相同，但用 TypeScript 强类型 |
| SSE | 有 | 有，相同设计 |
| 自定义工具 | 直接在 App.jsx 内联 | 拆分为独立组件模块 |
| 状态管理 | 全部在 App.jsx | 拆分到 hooks/ 目录 |

### 4.2 后端 — Vite Middleware (REST API + SSE)

**技术栈**: Vite `configureServer` middleware (原生 Node.js http)

**REST API 规范**:

| 端点 | 方法 | 说明 |
|---|---|---|
| `GET /api/canvas` | GET | 加载全量画布快照（合并所有 page） |
| `PUT /api/canvas` | PUT | 保存全量快照（按 page 拆分写入） |
| `GET /api/selection` | GET | 读取当前选区状态 |
| `PUT /api/selection` | PUT | 保存选区状态 |
| `GET /api/view-state` | GET | 读取视口状态 |
| `PUT /api/view-state` | PUT | 保存视口状态 |
| `GET /api/canvas-events` | GET (SSE) | 画布变更事件流 |
| `GET /assets/*` | GET | 全局静态图片资源 |
| `GET /page-assets/*` | GET | 页面级图片资源 |

**文件存储布局**:

```
<project-dir>/canvas/
├── pages/
│   ├── manifest.json                    # 页面清单
│   ├── <page-id-encoded>/
│   │   ├── canvas.json                  # 该页面的 tldraw 快照
│   │   └── assets/                      # 该页面的图片资源
│   │       ├── screenshot-001.png
│   │       └── generated-002.jpg
│   └── <page-id-encoded>/
│       ├── canvas.json
│       └── assets/
├── canvas-selection.json                # 选区状态
└── canvas-view-state.json               # 视口状态
```

**存储逻辑**:

```typescript
// server/storage.ts 核心逻辑

// 保存：按 page 拆分
async function saveCanvasSnapshot(snapshot: TldrawSnapshot): Promise<SaveResult> {
  const pages = getPageRecords(snapshot)
  if (pages.length === 0) {
    // 兼容旧格式：单文件
    await writeJsonAtomic(canvasFile, snapshot)
    return { storage: 'legacy-single-file' }
  }

  // 清理已删除页面的目录
  await removeStalePageDirs(pages.map(p => p.id))

  // 按 page 拆分保存
  for (const page of pages) {
    const pageSnapshot = extractPageSnapshot(snapshot, page.id)
    // 将 data: URL 和外部资源本地化到页面 assets 目录
    const localized = await localizeAssets(pageSnapshot, page.id)
    await writeJsonAtomic(pageFilePath(page.id), localized)
  }

  // 更新页面清单
  await writeJsonAtomic(manifestFile, buildManifest(pages))
  return { storage: 'per-page' }
}

// 加载：合并所有 page
async function loadCanvasSnapshot(): Promise<LoadResult> {
  const pageSnapshots = await readAllPageSnapshots()
  if (pageSnapshots.length === 0) {
    // 尝试 legacy 单文件
    return tryReadLegacyFile()
  }

  // 合并所有 page 的 store
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

**资源本地化**:

当用户粘贴图片或上传 data: URL 时，后端自动将资源复制到页面级 assets 目录：

```
data:image/png;base64,iVBOR... → pages/<page-id>/assets/image-001.png
/assets/old-location/file.png   → pages/<page-id>/assets/file.png (copy)
```

URL 替换为 `/page-assets/<page-id>/<filename>`，确保资源跟随页面。

**安全防护**:
- `isSafeChildPath()`: 防止路径遍历攻击（`../` 检测）
- 请求体大小限制：50MB
- 原子写入：`tempfile + rename` 避免写一半崩溃

### 4.3 MCP Server

**协议**: JSON-RPC 2.0 over stdio

**工具定义**:

#### Tool 1: `kai_canvas_get_selection`

```json
{
  "name": "kai_canvas_get_selection",
  "description": "读取画布当前选中的形状列表，包括形状类型、尺寸、位置和关联的图片资源信息",
  "inputSchema": {
    "type": "object",
    "properties": {
      "projectDir": {
        "type": "string",
        "description": "用户项目绝对路径。工具读取 <projectDir>/canvas/canvas-selection.json"
      },
      "canvasDir": {
        "type": "string",
        "description": "画布目录绝对路径（覆盖 projectDir）"
      }
    },
    "additionalProperties": false
  },
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

#### Tool 2: `kai_canvas_insert_image`

```json
{
  "name": "kai_canvas_insert_image",
  "description": "将本地图片文件复制到画布页面的 assets 目录，创建 tldraw 图片资源记录和图片形状，放到锚点旁边或空白区域，通过画布 API 保存",
  "inputSchema": {
    "type": "object",
    "properties": {
      "imagePath": { "type": "string", "description": "本地图片文件绝对路径（必填）" },
      "projectDir": { "type": "string", "description": "用户项目绝对路径" },
      "canvasUrl": { "type": "string", "description": "画布服务地址，默认 http://127.0.0.1:43217" },
      "anchorShapeId": { "type": "string", "description": "放置参照的形状ID（原图或占位框）" },
      "placement": { "type": "string", "enum": ["right", "left", "below"], "description": "相对锚点的放置方向" },
      "margin": { "type": "number", "description": "与周围形状的间距（画布单位），默认40" },
      "matchAnchor": { "type": "boolean", "description": "是否匹配锚点尺寸，默认true" },
      "displayWidth": { "type": "number", "description": "显示宽度（画布单位）" },
      "displayHeight": { "type": "number", "description": "显示高度（画布单位）" },
      "fileName": { "type": "string", "description": "目标文件名" },
      "shapeMeta": { "type": "object", "description": "额外的形状元数据" },
      "dryRun": { "type": "boolean", "description": "仅计算不实际写入" }
    },
    "required": ["imagePath"],
    "additionalProperties": false
  },
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": false
  }
}
```

**插入图片流程**:

```
1. 解析 imagePath → 读取图片二进制 → 提取像素尺寸
2. 加载画布快照 (GET canvasUrl/api/canvas)
3. 读取选区状态 (canvas-selection.json)
4. 确定目标页面 pageId
   ├─ 优先：anchorShapeId 所属页面
   ├─ 其次：view-state 中的 currentPageId
   └─ 兜底：store 中第一个 page record
5. 确定 parentId（锚点的父节点或 pageId）
6. 计算显示尺寸
   ├─ matchAnchor=true 且有锚点 → 用锚点尺寸
   └─ 否则 → min(原图宽, 512) × 等比缩放高
7. 计算放置位置
   ├─ 有锚点 → 锚点右侧 margin 处
   ├─ 检查与现有形状重叠 → 逐步右移避让
   └─ 无锚点 → 页面左上角 (0,0)
8. 复制图片文件 → pages/<page-id>/assets/<filename>
9. 创建 tldraw asset record + shape record
10. PUT canvasUrl/api/canvas 保存
11. 返回 shapeId, assetId, bounds, assetUrl
```

**图片尺寸读取**（无外部依赖）:

```javascript
// 直接读二进制头，不需要 sharp/jimp 等库
async function getImageDimensions(filePath) {
  const buffer = await readFile(filePath)

  // PNG: 字节 [16..20] = width, [20..24] = height (big-endian)
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  // JPEG: 扫描 SOF marker
  if (buffer.length >= 10 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    // 遍历 markers 找到 SOF0-SOF3
    let offset = 2
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const size = buffer.readUInt16BE(offset + 2)
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
      }
      offset += 2 + size
    }
  }

  // WebP: 读 VP8X chunk header
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP' &&
      buffer.toString('ascii', 12, 16) === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
  }

  throw new Error('Unsupported image format. Use PNG, JPEG, or WebP.')
}
```

### 4.4 xiaok Skill

合并为单个 SKILL.md，而非 3 个分散技能。用清晰的触发描述覆盖三种场景。

```yaml
---
name: canvas-planner
description: >
  打开和管理 kai-canvas 本地无限画布。当用户想打开画布、在画布上生成图片、
  根据标注截图生成修订图时使用。触发词：画布、canvas、打开画布、
  生成图片到画布、标注改图、annotation edit、infinite canvas、
  whiteboard、白板、tldraw。
---
```

Skill 内容包含三个工作流：
1. **打开画布** — 启动 canvas server + 打开浏览器
2. **生成图片到画布** — 读取选区 → 生成图片 → MCP 插入
3. **标注截图改图** — 读取截图 → 提取标注 → 生成新图 → MCP 插入到原图旁边

### 4.5 plugin.json

```json
{
  "name": "kai-canvas-creator",
  "version": "0.1.0",
  "interface": {
    "display_name": "无限画布",
    "short_description": "tldraw 驱动的本地无限画布，支持构思、标注、图片生成",
    "category": "visual-collaboration",
    "capabilities": ["infinite-canvas", "image-generation", "annotation-editing", "project-local-persistence"],
    "keywords": ["canvas", "tldraw", "whiteboard", "画布", "白板", "标注"]
  },
  "skills": ["skills/canvas-planner"],
  "mcpServers": [
    {
      "name": "canvas-server",
      "type": "stdio",
      "command": "node",
      "args": ["mcp-servers/canvas-server/server.mjs"]
    }
  ],
  "hooks": [
    {
      "type": "prompt",
      "events": ["UserPromptSubmit"],
      "matcher": "install.*plugin|plugin.*install|安装.*插件|安装插件",
      "prompt": "The user wants to install a plugin. Run `xiaok plugin install kai-canvas-creator` to install this canvas plugin."
    }
  ],
  "commands": [],
  "agents": []
}
```

## 五、实现步骤（按优先级排序）

### Phase 1: 基础画布（MVP）— 可独立验证

| 步骤 | 文件 | 说明 | 验证标准 |
|---|---|---|---|
| 1 | `package.json` | 初始化依赖：react, react-dom, tldraw, vite, @vitejs/plugin-react, fractional-indexing | `npm install` 成功 |
| 2 | `index.html` + `src/main.tsx` | SPA 入口 | `npm run dev` 能打开空白页面 |
| 3 | `src/App.tsx` | 集成 tldraw `<Tldraw>` 组件，渲染画布 | 画布可交互 |
| 4 | `vite.config.ts` | 配置 Vite middleware，实现 REST API | `curl /api/canvas` 返回空快照 |
| 5 | `server/storage.ts` | 实现文件持久化（per-page 存储逻辑） | 画布数据写入 `canvas/pages/` |
| 6 | `src/hooks/useCanvasSync.ts` | 画布变更 debounce 同步到后端 | 修改画布 → 文件系统更新 |
| 7 | `src/hooks/useSelectionSync.ts` | 选区持久化 | `curl /api/selection` 返回选中形状 |
| 8 | `src/hooks/useViewStateSync.ts` | 视口持久化 | 刷新页面后视口位置恢复 |

### Phase 2: MCP 工具 + 图片插入

| 步骤 | 文件 | 说明 | 验证标准 |
|---|---|---|---|
| 9 | `mcp-servers/canvas-server/server.mjs` | JSON-RPC 框架：initialize, tools/list, tools/call | MCP 能响应 initialize |
| 10 | `mcp-servers/canvas-server/tools/get-selection.mjs` | 读取选区工具 | 返回选中的形状列表 |
| 11 | `mcp-servers/canvas-server/lib/image-utils.mjs` | PNG/JPEG/WebP 尺寸读取 | 正确读取三种格式 |
| 12 | `mcp-servers/canvas-server/lib/placement.mjs` | 防重叠布局算法 | 新图不覆盖现有内容 |
| 13 | `mcp-servers/canvas-server/tools/insert-image.mjs` | 插入图片工具 | 图片出现在画布上 |

### Phase 3: 自定义工具 + SSE

| 步骤 | 文件 | 说明 | 验证标准 |
|---|---|---|---|
| 14 | `server/events.ts` | SSE 事件广播 | PUT canvas 后 SSE 推送 |
| 15 | `src/hooks/useCanvasSync.ts` 扩展 | SSE 监听远程变更 | MCP 插入图片后前端自动刷新 |
| 16 | `src/shapes/AiImageHolderTool.tsx` | AI图片占位框（tldraw frame + meta） | 工具栏出现占位框按钮 |
| 17 | `src/shapes/AnnotationTool.tsx` | 标注箭头工具 | 工具栏出现标注按钮 |
| 18 | `server/assets.ts` | 图片资源本地化 | data:URL 自动落地为文件 |

### Phase 4: xiaok 集成 + 打包

| 步骤 | 文件 | 说明 | 验证标准 |
|---|---|---|---|
| 19 | `plugin.json` | xiaok 插件清单 | `xiaok plugin list` 可见 |
| 20 | `skills/canvas-planner/SKILL.md` | xiaok skill | xiaok 能触发 skill |
| 21 | `scripts/start-canvas.sh` | 启动脚本 | 能指定项目目录启动 |
| 22 | `registry.json` 更新 | 注册到 kai-xiaok-plugins | 插件可安装 |
| 23 | `tests/` | 单元测试 | 全部通过 |

## 六、关键技术决策

### 6.1 为什么用 Vite middleware 而不是独立 Express 服务

| 方案 | 优点 | 缺点 |
|---|---|---|
| ✅ Vite middleware | 零额外依赖；dev 模式自动热更新；前后端同进程 | 仅在 Vite 上下文可用 |
| ❌ 独立 Express | 可独立部署 | 额外依赖；需处理 CORS；热更新复杂 |

选择 Vite middleware 因为：
- 画布是本地开发工具，不需要生产级部署
- Vite dev server 已经是 HTTP 服务器，middleware 零成本扩展
- 前端和后端共享同一个 Node 进程，无需 CORS
- 参考项目也用了同样的方案，验证了可行性

### 6.2 为什么用 TypeScript 而不是 JSX

参考项目用纯 JSX，本方案改用 TypeScript：
- tldraw 5 本身有完整的 TypeScript 类型定义
- Vite middleware 和 REST API 有明确的数据结构，值得类型化
- kai-xiaok-plugins 现有的 report-renderer 也用了 TypeScript

### 6.3 tldraw 许可证

tldraw 采用 **cascading license** 模型：
- 开源项目（GPL-2.0 或兼容）：免费使用
- 闭源/商业项目：需要购买 tldraw commercial license

由于 kai-xiaok-plugins 是 **Apache-2.0 开源项目**，可以使用 tldraw 的开源许可。但需注意：
- 如果未来转为闭源，需要购买商业许可
- 或者改用其他 Apache-2.0/MIT 许可的画布库（如 Excalidraw 的 excalidraw npm 包是 MIT）

### 6.4 依赖最小化

| 依赖 | 用途 | 必要性 |
|---|---|---|
| `tldraw` | 画布核心 | 必须 |
| `react` / `react-dom` | tldraw 依赖 | 必须 |
| `vite` + `@vitejs/plugin-react` | 构建 + dev server | 必须 |
| `fractional-indexing` | tldraw record 排序 | MCP server 需要 |
| ❌ `express` | — | 不需要，Vite middleware 够用 |
| ❌ `sharp` / `jimp` | 图片处理 | 不需要，直接读二进制头 |
| ❌ `chokidar` | 文件监听 | 不需要，SSE 主动推送 |

## 七、REST API 详细规范

### GET /api/canvas

**响应**:
```json
{
  "snapshot": {
    "schema": { ... },
    "store": {
      "page:abc123": { "typeName": "page", "id": "page:abc123", ... },
      "shape:def456": { "typeName": "shape", "type": "rectangle", ... },
      "asset:img001": { "typeName": "asset", "type": "image", ... }
    }
  },
  "path": "/path/to/canvas/pages",
  "storage": "per-page"
}
```

**错误**:
- `500`: `{ "error": "Failed to read canvas" }`

### PUT /api/canvas

**请求体**: 完整的 tldraw store snapshot

```json
{
  "schema": { ... },
  "store": { ... }
}
```

**响应**:
```json
{
  "ok": true,
  "storage": "per-page",
  "paths": ["/path/to/canvas/pages/abc/canvas.json"]
}
```

### GET /api/selection

**响应**:
```json
{
  "selection": {
    "selectedShapes": [
      {
        "id": "shape:def456",
        "type": "frame",
        "x": 100, "y": 200,
        "props": { "w": 320, "h": 220, "name": "AI 图片" },
        "meta": { "kaiAiImageHolder": true }
      }
    ],
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "path": "/path/to/canvas/canvas-selection.json"
}
```

### GET /api/canvas-events (SSE)

```
event: canvas-changed
id: 42
data: {"version":42,"updatedAt":"2025-01-15T10:30:01.000Z","storage":"per-page"}

: heartbeat 1737000001000
```

### 静态资源路由

```
GET /page-assets/<encoded-page-id>/<filename>
→ 读取 canvas/pages/<encoded-page-id>/assets/<filename>

GET /assets/<filename>
→ 读取 canvas/assets/<filename> (legacy)
```

## 八、与参考项目的差异清单

| 维度 | Cowart (参考) | kai-canvas-creator (本方案) |
|---|---|---|
| 插件格式 | Codex `.codex-plugin/plugin.json` | xiaok `plugin.json` |
| 技能格式 | Codex SKILL.md（3个独立技能） | xiaok SKILL.md（1个统一技能） |
| MCP 配置 | `.mcp.json` | plugin.json `mcpServers` 字段 |
| 工具命名 | `get_cowart_selection` / `insert_cowart_image` | `kai_canvas_get_selection` / `kai_canvas_insert_image` |
| 元数据前缀 | `cowart*` (cowartAiImageHolder 等) | `kai*` (kaiAiImageHolder 等) |
| 环境变量 | `COWART_*` | `KAI_CANVAS_*` |
| 文件前缀 | `cowart-*.json` | `canvas-*.json` |
| 语言 | JavaScript (JSX) | TypeScript (TSX) |
| 代码组织 | 单文件 App.jsx (700行) | 模块化拆分 (hooks/ shapes/ server/) |
| 端口 | 43217 | 43217 (保持一致) |
| 协议 | 无 LICENSE | Apache-2.0 |

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| tldraw 版本升级 breaking change | 中 | 中 | 锁定 tldraw minor 版本；CI 测试 |
| xiaok 插件格式变更 | 低 | 高 | 跟踪 kai-xiaok-plugins plugin.json schema |
| SSE 在 WebView 中不工作 | 低 | 高 | 降级为 polling 兜底 |
| 大量图片导致画布卡顿 | 中 | 中 | 图片资源走文件系统而非 base64 内嵌 |
| 多页面文件竞争写入 | 低 | 中 | 原子写入 (tempfile + rename) |

## 十、验收标准

### 功能验收

- [ ] `npm run dev` 启动后，浏览器打开 `http://127.0.0.1:43217` 显示画布
- [ ] 在画布上画矩形/文本/箭头，刷新页面后内容仍在
- [ ] 画布数据写入 `<project>/canvas/pages/<page-id>/canvas.json`
- [ ] 图片资源写入 `<project>/canvas/pages/<page-id>/assets/`
- [ ] `curl http://127.0.0.1:43217/api/selection` 返回当前选中形状
- [ ] MCP `kai_canvas_insert_image` 能将本地图片插入画布
- [ ] 插入的图片出现在画布上且不覆盖现有内容
- [ ] SSE 事件在前端收到后自动刷新画布
- [ ] AI 图片占位框工具可在工具栏使用
- [ ] 标注箭头工具可在工具栏使用
- [ ] xiaok skill 能被正确触发

### 集成验收

- [ ] `xiaok plugin install kai-canvas-creator` 安装成功
- [ ] 在 xiaok 对话中说"打开画布"能启动服务并打开浏览器
- [ ] 在 xiaok 对话中说"生成图片到选中的占位框"能触发完整流程
- [ ] 画布在 xiaok WebView 中正常渲染

### 代码质量

- [ ] TypeScript 编译无错误
- [ ] `npm run build` 产出 dist/ 目录
- [ ] 单元测试覆盖 MCP 工具和存储逻辑
- [ ] 无未使用依赖
