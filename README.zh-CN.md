# kai-xiaok-plugins

[English](README.md) | 简体中文

[xiaok](https://github.com/kaisersong/xiaok-cli) AI 工作台的内容生成插件集合。插件通过 MCP（Model Context Protocol）暴露确定性 HTML renderer，让模型只生成结构化 IR，最终 HTML/CSS/JS 由 renderer 负责输出、校验和回归。

## 插件一览

| 插件 | 说明 | MCP Server | 运行时 |
|------|------|------------|--------|
| [kai-slide-creator](plugins/kai-slide-creator) | HTML 幻灯片生成，22 种风格预设 | slide-renderer | Python |
| [kai-report-creator](plugins/kai-report-creator) | HTML 报告生成，8 套主题，含 KPI/摘要质量门禁 | report-renderer | Node.js |
| [kai-infinity-canvas](plugins/kai-infinity-canvas) | tldraw 本地无限画布，支持手绘、标注、图片插入和导出 | canvas-server | Node.js |

## 当前发布基线

- Xiaok Desktop v1.4.15 继续把本仓库作为随包插件来源；release workflow 会从默认分支 checkout 本仓库，因此打 tag 前必须保证插件 README、registry 和 renderer bundle 构建说明已经同步。
- `kai-slide-creator` 当前注册版本为 `3.2.0`，用于 HTML 演示文稿/幻灯片生成。
- `kai-report-creator` 当前注册版本为 `2.1.0`，用于 HTML 报告、看板、KPI 摘要和可导出交互报告。
- `kai-infinity-canvas` 当前注册版本为 `0.1.0`，用于本地无限画布、图片标注、MCP 图片插入和 PNG/SVG 导出。
- xiaok Desktop release workflow 会 checkout 本仓库，构建 `kai-report-creator` 的 `report-renderer` bundle，并下载 slide renderer 所需 Python wheels 后再打包 macOS/Windows 安装器。
- v1.4.15 Desktop 打包会带上 `kai-infinity-canvas/scripts/**`，安装包内可通过 `start-canvas.mjs` 启动画布插件；`active` symlink 现在指向真实 `<session>/canvas` 数据目录，MCP 读取 `KAI_CANVAS_DIR=active` 时能解析到 tldraw scene。
- `kai-infinity-canvas` 预览层缩小并降低 tldraw watermark 透明度，避免水印遮挡画布内容。
- 插件边界保持不变：LLM 生成结构化 IR，MCP renderer 负责确定性 HTML/CSS/JS 输出、shell 结构和质量门禁。
- Xiaok v1.4.15 的自动化/Loop 输出预览、知识库产物预览和 Canvas 产物编辑会复用同一套 artifact 预览边界：插件负责生成可检查的 HTML 产物，Xiaok 负责把产物挂到任务、loop、项目或编辑界面。
- v2.1.0 report renderer 加强正文 Markdown 解析：章节内标题、列表、表格、inline strong/em/code 会转成正式 HTML，避免报告预览出现未渲染 Markdown 或不可读转义字符。
- 本次 Xiaok v1.4.15 release 不提升插件注册版本；当前插件 baseline 仍是 slide `3.2.0`、report `2.1.0`、canvas `0.1.0`。

## 快速安装

### 通过 xiaok CLI（推荐）

```bash
xiaok plugin search
xiaok plugin install kai-slide-creator
xiaok plugin install kai-report-creator
```

### 提示词安装

在 xiaok chat 中直接说：

```text
安装插件
```

xiaok 会引导你完成安装。

### 手动安装（开发模式）

```bash
git clone https://github.com/kaisersong/kai-xiaok-plugins.git

ln -sfn <项目路径>/plugins/kai-slide-creator ~/.xiaok/plugins/kai-slide-creator
ln -sfn <项目路径>/plugins/kai-report-creator ~/.xiaok/plugins/kai-report-creator

pip3 install -r plugins/kai-slide-creator/mcp-servers/slide-renderer/requirements.txt
cd plugins/kai-report-creator/mcp-servers/report-renderer
npm install
npm run build
```

## 设计思想

核心设计是：LLM 不手写生产 HTML。模型生成受约束的中间表示，slide 插件使用 `BRIEF.json`，report 插件使用 `.report.md` IR；MCP server 校验 IR、确定性渲染 HTML，并执行 shell/质量门禁。

这带来四个关键收益：

- **可复现**：同一份 IR 经过同一 renderer 输出一致的 HTML，方便回归和发布验证。
- **低上下文成本**：skill 保持短小，复杂渲染规则沉到 MCP server、schema、tests 和 evals。
- **质量合同化**：必需 shell ID、导出控件、摘要元数据、主题 CSS、KPI 数字等都由程序检查。
- **运行时无 eval 额外成本**：eval 套件只在开发和发布验证时运行，用户正常渲染只走 IR 解析和确定性输出。

## Report Creator Eval 设计

`kai-report-creator` 的评测分两层：

| 层级 | 目的 |
|------|------|
| Agent/skill 评测 | 沿用 OpenAI skills eval 的 outcome、process、style、efficiency 四类目标，验证 agent 是否真正按技能工作。 |
| Renderer 确定性评测 | 验证固定 IR 的输出是否满足 shell、组件、主题、KPI 数据质量和性能约束。 |

当前 report renderer rubric：

| 评分项 | 权重 | 含义 |
|--------|------|------|
| L0 validation | 25 | 无原始 `:::` 泄漏，存在 `ir-hash` |
| L1 shell | 20 | HTML shell 结构完整 |
| L2 IDs | 20 | TOC、摘要、编辑、导出、`report-summary` 等必需 ID 完整 |
| L3 output quality | 15 | 可见 KPI 和 `report-summary.kpis` 都包含真实数字 |
| Component accuracy | 10 | 组件渲染为正确 HTML，无 unknown/empty 输出 |
| Theme integrity | 5 | CSS 正常加载，无主题 fallback 错误 |
| Performance | 5 | 典型报告渲染耗时保持在 500ms 以内 |

## 开发与验证

```bash
# 同步渲染引擎
./scripts/vendor.sh slide-creator
./scripts/vendor.sh report-creator
./scripts/vendor.sh all

# slide-creator MCP server 测试
cd plugins/kai-slide-creator/mcp-servers/slide-renderer
pip3 install -r requirements.txt
python3 -m pytest tests/ -v

# report-creator MCP server 测试与 eval
cd plugins/kai-report-creator/mcp-servers/report-renderer
npm install
npm test
npm run eval
```

## Plugin Registry

`registry.json` 声明可用插件，供 `xiaok plugin search` 使用。发布前需要同步插件目录、更新 registry/plugin 版本，并运行 renderer 测试与 eval。
