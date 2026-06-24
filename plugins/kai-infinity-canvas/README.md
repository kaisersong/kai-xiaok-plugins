# kai-infinity-canvas

tldraw 驱动的本地无限画布插件。在 xiaok 中打开一个可视化画布，用于构思、标注、图片管理和导出。

## 安装

```bash
xiaok plugin install kai-infinity-canvas
```

或手动安装：

```bash
cd plugins/kai-infinity-canvas
npm install
npm run build
```

## 功能

| 功能 | 说明 |
|------|------|
| 无限画布 | 基于 tldraw 的无限缩放/平移画布 |
| 双向同步 | REST API + SSE 实时同步，支持多标签页/多客户端协作 |
| AI 图片占位框 | `Ctrl+Shift+A` 创建占位框，可设尺寸/比例/锁定 |
| 图片插入 | 通过 MCP 工具将本地图片插入画布，自动防重叠布局 |
| AI 图片生成 | 检测模型能力，支持生图则直接生成，不支持则降级为占位框 |
| 标注工具 | tldraw 原生箭头/文字/形状/画笔/高亮工具 |
| PNG/SVG 导出 | 一键导出当前页面为 PNG 或 SVG |
| 画布跳过记录提示 | 自动 sanitize 不兼容记录，右下角显示详情 |

## 使用

### 打开画布

在 xiaok 中说"打开画布"，或运行：

```bash
node scripts/start-canvas.mjs [project-dir]
```

画布地址：`http://127.0.0.1:43217/`

画布数据保存在：`<project>/canvas/pages/<page-id>/`

### AI 图片占位框

按 `Ctrl+Shift+A` 在视口中心创建 AI 图片占位框。

选中占位框后，右侧样式面板：
- **尺寸**：宽（W）和高（H），单位像素
- **比例锁定**：锁图标切换宽高比锁定
- **预设比例**：1:1、3:2、2:3、4:3、3:4、16:9、9:16

### 插入图片

通过 MCP 工具将本地图片插入画布：

```
kai_canvas_insert_image({
  imagePath: "/path/to/image.png",
  projectDir: "/path/to/project",
  canvasUrl: "http://127.0.0.1:43217"  // optional, for SSE refresh
})
```

### 标注

使用 tldraw 内置工具（左侧工具栏）：

| 工具 | 快捷键 | 用途 |
|------|--------|------|
| 箭头 | `A` | 画箭头指向 |
| 文字 | `T` | 添加文字说明 |
| 矩形 | `R` | 框选区域 |
| 画笔 | `D` | 自由手绘 |
| 高亮 | `H` | 半透明标记 |

### 导出

点击画布右上角导出按钮：
- **PNG** — 导出为位图，适合分享
- **SVG** — 导出为矢量图，适合二次编辑

### MCP 工具

| 工具 | 说明 |
|------|------|
| `kai_canvas_get_selection` | 读取画布当前选中的形状 |
| `kai_canvas_insert_image` | 将本地图片插入画布（自动防重叠布局） |

## Skills

| Skill | 触发词 | 说明 |
|-------|--------|------|
| canvas-open | 打开画布、open canvas | 启动画布 HTTP 服务器 |
| canvas-insert | 插入图片到画布 | 通过 MCP 插入本地图片 |
| canvas-image-gen | 画布生成图片、generate image | AI 图片生成（含降级方案） |
| canvas-annotate | 标注图片、annotate | 图片标注工作流 |

## 架构

```
┌──────────────────┐     ┌──────────────────┐
│  canvas MCP      │     │  canvas HTTP     │
│  (stdio)         │     │  server (:43217) │
│  直读写文件      │     │  REST + SSE      │
└────────┬─────────┘     └────────┬─────────┘
         │  read/write             │ read/write
         ▼          canvas/        ▼
         ┌──────────────────────────┐
         │       filesystem         │
         └──────────────────────────┘
```

- **独立 HTTP server**：不依赖 Vite dev server，生产环境可用
- **离线 MCP**：直接读写文件系统，HTTP server 不运行也能工作
- **SSE 实时同步**：MCP 插入图片后前端自动刷新
- **进程生命周期**：PID 文件 + 30 分钟无连接自动退出

## 技术栈

- [tldraw](https://tldraw.dev) v3 — 无限画布引擎
- React 19 + Vite 7 — 前端
- Node.js — 独立 HTTP server + MCP server

## 开发

```bash
# 开发模式（热更新）
npm run dev

# 构建
npm run build

# 测试
node tests/mcp.test.mjs

# 预构建 dist（发布前）
node scripts/prebuild.mjs
```

## 许可证

Apache-2.0（tldraw 按 cascading license 使用，本插件为开源项目）
