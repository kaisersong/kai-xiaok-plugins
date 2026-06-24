# kai-canvas-creator 实现方案 v2（对抗评审修订版）

> 基于 Excalidraw（MIT 许可）自研的 xiaok 无限画布插件。
> 本版方案经过 Codex / CC / Qoder / xiaok 四方对抗性评审后修订。

## 评审变更摘要

| 问题 | 严重度 | v1 状态 | v2 修复 |
|---|---|---|---|
| tldraw 许可证与 Apache-2.0 不兼容 | 🔴 严重 | 错误描述为兼容 | 改用 Excalidraw（MIT） |
| Vite middleware 生产构建后失效 | 🔴 严重 | 完全遗漏 | 独立 HTTP server，Vite 仅负责前端 |
| MCP 硬依赖 canvas server 运行 | 🔴 严重 | 无降级 | MCP 直接读写文件，HTTP 可选 |
| 图片生成能力假设未验证 | 🔴 严重 | 假设存在 | Phase 1 不含 AI 生成，Phase 2 条件性补上 |
| 进程生命周期/僵尸进程 | 🔴 严重 | 完全遗漏 | PID 文件 + 健康检查 + 自动清理 |
| 多项目切换数据错乱 | 🔴 严重 | 完全遗漏 | MCP 直读文件系统，server 无状态 |
| 安装/构建流程缺失 | 🔴 严重 | 遗漏 | plugin.json + registry.json 完整声明 |
| 代码是"换皮"非真正改进 | 🟡 中 | 确实如此 | 架构重构为独立 server + 离线 MCP |
| 前端 600+ 行复杂度未评估 | 🟡 中 | 严重低估 | 明确复杂度评估和实现策略 |
| 跨平台只有 bash | 🟡 中 | 仅 .sh | 改用 Node.js 脚本 |
| toolPermissions 缺失 | 🟡 中 | 遗漏 | 已补充 |
| SKILL 路由冲突 | 🟡 中 | 触发词太泛 | 精确化触发条件 |
| 端口冲突 | 🟡 中 | 写死 | 自动回退 |
| 缺少 health check | 🟢 低 | 遗漏 | GET /api/health |

---

## 一、项目定位

为 xiaok Desktop 提供本地无限画布能力：构思、标注、手动图片上传，以及（未来）AI 图片生成与标注驱动的图片迭代。

**v2 核心变化**：
- 画布库从 tldraw 改为 **Excalidraw**（MIT 许可，无 copyleft 限制）
- 图片生成功能从 Phase 1 移至 Phase 2（条件性：确认 xiaok 有图片生成能力后）
- 后端从 Vite middleware 改为**独立 Node.js HTTP server**
- MCP server 支持**离线文件操作**，不硬依赖 HTTP server

| 属性 | 值 |
|---|---|
| 插件名 | `kai-canvas-creator` |
| 类别 | `visual-collaboration` |
| 运行时 | Node.js 18+ |
| 前端框架 | React 19 + Excalidraw |
| 构建工具 | Vite 7（仅前端打包） |
| 后端服务 | 独立 Node.js HTTP server（不依赖 Vite） |
| MCP 协议 | JSON-RPC 2.0 over stdio |
| 数据存储 | 用户项目 `<project>/canvas/` 目录 |
| 默认端口 | 43217（可自动回退） |

## 二、许可证决策（v2 关键变更）

### 为什么放弃 tldraw

tldraw 使用 **cascading license**（非标准 GPL-2.0）：
- 开源项目要求以 **GPL-2.0 兼容许可证**发布衍生代码
- **Apache-2.0 与 GPL-2.0 不兼容**（专利条款冲突）
- kai-xiaok-plugins 整体是 Apache-2.0，混入 GPL-2.0 copyleft 代码会导致许可证冲突

### 为什么选 Excalidraw

| 维度 | tldraw | Excalidraw |
|---|---|---|
| 许可证 | cascading（GPL-2.0 兼容） | **MIT**（完全自由） |
| 包大小 | ~1.2MB minified | ~800KB minified |
| React 集成 | 原生 React 组件 | 原生 React 组件 |
| 无限画布 | ✅ | ✅ |
| 手绘风格 | ❌（几何精确） | ✅（默认手绘，可关闭） |
| 图片形状 | ✅ | ✅ |
| 箭头/标注 | ✅ | ✅ |
| 导出 PNG/SVG | ✅ | ✅ |
| 自定义形状 | ✅（复杂） | ✅（相对简单） |
| 数据持久化 | store snapshot JSON | elements JSON（更简单） |

Excalidraw 的 MIT 许可与 Apache-2.0 完全兼容，无 copyleft 风险。数据格式更简单（elements 数组 vs tldraw 的 store snapshot），后端处理逻辑更轻量。

## 三、架构总览（v2 重构）

```
┌──────────────────────────────────────────────────────────────┐
│                       xiaok Desktop                          │
│                                                               │
│  ┌──────────┐                                                │
│  │ xiaok    │                                                │
│  │ Skill    │                                                │
│  │ (LLM)    │                                                │
│  └─────┬────┘                                                │
│        │                                                     │
│        ├──────────────────────┐                              │
│        ▼                      ▼                              │
│  ┌──────────┐          ┌──────────────┐                      │
│  │ canvas   │          │ canvas-http  │                      │
│  │ MCP      │          │ (独立 server) │                      │
│  │ (stdio)  │          │ :43217       │                      │
│  │          │          │              │                      │
│  │ 直读写   │          │ REST API     │                      │
│  │ 文件系统 │          │ SSE 推送     │                      │
│  │ (不依赖  │          │ 静态资源     │                      │
│  │  HTTP)   │          │ serve dist/  │                      │
│  └────┬─────┘          └──────┬───────┘                      │
│       │                       │                              │
│       │    read/write         │ read/write                   │
│       │         canvas/       │      canvas/                 │
│       │         ┌─────┐       │      ┌─────┐                 │
│       └────────▶│ FS  │◀──────┴──────│ FS  │                 │
│                  └─────┘              └─────┘                 │
│                                                          │    │
│  ┌──────────────────────────────────────────┐            │    │
│  │ Browser / WebView                        │            │    │
│  │ http://127.0.0.1:43217                  │            │    │
│  │ ┌──────────────────────────────────┐    │            │    │
│  │ │ Excalidraw Canvas (React SPA)    │    │            │    │
│  │ │ - 无限画布（手绘风格）            │    │            │    │
│  │ │ - 标注工具                       │    │            │    │
│  │ │ - 图片拖拽上传                   │    │            │    │
│  │ │ - PNG/SVG 导出                   │    │            │    │
│  │ └──────────────────────────────────┘    │            │    │
│  └──────────────────────────────────────────┘            │    │
└──────────────────────────────────────────────────────────────┘
```

### v2 关键架构变化

| 维度 | v1（参考 Cowart） | v2（评审后） |
|---|---|---|
| 后端服务 | Vite middleware（仅 dev 可用） | **独立 Node.js HTTP server** |
| MCP 数据路径 | MCP → HTTP → 文件 | **MCP → 文件（直读写）** |
| 画布库 | tldraw（GPL-2.0 兼容） | **Excalidraw（MIT）** |
| 数据格式 | tldraw store snapshot | **Excalidraw elements JSON** |
| 进程管理 | 无 | **PID 文件 + 健康检查 + 自动清理** |
| 多项目 | 单端口单项目 | **MCP 无状态，HTTP server 可复用** |

### 数据流

```
用户在画布操作
  ──▶ Excalidraw onChange
  ──▶ debounce 500ms
  ──▶ PUT /api/canvas (HTTP server)
  ──▶ 写入 canvas/elements.json

用户关闭浏览器
  ──▶ beforeunload 发送 POST /api/graceful-shutdown
  ──▶ HTTP server 退出（可选：30分钟无连接自动退出）

xiaok LLM 操作
  ──▶ MCP kai_canvas_insert_image
  ──▶ 直接读写 <projectDir>/canvas/ 文件系统
  ──▶ 如果 HTTP server 在运行 → POST /api/notify (触发 SSE)
  ──▶ 如果 HTTP server 未运行 → 静默写入文件（下次打开时加载）
```

## 四、目录结构（v2）

```
plugins/kai-canvas-creator/
├── plugin.json                          # xiaok 插件清单（含 toolPermissions）
├── README.md
├── package.json                         # 前端依赖
├── vite.config.ts                       # Vite 配置（仅前端构建，proxy 到 HTTP server）
├── tsconfig.json
├── index.html                           # SPA 入口
│
├── src/                                 # 前端源码（TypeScript）
│   ├── main.tsx                         # React 挂载
│   ├── App.tsx                          # 主组件：Excalidraw 集成
│   ├── styles.css
│   └── hooks/
│       ├── useCanvasSync.ts             # 画布数据同步 (REST + SSE + polling 降级)
│       └── useExport.ts                 # PNG/SVG 导出
│
├── server/                              # 独立 HTTP server（纯 JavaScript .mjs）
│   ├── index.mjs                        # HTTP server 入口（可独立运行）
│   ├── routes.mjs                       # REST API 路由
│   ├── storage.mjs                      # 文件持久化
│   ├── events.mjs                       # SSE 事件广播
│   ├── assets.mjs                       # 图片资源服务
│   └── lifecycle.mjs                    # 进程生命周期（PID, health, cleanup）
│
├── mcp-servers/
│   └── canvas-server/
│       ├── server.mjs                   # MCP JSON-RPC 入口
│       ├── tools/
│       │   ├── get-selection.mjs        # 读选区（直读文件）
│       │   └── insert-image.mjs         # 插入图片（直写文件，HTTP 可选通知）
│       └── lib/
│           ├── excalidraw-helpers.mjs   # elements JSON 操作
│           ├── image-utils.mjs          # 图片尺寸读取（独立实现）
│           └── placement.mjs            # 防重叠布局
│
├── scripts/
│   ├── start-canvas.mjs                 # 启动画布服务（Node.js 跨平台）
│   └── build.sh                         # 构建前端 dist（release 用）
│
├── skills/
│   ├── canvas-open/SKILL.md             # 打开画布 skill
│   ├── canvas-insert/SKILL.md           # 插入图片 skill
│   └── canvas-annotate/SKILL.md         # 标注+改图 skill（Phase 2 条件性）
│
├── evals/                               # 质量评估（参照 kai-report-creator）
│   └── cases/
│       └── basic-canvas.test.mjs
│
├── dist/                                # 构建产物（gitignore）
│
└── tests/
    ├── server.test.mjs
    └── mcp.test.mjs
```

### v2 结构变化

| 变化 | 原因 |
|---|---|
| `server/` 改为独立 `.mjs` 文件 | 生产环境可独立运行，不依赖 Vite dev |
| `scripts/` 用 `.mjs` 替代 `.sh` | 跨平台兼容（Windows 无 bash） |
| 3 个独立 SKILL.md（不合并） | 不同工作流有不同前置条件和路由精确度 |
| MCP server 改为直读写文件 | 不硬依赖 HTTP server 运行 |
| 新增 `evals/` | 参照 kai-report-creator 质量保证 |

## 五、核心组件设计

### 5.1 独立 HTTP Server（v2 新增，解决生产构建问题）

**文件**: `server/index.mjs`

**职责**:
- 提供 REST API（canvas CRUD、selection、view-state）
- 提供 SSE 事件推送
- 提供静态资源服务（dist/ 前端文件 + canvas/assets/ 图片）
- 进程生命周期管理（PID 文件、健康检查、优雅关闭）

**运行模式**:

```javascript
// server/index.mjs 核心逻辑

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { writePidFile, removePidFile, getRunningPid, isOurProcess } from './lifecycle.mjs'

const PORT = parseInt(process.env.KAI_CANVAS_PORT ?? '43217', 10)
const PROJECT_DIR = resolve(process.env.KAI_CANVAS_PROJECT_DIR ?? process.cwd())
const CANVAS_DIR = resolve(PROJECT_DIR, 'canvas')
const STATIC_DIR = resolve(process.env.KAI_CANVAS_STATIC_DIR ?? join(import.meta.dirname, '..', 'dist'))

// 1. 检查是否已有实例运行
const existingPid = await getRunningPid(PORT)
if (existingPid && await isOurProcess(existingPid, PROJECT_DIR)) {
  console.log(`Canvas server already running (pid=${existingPid}), same project. Reusing.`)
  process.exit(0)
}
if (existingPid && !(await isOurProcess(existingPid, PROJECT_DIR))) {
  // 不同项目的实例，自动选择新端口
  PORT = await findAvailablePort(PORT + 1)
}

// 2. 启动 HTTP server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  
  // REST API 路由
  if (url.pathname === '/api/health') return handleHealth(req, res, { PROJECT_DIR, CANVAS_DIR, PORT })
  if (url.pathname === '/api/canvas') return handleCanvas(req, res, CANVAS_DIR)
  if (url.pathname === '/api/selection') return handleSelection(req, res, CANVAS_DIR)
  if (url.pathname === '/api/canvas-events') return handleSSE(req, res, CANVAS_DIR)
  if (url.pathname.startsWith('/page-assets/')) return handlePageAsset(req, res, CANVAS_DIR)
  
  // 静态文件服务（dist/）
  return serveStatic(req, res, STATIC_DIR, url)
})

// 3. 端口绑定 + PID 文件
server.listen(PORT, '127.0.0.1', async () => {
  await writePidFile(PORT, process.pid, PROJECT_DIR)
  console.log(`Canvas server: http://127.0.0.1:${PORT}`)
  console.log(`Canvas data: ${CANVAS_DIR}`)
})

// 4. 优雅关闭
process.on('SIGTERM', async () => { await removePidFile(PORT); server.close(); process.exit(0) })
process.on('SIGINT', async () => { await removePidFile(PORT); server.close(); process.exit(0) })

// 5. 无连接超时自动退出（30分钟）
let lastActivity = Date.now()
server.on('request', () => { lastActivity = Date.now() })
setInterval(() => {
  if (Date.now() - lastActivity > 30 * 60 * 1000) {
    console.log('Canvas server idle for 30min, shutting down.')
    process.emit('SIGTERM')
  }
}, 60 * 1000)
```

### 5.2 进程生命周期管理（v2 新增）

**文件**: `server/lifecycle.mjs`

**解决的问题**: 僵尸进程、端口冲突、多项目混淆

```javascript
// PID 文件存储在系统临时目录
// /tmp/kai-canvas-<port>.pid
// 内容: { pid, projectDir, startedAt }

import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function pidFilePath(port) {
  return join(tmpdir(), `kai-canvas-${port}.pid`)
}

export async function writePidFile(port, pid, projectDir) {
  const content = JSON.stringify({ pid, projectDir, startedAt: new Date().toISOString() })
  await writeFile(pidFilePath(port), content, 'utf8')
}

export async function getRunningPid(port) {
  try {
    const content = await readFile(pidFilePath(port), 'utf8')
    const { pid } = JSON.parse(content)
    // 检查进程是否存活
    try { process.kill(pid, 0) } catch { return null } // 进程已退出
    return pid
  } catch { return null }
}

export async function isOurProcess(pid, projectDir) {
  try {
    // 扫描可能的端口找到匹配的 PID 文件
    for (let port = 43217; port < 43227; port++) {
      try {
        const content = await readFile(pidFilePath(port), 'utf8')
        const info = JSON.parse(content)
        if (info.pid === pid && info.projectDir === projectDir) return true
      } catch {}
    }
    return false
  } catch { return false }
}

export async function findAvailablePort(startPort) {
  let port = startPort
  const net = await import('node:net')
  while (port < startPort + 10) {
    const available = await new Promise(resolve => {
      const tester = net.createServer()
      tester.listen(port, '127.0.0.1', () => { tester.close(() => resolve(true)) })
      tester.on('error', () => resolve(false))
    })
    if (available) return port
    port++
  }
  throw new Error(`No available port in range ${startPort}-${startPort + 9}`)
}
```

### 5.3 前端 — Excalidraw 画布

**技术栈**: React 19 + Excalidraw + Vite 7

**Excalidraw 集成**:

```typescript
// src/App.tsx 核心逻辑

import { Excalidraw, exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
import { useState, useEffect, useCallback, useRef } from 'react'

export default function App() {
  const [elements, setElements] = useState([])
  const [appState, setAppState] = useState({})
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  
  // 1. 初始化：从后端加载已有数据
  useEffect(() => {
    fetch('/api/canvas')
      .then(r => r.json())
      .then(({ elements, appState }) => {
        if (elements) setElements(elements)
        if (appState) setAppState(appState)
      })
      .catch(() => {}) // 首次打开时无数据
  }, [])

  // 2. 变更监听：debounce 同步到后端
  const handleChange = useCallback((newElements, newAppState) => {
    setElements(newElements)
    setAppState(newAppState)
    
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch('/api/canvas', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ elements: newElements, appState: newAppState })
      })
    }, 500)
  }, [])

  // 3. SSE 监听：其他来源的变更（MCP 插入图片）
  useEffect(() => {
    let eventSource: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    
    function connectSSE() {
      eventSource = new EventSource('/api/canvas-events')
      eventSource.addEventListener('canvas-changed', () => refreshFromServer())
      eventSource.onerror = () => {
        // SSE 降级为 polling
        eventSource?.close()
        eventSource = null
        pollTimer = setInterval(refreshFromServer, 3000)
      }
    }
    
    async function refreshFromServer() {
      const res = await fetch('/api/canvas')
      const { elements: serverElements } = await res.json()
      if (serverElements) setElements(serverElements)
    }
    
    connectSSE()
    return () => { eventSource?.close(); clearInterval(pollTimer!) }
  }, [])

  return (
    <div className="canvas-container">
      <Excalidraw
        initialData={{ elements, appState }}
        onChange={handleChange}
      />
    </div>
  )
}
```

**Excalidraw vs tldraw 前端复杂度对比**:

| 关注点 | tldraw 需要的代码 | Excalidraw 需要的代码 |
|---|---|---|
| 画布渲染 | `<Tldraw />` 组件 | `<Excalidraw onChange={} />` |
| 数据持久化 | store snapshot + mergeRemoteChanges + migration | elements 数组直接 PUT |
| 远程变更合并 | storeChangedSinceSnapshot + applyRemoteCanvasSnapshot | 直接 setElements（最后写入胜） |
| 选区持久化 | editor.store.listen + 自定义序列化 | Excalidraw appState.selectedElementIds |
| 自定义工具 | StateNode 子类 + UI 组件 | Excalidraw custom tools API |
| 保存队列 | isSaving + hasPendingSave + AbortController | 简单 debounce |

**关键改进**: Excalidraw 的数据模型（elements 数组）比 tldraw 的 store snapshot（嵌套对象 + schema 版本 + migration）**简单得多**，前端代码量预计减少 60% 以上。

### 5.4 MCP Server（v2 重构 — 离线优先）

**核心变化**: MCP 工具**直接读写文件系统**，不通过 HTTP API。HTTP server 仅用于前端渲染。

#### Tool 1: `kai_canvas_get_selection`

```json
{
  "name": "kai_canvas_get_selection",
  "description": "读取画布当前选中的元素列表",
  "inputSchema": {
    "type": "object",
    "properties": {
      "projectDir": { "type": "string", "description": "用户项目绝对路径" },
      "canvasDir": { "type": "string", "description": "画布目录绝对路径（覆盖 projectDir）" }
    }
  },
  "annotations": { "readOnlyHint": true, "idempotentHint": true }
}
```

**实现**：直接读取 `<canvasDir>/selection.json`，不依赖 HTTP server。

#### Tool 2: `kai_canvas_insert_image`

```json
{
  "name": "kai_canvas_insert_image",
  "description": "将本地图片插入画布",
  "inputSchema": {
    "type": "object",
    "properties": {
      "imagePath": { "type": "string", "description": "本地图片绝对路径（必填）" },
      "projectDir": { "type": "string", "description": "用户项目绝对路径" },
      "anchorElementId": { "type": "string", "description": "参照元素ID" },
      "placement": { "type": "string", "enum": ["right", "left", "below"] },
      "margin": { "type": "number" },
      "displayWidth": { "type": "number" },
      "displayHeight": { "type": "number" },
      "canvasUrl": { "type": "string", "description": "画布服务地址（可选，用于触发 SSE 通知）" }
    },
    "required": ["imagePath"]
  },
  "annotations": { "readOnlyHint": false, "destructiveHint": false }
}
```

**实现流程**（离线优先）:

```
1. 解析 canvasDir → 读取 elements.json
2. 解析 imagePath → 读取图片 → 提取尺寸
3. 复制图片到 <canvasDir>/assets/<filename>
4. 计算 Excalidraw element（type: image, x, y, width, height, fileId, status: saved）
5. 将新 element 追加到 elements 数组
6. 写回 elements.json（原子写入：tempfile + rename）
7. 如果 canvasUrl 可达 → POST /api/notify 触发 SSE 刷新
8. 如果 canvasUrl 不可达 → 静默完成（下次打开画布时自动加载）
```

**图片尺寸读取**（独立实现，不复用参考代码）:

```javascript
// mcp-servers/canvas-server/lib/image-utils.mjs
// 使用 file-type npm 包检测格式 + Buffer 操作读取尺寸
// 这是有意的独立实现，避免与参考项目的逐字重复

import { fileTypeFromBuffer } from 'file-type'

export async function getImageDimensions(filePath) {
  const buffer = await readFile(filePath)
  const type = await fileTypeFromBuffer(buffer)
  
  if (!type) throw new Error('Unknown image format')
  
  switch (type.mime) {
    case 'image/png':
      return readPngDimensions(buffer)
    case 'image/jpeg':
      return readJpegDimensions(buffer)
    case 'image/webp':
      return readWebpDimensions(buffer)
    case 'image/gif':
      return readGifDimensions(buffer)
    default:
      throw new Error(`Unsupported format: ${type.mime}`)
  }
}
// 各 read*Dimensions 函数独立实现，算法路径不同于参考项目
```

### 5.5 xiaok Skills（v2 保持 3 个独立 skill）

评审中 CC 和 Qoder 一致认为 3 个独立 skill 路由更精确。保持 3 个但不合并。

#### Skill 1: `canvas-open`

```yaml
---
name: canvas-open
description: >
  打开本地无限画布。触发词：打开画布、open canvas、infinite canvas、
  手绘画布、sketch canvas。不用于：幻灯片/演示（用 slide-planner）、
  报告/看板（用 report-creator）。
---
```

#### Skill 2: `canvas-insert`

```yaml
---
name: canvas-insert
description: >
  将本地图片文件插入到画布上。触发词：插入图片到画布、
  put image on canvas、add image to canvas。
  不用于：AI 生成图片（Phase 2 功能）。
---
```

#### Skill 3: `canvas-annotate`（Phase 2 条件性）

```yaml
---
name: canvas-annotate
description: >
  根据画布标注截图生成修订图。触发词：标注改图、annotation edit、
  revise from annotation。仅在有图片生成能力时可用。
---
```

### 5.6 plugin.json（v2 完整版）

```json
{
  "name": "kai-canvas-creator",
  "version": "0.1.0",
  "description": "Excalidraw-powered local infinite canvas for visual thinking",
  "platforms": ["darwin", "linux", "win32"],
  "interface": {
    "display_name": "无限画布",
    "short_description": "Excalidraw 驱动的本地无限画布",
    "category": "visual-collaboration",
    "capabilities": ["infinite-canvas", "image-upload", "annotation", "png-svg-export"],
    "keywords": ["canvas", "excalidraw", "whiteboard", "画布", "白板", "手绘"]
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
    "defaultMcpToolPermission": "write",
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

### 5.7 registry.json 条目（v2 新增）

```json
{
  "name": "kai-canvas-creator",
  "display_name": "无限画布",
  "description": "Excalidraw 驱动的本地无限画布，支持手绘、标注、图片插入",
  "category": "visual-collaboration",
  "keywords": ["canvas", "excalidraw", "whiteboard", "画布", "白板"],
  "repo": "kaisersong/kai-xiaok-plugins",
  "path": "plugins/kai-canvas-creator",
  "version": "0.1.0",
  "platforms": ["darwin", "linux", "win32"],
  "dependencies": {
    "runtime": "node",
    "install": "npm install && npm run build",
    "test": "node tests/mcp.test.mjs"
  }
}
```

## 六、用户旅程（v2 新增）

### 场景 1：打开画布

```
用户: "打开画布"
  │
  ├─▶ xiaok 触发 canvas-open skill
  │
  ├─▶ skill 执行: node scripts/start-canvas.mjs --project-dir $PROJECT_DIR
  │    ├─▶ 检查 PID 文件：同项目已有实例？→ 复用，直接打开浏览器
  │    ├─▶ 不同项目已有实例？→ 自动选择新端口
  │    ├─→ 无实例？→ 启动 HTTP server + PID 文件
  │    └─→ 端口被占？→ 自动 +1 回退
  │
  ├─▶ skill 输出: "画布已打开: http://127.0.0.1:43217"
  │
  └─▶ 用户在浏览器中看到 Excalidraw 画布

错误分支:
  ├─▶ node 未安装 → skill 提示安装 Node.js 18+
  ├─▶ npm install 失败 → skill 提示手动运行 npm install
  └─▶ 端口 43217-43226 全被占 → skill 提示释放端口
```

### 场景 2：插入图片到画布

```
用户: "把 /path/to/screenshot.png 放到画布上"
  │
  ├─▶ xiaok 触发 canvas-insert skill
  │
  ├─▶ skill 调用 MCP: kai_canvas_insert_image
  │    ├─→ 读取 <projectDir>/canvas/elements.json
  │    ├─→ 复制图片到 canvas/assets/
  │    ├─→ 创建 Excalidraw image element
  │    ├─→ 写回 elements.json（原子写入）
  │    └─→ 如果 HTTP server 在运行 → POST /api/notify
  │
  └─▶ 前端通过 SSE 自动刷新，图片出现在画布上

  如果 HTTP server 未运行:
  └─→ 静默完成，图片下次打开画布时可见
```

### 场景 3：关闭画布

```
用户关闭浏览器标签
  │
  ├─▶ beforeunload 触发 POST /api/graceful-shutdown（best-effort）
  │
  ├─→ 如果请求到达 → HTTP server 清理 PID 文件并退出
  │
  └─→ 如果请求未到达（浏览器崩溃） → 30分钟无连接后自动退出
```

## 七、实现步骤（v2 重新排序）

### Phase 0：前置验证

| 步骤 | 说明 | 验证标准 |
|---|---|---|
| 0.1 | 验证 Excalidraw npm 包在 Vite + React 19 下能正常工作 | demo 页面可渲染 |
| 0.2 | 验证 Excalidraw elements JSON 格式和 onChange 回调 | 控制台输出变更 |
| 0.3 | 确认 xiaok 是否有内置图片生成能力 | 有/无明确结论 |

### Phase 1：基础画布（MVP）— 纯画布 + 持久化 + 图片插入

| 步骤 | 文件 | 说明 |
|---|---|---|
| 1.1 | `package.json` | 依赖：@excalidraw/excalidraw, react, react-dom, vite, file-type |
| 1.2 | `index.html` + `src/main.tsx` | SPA 入口 |
| 1.3 | `src/App.tsx` | Excalidraw 集成 + onChange debounce 同步 |
| 1.4 | `server/index.mjs` | 独立 HTTP server：REST API + 静态资源 |
| 1.5 | `server/storage.mjs` | elements.json 持久化 + 原子写入 |
| 1.6 | `server/lifecycle.mjs` | PID 管理 + 健康检查 + 优雅关闭 |
| 1.7 | `server/events.mjs` | SSE 事件推送 |
| 1.8 | `src/hooks/useCanvasSync.ts` | 数据同步 + SSE + polling 降级 |
| 1.9 | `scripts/start-canvas.mjs` | 跨平台启动脚本 |
| 1.10 | `mcp-servers/canvas-server/server.mjs` | MCP JSON-RPC 框架 |
| 1.11 | `mcp-servers/canvas-server/tools/get-selection.mjs` | 读选区工具 |
| 1.12 | `mcp-servers/canvas-server/tools/insert-image.mjs` | 插入图片工具（离线优先） |
| 1.13 | `plugin.json` + `skills/canvas-open/SKILL.md` + `skills/canvas-insert/SKILL.md` | xiaok 集成 |
| 1.14 | `registry.json` 更新 | 注册到 kai-xiaok-plugins |
| 1.15 | `tests/` | 单元测试 |

### Phase 2：条件性功能（需验证图片生成能力后）

| 步骤 | 说明 | 前置条件 |
|---|---|---|
| 2.1 | AI 图片占位框工具 | Excalidraw custom tool API 验证 |
| 2.2 | 标注箭头工具 | 同上 |
| 2.3 | `canvas-annotate/SKILL.md` | xiaok 有图片生成能力 |
| 2.4 | 标注截图 → 修订图流程 | 同上 |

### Phase 3：打磨与发布

| 步骤 | 说明 |
|---|---|
| 3.1 | PNG/SVG 导出功能 |
| 3.2 | release workflow 预构建 dist/ |
| 3.3 | evals/ 质量评估用例 |
| 3.4 | README.md 完整文档 |

## 八、REST API 规范（v2 精简）

### GET /api/health

```json
{ "status": "ok", "canvasDir": "/path/to/canvas", "pid": 12345, "uptime": 3600 }
```

### GET /api/canvas

```json
{
  "elements": [ /* Excalidraw elements 数组 */ ],
  "appState": { /* Excalidraw appState */ },
  "files": { /* Excalidraw 二进制资源 (图片) */ }
}
```

### PUT /api/canvas

请求体同上格式。响应:
```json
{ "ok": true, "path": "/path/to/canvas/elements.json" }
```

### POST /api/notify

MCP 插入图片后触发 SSE 刷新：
```json
{ "ok": true }
```
→ 广播 SSE: `event: canvas-changed\ndata: {"source":"mcp"}\n\n`

### GET /api/canvas-events (SSE)

```
event: canvas-changed
data: {"source":"user","version":42}

: heartbeat 1737000001000
```

## 九、技术决策记录

### 9.1 为什么放弃 tldraw 改用 Excalidraw

| 因素 | tldraw | Excalidraw |
|---|---|---|
| 许可证 | cascading (GPL-2.0 兼容) ❌ | MIT ✅ |
| 与 Apache-2.0 兼容 | ❌ 不兼容 | ✅ 兼容 |
| 数据模型复杂度 | store snapshot (嵌套对象 + schema 迁移) | elements 数组 |
| 前端代码量预估 | ~1000 行 | ~300 行 |
| 手绘风格 | 无（几何精确） | 默认手绘（适合白板/构思） |

### 9.2 为什么 MCP 直读写文件而非经过 HTTP

| 方案 | 优点 | 缺点 |
|---|---|---|
| ✅ MCP → 文件（直读写） | 无外部依赖；多项目安全；离线可用 | 需处理并发（原子写入足够） |
| ❌ MCP → HTTP → 文件 | 统一数据路径 | HTTP server 必须运行；多项目数据错乱；单点故障 |

### 9.3 为什么用独立 HTTP server 而非 Vite middleware

| 方案 | dev 模式 | 生产模式 |
|---|---|---|
| ❌ Vite middleware | ✅ 可用 | ❌ build 后失效 |
| ✅ 独立 server | ✅ 可用 (proxy 到 Vite) | ✅ serve dist/ |

### 9.4 为什么用 .mjs 而非 TypeScript（server 端）

- MCP server 和 HTTP server 被 `node` 直接执行，不需要编译
- 参考 kai-report-creator 模式：MCP server 用纯 JS，renderer 用 TS
- 减少安装后的构建步骤

## 十、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Excalidraw React 19 兼容性 | 中 | 高 | Phase 0 先验证 |
| xiaok 无图片生成能力 | 高 | 中 | Phase 2 条件性，Phase 1 不依赖 |
| SSE 在 WebView 中不工作 | 低 | 中 | polling 降级（3秒间隔） |
| 端口冲突 | 中 | 低 | 自动回退 +1 |
| 僵尸进程 | 中 | 中 | PID 文件 + 30分钟超时 + beforeunload |
| 大量图片性能 | 中 | 中 | 图片走文件系统而非 base64 内嵌 |
| 多项目数据混淆 | 高 | 高 | MCP 直读写文件，HTTP server 无状态 |

## 十一、验收标准

### 功能验收

- [ ] `npm run build` 后 `node server/index.mjs` 能独立运行并提供完整 REST API
- [ ] 浏览器打开 `http://127.0.0.1:43217` 显示 Excalidraw 画布
- [ ] 画图后刷新页面，内容仍在
- [ ] 数据写入 `<project>/canvas/elements.json`
- [ ] 图片写入 `<project>/canvas/assets/`
- [ ] MCP `kai_canvas_insert_image` 不启动 HTTP server 也能工作
- [ ] 插入图片后如果 HTTP server 在运行，前端 SSE 自动刷新
- [ ] 健康检查 `GET /api/health` 返回正确信息
- [ ] 端口被占时自动回退
- [ ] 关闭浏览器 30 分钟后 server 自动退出
- [ ] `xiaok plugin install kai-canvas-creator` 自动 npm install + build
- [ ] Windows 上 `node scripts/start-canvas.mjs` 能运行

### 许可证验收

- [ ] package.json 中无 GPL/copyleft 依赖
- [ ] 所有依赖与 Apache-2.0 兼容
- [ ] Excalidraw 的 MIT 许可证声明保留

### 集成验收

- [ ] `xiaok plugin list` 显示 kai-canvas-creator
- [ ] 在 xiaok 中说"打开画布"能触发 canvas-open skill
- [ ] MCP 工具出现在 xiaok 工具列表中
- [ ] toolPermissions 正确生效

## 十二、与 v1 的差异汇总

| 维度 | v1 | v2 |
|---|---|---|
| 画布库 | tldraw（GPL 兼容性问题） | Excalidraw（MIT） |
| 后端 | Vite middleware（生产失效） | 独立 HTTP server |
| MCP 数据路径 | 依赖 HTTP server | 直读写文件（离线优先） |
| 进程管理 | 无 | PID + 健康检查 + 超时退出 |
| 多项目 | 数据混淆风险 | MCP 无状态，安全 |
| 图片生成 | Phase 1 假设存在 | Phase 2 条件性 |
| 脚本 | bash only | Node.js 跨平台 |
| Skills | 1 个合并 | 3 个独立（路由精确） |
| toolPermissions | 缺失 | 已补充 |
| registry | 缺失 | 已补充 |
| 复杂度评估 | 严重低估 | 明确标注 |
| 前端代码量 | ~1000 行（tldraw） | ~300 行（Excalidraw） |
| 创新性 | "换皮" | 架构重构 + 离线 MCP + 进程管理 |
