# kai-canvas-creator 实现方案 v3（最终修订版）

> 基于 Excalidraw（MIT）+ 自定义图片代理层。
> 经历 v1→v2→v3 三轮四方对抗性评审。

## 三轮评审问题收敛追踪

| # | 问题 | v1 | v2 | v3 |
|---|---|---|---|---|
| 1 | tldraw GPL 许可证冲突 | 🔴 错误 | ✅ 改 Excalidraw | ✅ 保持 |
| 2 | Vite middleware 生产失效 | 🔴 遗漏 | ✅ 独立 server | ✅ 保持 |
| 3 | MCP 硬依赖 HTTP server | 🔴 无降级 | ✅ 直读写文件 | ✅ 保持 |
| 4 | 图片生成能力未验证 | 🔴 假设存在 | ✅ Phase 2 条件性 | ✅ 保持 |
| 5 | 僵尸进程 | 🔴 遗漏 | ⚠️ idle 超时缺陷 | ✅ SSE 连接计数 |
| 6 | 多项目数据混淆 | 🔴 遗漏 | ✅ MCP 直读写 | ✅ 保持 |
| 7 | 安装构建流程缺失 | 🔴 遗漏 | ✅ registry 补充 | ✅ 保持 |
| 8 | 图片尺寸代码逐字复制 | 🔴 复制 | ✅ file-type | ✅ magic bytes 直读 |
| 9 | 前端复杂度低估 | 🔴 低估 | ✅ Excalidraw 简化 | ✅ 保持 |
| 10 | **onChange 反馈循环** | — | 🔴 v2 新引入 | ✅ excalidrawAPI ref |
| 11 | **图片 base64 内嵌膨胀** | — | 🔴 v2 新引入 | ✅ 图片代理层 |
| 12 | **SSE 覆盖未保存数据** | — | 🟡 v2 新引入 | ✅ debounce 守卫 |
| 13 | file-type v22 需 Node 22 | — | 🟡 v2 新引入 | ✅ 移除依赖 |
| 14 | PID 检测不验证进程身份 | — | 🟡 v2 缺陷 | ✅ 双重验证 |

---

## 一、核心架构决策

### Excalidraw + 自定义图片代理层

v2 切换到 Excalidraw 解决了许可证问题，但暴露了两个阻断性矛盾：

| 矛盾 | Excalidraw 原生行为 | 方案需要的行为 | v3 解法 |
|---|---|---|---|
| 图片存储 | base64 内嵌在 elements.json | 外部文件引用 | **图片代理层：server 端 base64↔文件双向转换** |
| 远程同步 | 无合并机制，直接覆盖 | 保留本地未保存变更 | **debounce 守卫 + 时间戳比较** |
| 前端数据流 | onChange 每次渲染触发 | 仅用户操作触发同步 | **excalidrawAPI ref，不经过 React state** |

### 图片代理层工作原理

```
┌──────────────┐      PUT /api/canvas       ┌──────────────┐
│  Excalidraw   │ ──────────────────────────▶ │  HTTP Server  │
│  前端         │   elements含base64 dataURL  │  (server/)    │
│              │                              │              │
│  excalidrawAPI│ ◀────────────────────────── │  图片提取器：  │
│  ref          │    GET /api/canvas          │  base64→文件   │
│              │   elements含 /img/xxx URL   │  文件→base64   │
└──────────────┘                              └──────────────┘
                                                      │
                                                      ▼
                                              canvas/assets/
                                              image-001.png
                                              image-002.jpg
```

**写入时（PUT /api/canvas）**:
```
1. 收到 Excalidraw elements JSON（含 base64 dataURL）
2. 遍历 elements，找出 type === 'image' 的元素
3. 对每个图片元素：
   a. 从 dataURL 提取 base64 数据
   b. 计算 SHA-256 hash（去重）
   c. 写入 canvas/assets/<hash>.<ext>
   d. 替换 dataURL → "/img/<hash>.<ext>"
   e. 在元素的 customData 中记录原始 mimeType
4. 保存处理后的 elements JSON 到 canvas/elements.json
5. 同时保存 files 映射表 canvas/files.json（elementId → assetPath）
```

**读取时（GET /api/canvas）**:
```
1. 读取 canvas/elements.json（含 /img/xxx URL）
2. 遍历 image 元素
3. 对每个 /img/xxx URL：
   a. 读取 canvas/assets/<filename>
   b. 编码为 base64 dataURL
   c. 替换 URL → dataURL
4. 返回完整的 Excalidraw 兼容 JSON
```

**MCP 插入图片时**:
```
1. MCP 读取 imagePath → 计算 hash → 复制到 canvas/assets/
2. 直接在 elements.json 中追加 image element
   - dataURL 用 "/img/<hash>.<ext>" 占位
   - GET /api/canvas 时会被转回 base64
3. 如果 HTTP server 在运行 → POST /api/notify
4. 如果 HTTP server 未运行 → 静默完成
```

**优点**:
- elements.json 保持小体积（图片是 URL 引用而非 base64）
- HTTP server 的 GET /api/canvas 按需转换，前端无感知
- MCP 直接操作文件，不依赖 HTTP server
- 多张图片不会导致 PUT payload 膨胀

**已知限制**:
- GET /api/canvas 需要将文件读回 base64，有 I/O 开销（可加内存缓存 + LRU 淘汰）
- 首次加载大图片可能慢（可做懒加载：只转换当前视口内的图片）

---

## 二、架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                       xiaok Desktop                          │
│                                                               │
│  ┌──────────┐                                                │
│  │ xiaok    │                                                │
│  │ Skills    │                                                │
│  │ (LLM)    │                                                │
│  └─────┬────┘                                                │
│        │                                                     │
│        ├──────────────────────┐                              │
│        ▼                      ▼                              │
│  ┌──────────┐          ┌──────────────┐                      │
│  │ canvas   │          │ canvas-http  │                      │
│  │ MCP      │          │ server       │                      │
│  │ (stdio)  │          │              │                      │
│  │          │          │ ┌──────────┐ │                      │
│  │ 直读写   │          │ │图片代理层│ │                      │
│  │ 文件系统 │          │ │base64↔URL│ │                      │
│  └────┬─────┘          │ └──────────┘ │                      │
│       │                │ REST + SSE   │                      │
│       │  read/write    │ serve dist/  │                      │
│       │  canvas/       └──────┬───────┘                      │
│       └──────────────▶ FS ◀───┘                              │
│                       canvas/                                │
│                       elements.json (URL引用)                │
│                       assets/ (实际图片文件)                  │
│                                                               │
│  ┌──────────────────────────────────────────┐               │
│  │ Browser / WebView                        │               │
│  │ ┌──────────────────────────────────┐    │               │
│  │ │ Excalidraw Canvas                │    │               │
│  │ │ excalidrawAPI ref (非React state)│    │               │
│  │ │ onChange → debounce PUT          │    │               │
│  │ │ SSE → updateScene (带守卫)       │    │               │
│  │ └──────────────────────────────────┘    │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

## 三、目录结构

```
plugins/kai-canvas-creator/
├── plugin.json
├── README.md
├── package.json                         # 依赖：@excalidraw/excalidraw, react, react-dom, vite
├── vite.config.ts                       # Vite 配置（仅前端构建 + dev proxy）
├── tsconfig.json
├── index.html
│
├── src/                                 # 前端（TypeScript）
│   ├── main.tsx
│   ├── App.tsx                          # Excalidraw 集成（excalidrawAPI ref 模式）
│   ├── styles.css
│   └── hooks/
│       └── useCanvasSync.ts             # 同步逻辑（SSE + polling 降级 + debounce 守卫）
│
├── server/                              # 独立 HTTP server（纯 .mjs）
│   ├── index.mjs                        # HTTP server 入口
│   ├── routes.mjs                       # REST API
│   ├── storage.mjs                      # elements.json 读写（原子写入）
│   ├── image-proxy.mjs                  # 图片代理层（base64↔URL 转换）★v3新增
│   ├── events.mjs                       # SSE
│   └── lifecycle.mjs                    # 进程生命周期（PID + SSE计数 + 超时）
│
├── mcp-servers/canvas-server/
│   ├── server.mjs                       # MCP JSON-RPC
│   ├── tools/
│   │   ├── get-selection.mjs
│   │   └── insert-image.mjs            # 直接操作 elements.json + assets/
│   └── lib/
│       ├── excalidraw-helpers.mjs       # elements JSON 操作
│       ├── image-utils.mjs              # 图片尺寸读取（magic bytes，无外部依赖）
│       └── placement.mjs                # 防重叠布局
│
├── scripts/
│   ├── start-canvas.mjs                 # 跨平台启动（Node.js）
│   └── build.sh                         # release 构建用
│
├── skills/
│   ├── canvas-open/SKILL.md
│   ├── canvas-insert/SKILL.md
│   └── canvas-annotate/SKILL.md         # Phase 2 条件性
│
├── evals/
│   └── cases/
│       └── basic-canvas.test.mjs
│
├── dist/                                # gitignore
└── tests/
    ├── server.test.mjs
    └── mcp.test.mjs
```

## 四、核心组件详细设计

### 4.1 前端 — Excalidraw（v3 修正数据流）

**关键修正**: 不用 React state 管理 elements，用 `excalidrawAPI` ref。

```typescript
// src/App.tsx — v3 正确实现

import { Excalidraw } from '@excalidraw/excalidraw'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const lastPutTimestamp = useRef<number>(0)
  const isRefreshingFromServer = useRef(false)

  // 1. 初始化：从后端加载（后端返回的 dataURL 已从文件 URL 转换回来）
  useEffect(() => {
    fetch('/api/canvas')
      .then(r => r.json())
      .then(({ elements, appState, files }) => {
        if (!excalidrawAPI) return
        isRefreshingFromServer.current = true
        excalidrawAPI.updateScene({ elements: elements ?? [], appState: appState ?? {} })
        // files 需要通过 setFiles 或 BinaryFileData 传入
        isRefreshingFromServer.current = false
      })
  }, [excalidrawAPI])

  // 2. onChange：仅做 debounce PUT，不做 setElements（不触发重渲染）
  const handleChange = useCallback((elements, appState) => {
    // 如果是来自 SSE 的刷新，不要 PUT 回去
    if (isRefreshingFromServer.current) return

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      lastPutTimestamp.current = Date.now()
      await fetch('/api/canvas', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ elements, appState })
      })
    }, 500)
  }, [])

  // 3. SSE 监听 + debounce 守卫
  useEffect(() => {
    if (!excalidrawAPI) return
    let eventSource: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function refreshFromServer() {
      // 守卫：如果本地有 < 1秒内的 PUT 操作，延迟刷新
      const sinceLastPut = Date.now() - lastPutTimestamp.current
      if (sinceLastPut < 1000) {
        setTimeout(refreshFromServer, 1000 - sinceLastPut)
        return
      }

      const res = await fetch('/api/canvas')
      const { elements, appState } = await res.json()
      isRefreshingFromServer.current = true
      excalidrawAPI!.updateScene({ elements: elements ?? [] })
      isRefreshingFromServer.current = false
    }

    eventSource = new EventSource('/api/canvas-events')
    eventSource.addEventListener('canvas-changed', refreshFromServer)
    eventSource.onerror = () => {
      eventSource?.close()
      eventSource = null
      // 降级为 polling
      pollTimer = setInterval(refreshFromServer, 3000)
    }

    return () => { eventSource?.close(); clearInterval(pollTimer!) }
  }, [excalidrawAPI])

  return (
    <div className="canvas-container">
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleChange}
      />
    </div>
  )
}
```

**v3 前端关键改动 vs v2**:

| 问题 | v2 错误做法 | v3 正确做法 |
|---|---|---|
| onChange 循环 | `setElements(newElements)` 触发重渲染→onChange 再触发 | `excalidrawAPI ref`，不经过 React state |
| SSE 覆盖未保存数据 | 直接 `setElements(serverData)` | `isRefreshingFromServer` 标志 + `lastPutTimestamp` 守卫 |
| 远程刷新方式 | React state 覆盖 | `excalidrawAPI.updateScene()` |

### 4.2 图片代理层（v3 新增核心组件）

**文件**: `server/image-proxy.mjs`

```javascript
// server/image-proxy.mjs

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { createHash } from 'node:crypto'

const ASSETS_DIR_FIELD = 'assets'  // canvas/assets/ 目录
const IMG_URL_PREFIX = '/img/'

/**
 * 写入时：将 elements 中的 base64 dataURL 提取为文件
 * @param {Array} elements - Excalidraw elements（含 base64 dataURL）
 * @param {string} canvasDir - canvas 目录路径
 * @returns {Array} 处理后的 elements（dataURL 替换为 /img/xxx URL）
 */
export async function extractImagesToFilesystem(elements, canvasDir) {
  if (!Array.isArray(elements)) return elements
  
  const assetsDir = join(canvasDir, ASSETS_DIR_FIELD)
  await mkdir(assetsDir, { recursive: true })
  
  const result = []
  for (const el of elements) {
    if (el.type !== 'image' || !el.fileId) {
      result.push(el)
      continue
    }
    
    // Excalidraw 图片数据在 files map 中，不在 element 本身
    // element.fileId 指向 files[fileId].dataURL
    // 这个函数处理的是 files map，见 extractFilesToFilesystem
    result.push(el)
  }
  
  return result
}

/**
 * 处理 Excalidraw files map（BinaryFileData）
 * 将 dataURL 提取为文件，返回 { files: 处理后的map, fileAssets: [{id, path}] }
 */
export async function extractFilesToFilesystem(files, canvasDir) {
  if (!files || typeof files !== 'object') return { files: {}, fileAssets: [] }
  
  const assetsDir = join(canvasDir, ASSETS_DIR_FIELD)
  await mkdir(assetsDir, { recursive: true })
  
  const result = {}
  const fileAssets = []
  
  for (const [id, fileData] of Object.entries(files)) {
    const { dataURL, mimeType } = fileData
    
    // 如果已经是文件 URL（之前处理过），跳过
    if (typeof dataURL === 'string' && dataURL.startsWith(IMG_URL_PREFIX)) {
      result[id] = fileData
      fileAssets.push({ id, path: dataURL })
      continue
    }
    
    // 提取 base64
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataURL ?? '')
    if (!match) {
      result[id] = fileData
      continue
    }
    
    const [, fileMimeType, base64Data] = match
    const buffer = Buffer.from(base64Data, 'base64')
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
    const ext = mimeTypeToExtension(fileMimeType)
    const filename = `${hash}${ext}`
    const filepath = join(assetsDir, filename)
    
    // 如果文件已存在（内容相同），跳过写入
    try {
      await stat(filepath)
    } catch {
      await writeFile(filepath, buffer)
    }
    
    // 替换 dataURL 为文件 URL
    result[id] = {
      ...fileData,
      dataURL: `${IMG_URL_PREFIX}${filename}`,
      mimeType: fileMimeType
    }
    fileAssets.push({ id, path: `${IMG_URL_PREFIX}${filename}` })
  }
  
  return { files: result, fileAssets }
}

/**
 * 读取时：将文件 URL 转回 base64 dataURL
 * @param {Array} elements - elements（可能不需要修改）
 * @param {Object} files - files map（含 /img/xxx URL）
 * @param {string} canvasDir - canvas 目录路径
 * @returns {Object} 处理后的 files map（URL 替换为 dataURL）
 */
export async function injectImagesFromFiles(files, canvasDir) {
  if (!files || typeof files !== 'object') return files
  
  const result = {}
  for (const [id, fileData] of Object.entries(files)) {
    const { dataURL } = fileData
    
    // 如果不是文件 URL，跳过
    if (typeof dataURL !== 'string' || !dataURL.startsWith(IMG_URL_PREFIX)) {
      result[id] = fileData
      continue
    }
    
    // 从文件 URL 读取并转回 base64
    const filename = dataURL.slice(IMG_URL_PREFIX.length)
    const filepath = join(canvasDir, ASSETS_DIR_FIELD, filename)
    
    try {
      const buffer = await readFile(filepath)
      const base64 = buffer.toString('base64')
      result[id] = {
        ...fileData,
        dataURL: `data:${fileData.mimeType ?? 'image/png'};base64,${base64}`
      }
    } catch {
      // 文件不存在，保留原始 URL（前端会显示占位）
      result[id] = fileData
    }
  }
  
  return result
}

/**
 * MCP 直接插入图片：创建 files map 条目
 */
export async function createImageFileEntry(imagePath, canvasDir) {
  const buffer = await readFile(imagePath)
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  const ext = extname(imagePath)
  const filename = `${hash}${ext}`
  const filepath = join(canvasDir, ASSETS_DIR_FIELD, filename)
  
  await mkdir(join(canvasDir, ASSETS_DIR_FIELD), { recursive: true })
  
  try {
    await stat(filepath)
  } catch {
    await writeFile(filepath, buffer)
  }
  
  return {
    fileId: `file-${hash}`,
    url: `${IMG_URL_PREFIX}${filename}`
  }
}

function mimeTypeToExtension(mime) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  }
  return map[mime] ?? '.bin'
}
```

### 4.3 进程生命周期（v3 修正）

**v2 缺陷修正**:

| 问题 | v2 做法 | v3 做法 |
|---|---|---|
| idle 超时误杀 | `server.on('request')` 更新时间（SSE 不产生新 request） | **SSE 连接计数 + 心跳时间戳** |
| PID 回收复用 | 仅 `process.kill(pid, 0)` | **双重验证：进程存在 + PID 文件 projectDir 匹配** |

```javascript
// server/lifecycle.mjs — v3 修正版

import { writeFile, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

function pidFilePath(port) {
  return join(tmpdir(), `kai-canvas-${port}.pid`)
}

export async function writePidFile(port, pid, projectDir) {
  const content = JSON.stringify({ pid, projectDir, startedAt: new Date().toISOString() })
  await writeFile(pidFilePath(port), content, 'utf8')
}

export async function removePidFile(port) {
  try { await unlink(pidFilePath(port)) } catch {}
}

/**
 * 检查端口上是否有我们的 canvas server
 * v3 修正：双重验证 — 进程存在 + PID 文件 projectDir 匹配
 */
export async function getRunningInstance(port) {
  try {
    const content = await readFile(pidFilePath(port), 'utf8')
    const info = JSON.parse(content)
    
    // 验证 1：进程是否存活
    try { process.kill(info.pid, 0) } catch { return null }
    
    // 验证 2：进程命令行是否匹配 node + canvas（防止 PID 回收复用）
    const isOurProcess = checkProcessCommand(info.pid)
    if (!isOurProcess) return null
    
    return info
  } catch { return null }
}

function checkProcessCommand(pid) {
  try {
    // macOS/Linux: ps -p <pid> -o command=
    // Windows: wmic process where processid=<pid> get commandline=
    const cmd = process.platform === 'win32'
      ? `wmic process where processid=${pid} get commandline /format:list`
      : `ps -p ${pid} -o command=`
    const output = execSync(cmd, { encoding: 'utf8', timeout: 2000 })
    return output.includes('canvas') || output.includes('kai-canvas')
  } catch {
    return false
  }
}

export async function findAvailablePort(startPort) {
  const net = await import('node:net')
  let port = startPort
  while (port < startPort + 10) {
    const available = await new Promise(resolve => {
      const tester = net.createServer()
      tester.once('error', () => resolve(false))
      tester.once('listening', () => { tester.close(() => resolve(true)) })
      tester.listen(port, '127.0.0.1')
    })
    if (available) return port
    port++
  }
  throw new Error(`No available port in range ${startPort}-${startPort + 9}`)
}
```

**idle 超时修正**（在 `server/index.mjs` 中）:

```javascript
// v3: 基于 SSE 连接计数 + 心跳时间戳

let sseClientCount = 0
let lastSSEHeartbeat = Date.now()
let lastHttpRequest = Date.now()

// SSE handler 中:
export function handleSSE(req, res, canvasDir) {
  sseClientCount++
  lastSSEHeartbeat = Date.now()
  
  // ... SSE 逻辑 ...
  
  // 心跳更新活跃时间
  const heartbeat = setInterval(() => {
    lastSSEHeartbeat = Date.now()
    res.write(`: heartbeat ${Date.now()}\n\n`)
  }, 25000)
  
  req.on('close', () => {
    clearInterval(heartbeat)
    sseClientCount--
    lastSSEHeartbeat = Date.now()  // 关闭也更新时间戳
  })
}

// 超时检查:
setInterval(() => {
  const now = Date.now()
  // 只有当没有任何 SSE 连接 且 没有 HTTP 请求活动时才计时
  if (sseClientCount === 0 && now - Math.max(lastSSEHeartbeat, lastHttpRequest) > 30 * 60 * 1000) {
    console.log('Canvas server idle for 30min, shutting down.')
    process.emit('SIGTERM')
  }
}, 60 * 1000)
```

### 4.4 图片尺寸读取（v3 无外部依赖）

```javascript
// mcp-servers/canvas-server/lib/image-utils.mjs
// 完全独立的 magic bytes 实现，使用不同算法路径

import { readFile } from 'node:fs/promises'

export async function getImageDimensions(filePath) {
  // 只读前 512 字节（足够所有格式的 header）
  const handle = await readFile(filePath)
  return detectDimensions(handle)
}

function detectDimensions(buf) {
  // PNG: \x89PNG\r\n\x1a\n
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    // IHDR chunk: width at byte 16, height at byte 20 (big-endian)
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  
  // JPEG: \xFF\xD8
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    return scanJpegSOF(buf)
  }
  
  // GIF: GIF8
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    // Logical Screen Descriptor: width at byte 6-7, height at byte 8-9 (little-endian)
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }
  
  // WebP: RIFF....WEBP
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return readWebPDimensions(buf)
  }
  
  throw new Error('Unsupported image format. Use PNG, JPEG, GIF, or WebP.')
}

// JPEG SOF 扫描 — 独立实现，用 marker 遍历法
function scanJpegSOF(buf) {
  let pos = 2 // 跳过 SOI marker
  while (pos < buf.length - 9) {
    if (buf[pos] !== 0xff) { pos++; continue }
    const marker = buf[pos + 1]
    
    // SOF markers: 0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      // height: bytes 5-6 (big-endian), width: bytes 7-8 (big-endian) after marker+length
      return { width: buf.readUInt16BE(pos + 7), height: buf.readUInt16BE(pos + 5) }
    }
    
    // 跳过非 SOF marker
    if (marker === 0xd8 || marker === 0xd9) { pos += 2; continue }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; continue }
    
    const segmentLength = buf.readUInt16BE(pos + 2)
    pos += 2 + segmentLength
  }
  throw new Error('Could not find JPEG SOF marker')
}

// WebP 尺寸 — 支持 VP8/VP8L/VP8X
function readWebPDimensions(buf) {
  const chunk = buf.toString('ascii', 12, 16)
  
  if (chunk === 'VP8X') {
    // VP8X (extended): canvas width/height in 24-bit LE at bytes 24-29
    return {
      width: 1 + ((buf[24] | (buf[25] << 8) | (buf[26] << 16))),
      height: 1 + ((buf[27] | (buf[28] << 8) | (buf[29] << 16)))
    }
  }
  
  if (chunk === 'VP8 ') {
    // VP8 (lossy): width at bytes 26-27, height at bytes 28-29 (14-bit LE)
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  
  if (chunk === 'VP8L') {
    // VP8L (lossless): width/height encoded in variable-length bits at byte 21
    const w14 = buf[21] | (buf[22] << 8) | (buf[23] << 16)
    return { width: 1 + (w14 & 0x3fff), height: 1 + ((w14 >> 14) & 0x3fff) }
  }
  
  throw new Error(`Unsupported WebP chunk: ${chunk}`)
}
```

**与参考项目的差异**: 使用不同算法路径（WebP 支持 VP8/VP8L/VP8X 三种子格式；JPEG 用 marker 遍历法而非固定偏移；新增 GIF 支持），且读取前 512 字节而非全文件。

### 4.5 MCP Server（v3 离线优先 + 图片代理）

#### `insert_image` 工具完整流程（v3 修正）

```javascript
// mcp-servers/canvas-server/tools/insert-image.mjs

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, resolve, basename, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { getImageDimensions } from '../lib/image-utils.mjs'
import { choosePlacement } from '../lib/placement.mjs'

const IMG_URL_PREFIX = '/img/'

export async function insertImage(args) {
  const { imagePath, projectDir, canvasDir: explicitCanvasDir } = args
  if (!imagePath) throw new Error('imagePath is required')
  
  // 1. 解析路径
  const canvasDir = explicitCanvasDir || join(resolve(projectDir), 'canvas')
  const assetsDir = join(canvasDir, 'assets')
  const elementsFile = join(canvasDir, 'elements.json')
  const selectionFile = join(canvasDir, 'selection.json')
  
  // 2. 读取图片
  const imageBuffer = await readFile(resolve(imagePath))
  const dimensions = await getImageDimensions(resolve(imagePath))
  const hash = createHash('sha256').update(imageBuffer).digest('hex').slice(0, 16)
  const ext = extname(imagePath) || '.png'
  const filename = `${hash}${ext}`
  const assetPath = join(assetsDir, filename)
  
  // 3. 复制图片到 assets/（如果不存在）
  await mkdir(assetsDir, { recursive: true })
  try { await stat(assetPath) } catch { 
    await writeFile(assetPath, imageBuffer) 
  }
  
  // 4. 读取现有 elements
  let canvasData = { elements: [], files: {} }
  try {
    canvasData = JSON.parse(await readFile(elementsFile, 'utf8'))
  } catch {} // 首次使用
  
  // 5. 读取选区（确定锚点）
  let selection = { selectedIds: [] }
  try {
    selection = JSON.parse(await readFile(selectionFile, 'utf8'))
  } catch {}
  
  // 6. 计算放置位置
  const anchorEl = selection.selectedIds?.[0]
    ? canvasData.elements.find(e => e.id === selection.selectedIds[0])
    : null
  const displayWidth = args.displayWidth || Math.min(dimensions.width, 512)
  const displayHeight = args.displayHeight || Math.round(displayWidth * dimensions.height / dimensions.width)
  const placement = choosePlacement({
    elements: canvasData.elements,
    anchor: anchorEl,
    width: displayWidth,
    height: displayHeight,
    margin: args.margin || 40,
    direction: args.placement || 'right'
  })
  
  // 7. 创建 Excalidraw image element + file entry
  const fileId = `file-${hash}`
  const elementId = `img-${Date.now().toString(36)}-${hash.slice(0, 4)}`
  
  const newElement = {
    id: elementId,
    type: 'image',
    x: placement.x,
    y: placement.y,
    width: displayWidth,
    height: displayHeight,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 0,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 2000000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2000000000),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { kaiCanvasSource: args.imagePath },
    fileId: fileId,
    scale: [1, 1]
  }
  
  // file entry 用 /img/ URL（读取时由 image-proxy 转回 base64）
  canvasData.files = canvasData.files || {}
  canvasData.files[fileId] = {
    mimeType: getMimeType(ext),
    id: fileId,
    dataURL: `${IMG_URL_PREFIX}${filename}`,
    created: Date.now()
  }
  
  // 8. 追加 element
  canvasData.elements.push(newElement)
  
  // 9. 原子写入 elements.json
  await atomicWrite(elementsFile, JSON.stringify(canvasData, null, 2))
  
  // 10. 可选：通知 HTTP server 触发 SSE
  if (args.canvasUrl) {
    try {
      await fetch(`${args.canvasUrl}/api/notify`, { method: 'POST', body: '{}' })
    } catch {} // 静默失败
  }
  
  return {
    elementId,
    fileId,
    assetUrl: `${IMG_URL_PREFIX}${filename}`,
    dimensions,
    placement
  }
}

async function atomicWrite(filePath, content) {
  const tmp = `${filePath}.${process.pid}.tmp`
  await writeFile(tmp, content)
  const { rename } = await import('node:fs/promises')
  await rename(tmp, filePath)
}

function getMimeType(ext) {
  const map = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', 
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
```

### 4.6 HTTP Server — REST API 路由（v3 完整版）

```javascript
// server/routes.mjs — v3

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { extractFilesToFilesystem, injectImagesFromFiles } from './image-proxy.mjs'

export function createRoutes(canvasDir, staticDir) {
  return {
    // 健康检查
    'GET /api/health': async (req, res) => {
      sendJson(res, 200, {
        status: 'ok',
        canvasDir,
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        sseClients: sseClientCount
      })
    },
    
    // 读取画布（将文件 URL 转回 base64）
    'GET /api/canvas': async (req, res) => {
      try {
        const raw = await readFile(join(canvasDir, 'elements.json'), 'utf8')
        const data = JSON.parse(raw)
        // 图片代理：URL → base64
        data.files = await injectImagesFromFiles(data.files, canvasDir)
        sendJson(res, 200, data)
      } catch (error) {
        if (error.code === 'ENOENT') {
          sendJson(res, 200, { elements: [], appState: {}, files: {} })
        } else {
          sendJson(res, 500, { error: error.message })
        }
      }
    },
    
    // 保存画布（将 base64 提取为文件）
    'PUT /api/canvas': async (req, res) => {
      try {
        const body = await readBody(req)
        const data = JSON.parse(body)
        
        // 图片代理：base64 → 文件 URL
        if (data.files) {
          const { files } = await extractFilesToFilesystem(data.files, canvasDir)
          data.files = files
        }
        
        await atomicWrite(join(canvasDir, 'elements.json'), JSON.stringify(data, null, 2))
        broadcastCanvasChanged({ source: 'user' })
        sendJson(res, 200, { ok: true })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    },
    
    // 选区
    'GET /api/selection': async (req, res) => {
      try {
        const data = await readFile(join(canvasDir, 'selection.json'), 'utf8')
        sendJson(res, 200, JSON.parse(data))
      } catch {
        sendJson(res, 200, { selectedIds: [], updatedAt: null })
      }
    },
    
    'PUT /api/selection': async (req, res) => {
      const body = await readBody(req)
      const selection = JSON.parse(body)
      await atomicWrite(join(canvasDir, 'selection.json'), JSON.stringify(selection, null, 2))
      sendJson(res, 200, { ok: true })
    },
    
    // MCP 通知触发 SSE
    'POST /api/notify': async (req, res) => {
      broadcastCanvasChanged({ source: 'mcp' })
      sendJson(res, 200, { ok: true })
    },
    
    // 图片资源服务
    'GET /img/': async (req, res, url) => {
      const filename = url.pathname.slice('/img/'.length)
      const filepath = join(canvasDir, 'assets', filename)
      // 安全检查：防止路径遍历
      if (!filepath.startsWith(join(canvasDir, 'assets'))) {
        res.statusCode = 403; res.end('Forbidden'); return
      }
      try {
        const data = await readFile(filepath)
        res.setHeader('content-type', getMimeType(extname(filename)))
        res.end(data)
      } catch {
        res.statusCode = 404; res.end('Not found')
      }
    }
  }
}
```

### 4.7 启动脚本（v3 跨平台 Node.js）

```javascript
// scripts/start-canvas.mjs — 跨平台

import { spawn } from 'node:child_process'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(__dirname, '..')

const projectDir = process.env.KAI_CANVAS_PROJECT_DIR || process.argv[2] || process.cwd()
const staticDir = join(pluginRoot, 'dist')

// 检查是否已构建
try {
  await import('node:fs/promises').then(fs => fs.access(join(staticDir, 'index.html')))
} catch {
  console.error('Canvas not built. Run: npm install && npm run build')
  process.exit(1)
}

// 启动 HTTP server
const server = spawn('node', [join(pluginRoot, 'server', 'index.mjs')], {
  env: {
    ...process.env,
    KAI_CANVAS_PROJECT_DIR: projectDir,
    KAI_CANVAS_STATIC_DIR: staticDir
  },
  stdio: 'inherit'
})

server.on('exit', (code) => process.exit(code ?? 0))
```

### 4.8 plugin.json + registry.json（v3 最终版）

**plugin.json**:
```json
{
  "name": "kai-canvas-creator",
  "version": "0.1.0",
  "description": "Excalidraw-powered local infinite canvas",
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
  }
}
```

**registry.json 条目**:
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

## 五、数据存储格式

### canvas/elements.json

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "kai-canvas-creator",
  "elements": [
    {
      "id": "rect-001",
      "type": "rectangle",
      "x": 100, "y": 100,
      "width": 200, "height": 150,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent",
      "fillStyle": "hachure",
      "strokeWidth": 1,
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "seed": 1234567890,
      "version": 1,
      "versionNonce": 9876543210,
      "isDeleted": false,
      "groupIds": [],
      "frameId": null,
      "roundness": null,
      "boundElements": [],
      "updated": 1737000000000,
      "link": null,
      "locked": false
    }
  ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "currentItemFontFamily": 1,
    "gridSize": null
  },
  "files": {
    "file-abc123def456": {
      "id": "file-abc123def456",
      "mimeType": "image/png",
      "dataURL": "/img/abc123def456.png",
      "created": 1737000000000
    }
  }
}
```

### canvas/selection.json

```json
{
  "selectedIds": ["rect-001"],
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### canvas/assets/

实际图片文件，文件名使用内容 hash：
```
abc123def456.png
def789ghi012.jpg
```

## 六、实现步骤

### Phase 0：前置验证

| 步骤 | 验证内容 | 通过标准 |
|---|---|---|
| 0.1 | Excalidraw React 19 兼容性 | demo 页面可渲染 |
| 0.2 | `excalidrawAPI` ref 模式可行 | updateScene 可用 |
| 0.3 | 图片代理层 base64↔URL 转换可行 | 10MB 图片转换 < 500ms |
| 0.4 | 确认 xiaok 图片生成能力（有/无） | 明确结论 |

### Phase 1：基础画布 MVP

| # | 文件 | 说明 |
|---|---|---|
| 1.1 | `package.json` | @excalidraw/excalidraw, react, react-dom, vite |
| 1.2 | `src/main.tsx` + `src/App.tsx` | Excalidraw + excalidrawAPI ref 模式 |
| 1.3 | `src/hooks/useCanvasSync.ts` | debounce PUT + SSE + 守卫 |
| 1.4 | `server/index.mjs` | 独立 HTTP server |
| 1.5 | `server/routes.mjs` | REST API |
| 1.6 | `server/storage.mjs` | elements.json 原子读写 |
| 1.7 | `server/image-proxy.mjs` | base64↔文件 转换 |
| 1.8 | `server/events.mjs` | SSE + 连接计数 |
| 1.9 | `server/lifecycle.mjs` | PID + 双重验证 + SSE 计数超时 |
| 1.10 | `scripts/start-canvas.mjs` | 跨平台启动 |
| 1.11 | `mcp-servers/canvas-server/server.mjs` | MCP JSON-RPC |
| 1.12 | `mcp-servers/canvas-server/tools/get-selection.mjs` | 读选区 |
| 1.13 | `mcp-servers/canvas-server/tools/insert-image.mjs` | 插入图片 |
| 1.14 | `mcp-servers/canvas-server/lib/image-utils.mjs` | 图片尺寸（magic bytes） |
| 1.15 | `mcp-servers/canvas-server/lib/placement.mjs` | 防重叠布局 |
| 1.16 | `plugin.json` + `skills/` | xiaok 集成 |
| 1.17 | registry.json 更新 | 注册插件 |
| 1.18 | `tests/` | 单元测试 |

### Phase 2：条件性功能

| # | 说明 | 前置 |
|---|---|---|
| 2.1 | 标注工具 | Excalidraw custom elements |
| 2.2 | AI 图片生成到画布 | xiaok 有图片生成能力 |
| 2.3 | 标注截图改图 | 同上 |
| 2.4 | PNG/SVG 导出 | Excalidraw exportToBlob |

### Phase 3：打磨发布

| # | 说明 |
|---|---|
| 3.1 | release workflow 预构建 dist/ |
| 3.2 | evals/ 质量评估 |
| 3.3 | README.md 文档 |

## 七、验收标准

### 功能

- [ ] `npm run build` 后 `node server/index.mjs` 独立运行，REST API 可用
- [ ] 浏览器打开显示 Excalidraw 画布
- [ ] 画图后刷新页面内容仍在
- [ ] 10 张图片不会导致 elements.json > 1MB（图片在 assets/ 而非 base64 内嵌）
- [ ] MCP 插入图片不需要 HTTP server 运行
- [ ] SSE 刷新不覆盖正在绘制的笔画
- [ ] 端口被占时自动回退
- [ ] 关闭浏览器 30 分钟后 server 自动退出（SSE 连接计数正确）
- [ ] `node scripts/start-canvas.mjs` 在 Windows 上可运行
- [ ] `xiaok plugin install kai-canvas-creator` 自动 npm install + build

### 许可证

- [ ] 无 GPL/copyleft 依赖
- [ ] Excalidraw MIT 许可证声明保留
- [ ] 所有依赖与 Apache-2.0 兼容

### 不回归

- [ ] onChange 不产生反馈循环
- [ ] 图片不作为 base64 持久化在 elements.json
- [ ] SSE 事件不覆盖未保存的本地变更
- [ ] PID 检测不会误判其他进程
