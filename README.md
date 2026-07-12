# kai-xiaok-plugins

[xiaok](https://github.com/kaisersong/xiaok-cli) AI 工作台的随包插件集合。通过 MCP（Model Context Protocol）为 xiaok 提供可验证、可复现的内容生成、本地转写和桌面自动化能力。

[English](#english) | [简体中文](README.zh-CN.md)

## 插件一览

| 插件 | 说明 | MCP Server | 语言 |
|------|------|------------|------|
| [kai-slide-creator](plugins/kai-slide-creator) | HTML 幻灯片生成，22 种风格预设 | slide-renderer | Python |
| [kai-report-creator](plugins/kai-report-creator) | HTML 报告生成，8 套主题，含 KPI/摘要质量门禁 | report-renderer | Node.js |
| [kai-infinity-canvas](plugins/kai-infinity-canvas) | tldraw 本地无限画布，支持手绘、标注、图片插入和导出 | canvas-server | Node.js |
| [kai-meeting-assistant](plugins/kai-meeting-assistant) | AI 录音的本地 Whisper 转写回退与会议纪要总结 | meeting-transcriber | Python |

## 当前发布基线

- Xiaok Desktop v1.4.22 继续把本仓库作为随包插件来源；release workflow 会从默认分支 checkout 本仓库，因此打 tag 前必须保证插件 README、registry 和 renderer bundle 构建说明已经同步。
- `kai-slide-creator` 当前注册版本为 `3.2.0`，用于 HTML 演示文稿/幻灯片生成。
- `kai-report-creator` 当前注册版本为 `2.1.0`，用于 HTML 报告、看板、KPI 摘要和可导出交互报告。
- `kai-infinity-canvas` 当前注册版本为 `0.1.0`，用于本地无限画布、图片标注、MCP 图片插入和 PNG/SVG 导出。
- `kai-meeting-assistant` 首次以 `0.1.0` 注册，提供本地 Whisper 文件转写回退、TLS 证书链兼容和会议纪要总结 skill；Sherpa-ONNX、阿里云、火山引擎、实时录音和标点恢复仍由 Xiaok Desktop 核心负责。
- 桌面端 release workflow 会 checkout 本仓库，构建 `kai-report-creator` 的 `report-renderer` bundle，并下载 slide renderer 所需 Python wheels 后再打包 macOS/Windows 安装器。
- v1.4.22 Desktop 打包会同时带上 `kai-infinity-canvas/scripts/**` 和 `kai-meeting-assistant` 的 plugin manifest、skill、Python server 与 requirements；安装包内可启动画布，并可在 Whisper 回退路径中找到转写 server。
- `kai-infinity-canvas` 预览层继续缩小并降低 tldraw watermark 透明度，避免水印遮挡画布内容。
- 插件边界保持不变：LLM 生成结构化 IR，MCP renderer 负责确定性 HTML/CSS/JS 输出、shell 结构和质量门禁。
- Xiaok v1.4.22 的自动化/Loop 输出预览、知识库产物预览、Canvas 产物编辑、Canvas PDF 渲染和 AI 录音保存的知识来源会复用同一套 artifact/knowledge 预览边界：插件负责提供确定性工具与可检查产物，Xiaok 负责把结果挂到任务、loop、项目、知识库或编辑界面。
- Xiaok Desktop 的麦克风采集、Sherpa-ONNX 实时转写、阿里云/火山引擎在线 ASR、标点恢复、模型管理和录音悬浮窗属于 Desktop 核心能力；`kai-meeting-assistant` 只提供本地 Whisper 回退和总结 skill，不保存用户 ASR key。
- v2.1.0 report renderer 继续加强正文 Markdown 解析：章节内标题、列表、表格、inline strong/em/code 会转成正式 HTML，避免报告预览出现未渲染 Markdown 或不可读转义字符。
- Xiaok v1.4.22 的插件 baseline 为 slide `3.2.0`、report `2.1.0`、canvas `0.1.0`、meeting assistant `0.1.0`。

## 快速安装

### 方式一：通过 xiaok CLI（推荐）

```bash
xiaok plugin search           # 浏览可用插件
xiaok plugin install kai-slide-creator   # 安装幻灯片插件
xiaok plugin install kai-report-creator  # 安装报告插件
xiaok plugin install kai-meeting-assistant  # 安装会议助手插件
```

### 方式二：提示词安装

在 xiaok chat 中直接说：

```
安装插件
```

xiaok 会引导你完成安装。

### 方式三：手动安装（开发模式）

```bash
# Clone 仓库
git clone https://github.com/kaisersong/kai-xiaok-plugins.git

# 软链接到 xiaok plugins 目录
ln -sfn <项目路径>/plugins/kai-slide-creator ~/.xiaok/plugins/kai-slide-creator
ln -sfn <项目路径>/plugins/kai-report-creator ~/.xiaok/plugins/kai-report-creator
ln -sfn <项目路径>/plugins/kai-meeting-assistant ~/.xiaok/plugins/kai-meeting-assistant

# 安装依赖
pip3 install -r plugins/kai-slide-creator/mcp-servers/slide-renderer/requirements.txt
pip3 install -r plugins/kai-meeting-assistant/mcp-servers/meeting-transcriber/requirements.txt
cd plugins/kai-report-creator/mcp-servers/report-renderer && npm install && npm run build
```

## 架构

```
┌─────────────────────────────────────────────┐
│                xiaok CLI                     │
│  ┌───────────────────────────────────────┐  │
│  │         LLM (user prompt)              │  │
│  │  "帮我做一份Q3销售报告"                  │  │
│  └──────────────┬────────────────────────┘  │
│                 │                           │
│  ┌──────────────▼────────────────────────┐  │
│  │   skill: kai-slide/report-creator     │  │
│  │   LLM 生成结构化 IR                    │  │
│  └──────────────┬────────────────────────┘  │
│                 │                           │
│  ┌──────────────▼────────────────────────┐  │
│  │   mcp__*-renderer__render_*           │  │
│  │   MCP Server (Python/Node stdio)      │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  validate_ir()/validate_brief()  │  │  │
│  │  │  deterministic render            │  │  │
│  │  │  shell + quality gates           │  │  │
│  │  │  → presentation/report.html      │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 设计思想

**核心设计：LLM 只生成结构化 IR，MCP Server 负责确定性渲染。** slide 插件使用 `BRIEF.json`，report 插件使用 `.report.md` IR 字符串；HTML、CSS、JavaScript 都由 MCP renderer 输出，避免让 LLM 手写最终 HTML。

**为什么这样设计：**

- **可复现**：同一份 IR 经过同一 renderer 输出一致的 HTML，便于测试、回归和发布。
- **低上下文成本**：skill 只保留路由和约束，复杂渲染逻辑沉到 MCP server、schema、tests 和 evals。
- **质量门禁前置**：报告不是“生成完再肉眼看”，而是在渲染链路里检查结构、主题、交互控件、KPI 数值和摘要 JSON。
- **开发态评测，不影响运行时**：evals、unit tests、quality gates 在开发/发布时执行；用户正常使用插件时只走 IR 解析和 deterministic render，不额外跑评测套件。

### Report Creator Eval 设计

`kai-report-creator` 的评测分两层：

1. **Agent/Skill 行为评测**：沿用 OpenAI skills eval 的四类目标，验证 agent 是否真的按技能工作。
2. **Renderer 确定性评测**：验证 MCP renderer 对固定 IR 的输出是否满足 shell、主题、组件、性能和数据质量约束。

四类 agent/skill 目标：

| 目标 | 问题 | report 插件对应检查 |
|------|------|--------------------|
| Outcome | 任务完成了吗？应用/产物能运行吗？ | 是否生成 HTML，是否通过 shell/HTML gate，负例是否避免误触发 |
| Process | 是否调用技能并遵循预期步骤？ | 是否走 IR → validate → render，不手写 HTML，不保存中间 `.report.md` |
| Style | 输出是否符合约定？ | 主题、摘要卡、导出菜单、TOC、KPI 数值、badge、表格/图表规范 |
| Efficiency | 是否避免 thrashing 和过度消耗？ | 渲染耗时、命令数量、失败命令、上下文读取范围、token 指标 |

当前插件 renderer eval rubric：

| 评分项 | 权重 | 含义 |
|--------|------|------|
| L0 validation | 25 | 无 `:::` 泄漏，存在 `ir-hash` |
| L1 shell | 20 | HTML shell 结构完整 |
| L2 IDs | 20 | TOC、摘要卡、编辑、导出、`report-summary` 等必需 ID 完整 |
| L3 output quality | 15 | 可见 KPI 和 `report-summary.kpis` 都包含真实数字 |
| Component accuracy | 10 | 组件渲染为正确 HTML 结构，无 unknown/empty 组件 |
| Theme integrity | 5 | CSS 正常加载，无主题 fallback 错误 |
| Performance | 5 | 典型报告渲染耗时 < 500ms |

最近一次提交前验证结果：

| 范围 | 命令 | 结果 |
|------|------|------|
| report-renderer unit tests | `npm test` | 5 个 test files，180/180 tests passed |
| report-renderer evals | `npm run eval` | 3/3 cases passed，平均分 100/100，平均耗时 4ms |
| report CLI smoke | `node dist/cli.js render ... --theme regular-lumen` | L0/L1/L2/L3 全通过 |
| standalone gate 兼容 | `python3 scripts/html_quality_gate.py /tmp/kai-report-plugin-regular-lumen.html` | `status=valid` |

## 目录结构

```
kai-xiaok-plugins/
├── README.md
├── registry.json           # 插件注册表（xiaok plugin search 读取）
├── scripts/
│   └── vendor.sh           # 从源 repo 同步渲染引擎
├── plugins/
│   ├── kai-slide-creator/
│   │   ├── plugin.json
│   │   ├── skills/slide-planner/SKILL.md    # 精简版 skill（IR + MCP 规则）
│   │   ├── mcp-servers/slide-renderer/      # Python MCP Server
│   │   │   ├── server.py
│   │   │   ├── low_context.py               # 渲染引擎
│   │   │   ├── validate_html.py             # 质量检查
│   │   │   └── tests/                       # 27 个测试
│   │   ├── references/                      # 22 个风格预设
│   │   ├── schemas/                         # BRIEF.json schema
│   │   └── tests/                           # 13 个集成测试
│   └── kai-report-creator/
│       ├── plugin.json
│       ├── skills/report-planner/SKILL.md
│       ├── mcp-servers/report-renderer/     # Node.js MCP Server
│       │   └── src/
│       └── evals/                          # Renderer eval cases + rubric
```

## 开发

### 同步渲染引擎

源 repo 修改后，运行 vendor 脚本同步到 plugin 目录：

```bash
./scripts/vendor.sh slide-creator   # 同步 slide-creator
./scripts/vendor.sh report-creator  # 同步 report-creator
./scripts/vendor.sh all             # 同步全部
```

源 repo 路径默认：
- slide-creator → `~/projects/slide-creator`
- report-creator → `~/projects/kai-report-creator`

可通过环境变量覆盖：
```bash
SLIDE_CREATOR_REPO=/path/to/slide-creator ./scripts/vendor.sh slide-creator
```

### 运行测试

```bash
# slide-creator MCP server 测试（27 tests）
cd plugins/kai-slide-creator/mcp-servers/slide-renderer
pip3 install -r requirements.txt
python3 -m pytest tests/ -v

# slide-creator 集成测试（13 tests）
cd plugins/kai-slide-creator
python3 -m pytest tests/ -v

# report-creator MCP server 测试（180 tests）
cd plugins/kai-report-creator/mcp-servers/report-renderer
npm install
npm test

# report-creator evals（L0/L1/L2/L3 + component/theme/performance）
npm run eval
```

report eval 的当前通过标准是 `80/100`；常规发布前要求所有 eval cases 通过，且平均渲染耗时保持在毫秒级。最近一次验证为 `3/3` cases passed，平均分 `100/100`，平均耗时 `4ms`。

## Plugin Registry

`registry.json` 声明可用插件，供 `xiaok plugin search` 使用。

```json
{
  "version": 1,
  "repo": "kaisersong/kai-xiaok-plugins",
  "plugins": [
    {
      "name": "kai-slide-creator",
      "display_name": "幻灯片生成器",
      "repo": "kaisersong/kai-xiaok-plugins",
      "path": "plugins/kai-slide-creator",
      "version": "3.2.0"
    },
    {
      "name": "kai-report-creator",
      "display_name": "报告生成器",
      "repo": "kaisersong/kai-xiaok-plugins",
      "path": "plugins/kai-report-creator",
      "version": "2.1.0"
    }
  ]
}
```

## 发布流程

```bash
# 1. 同步渲染引擎
./scripts/vendor.sh all

# 2. 更新 registry 版本
# 编辑 registry.json 中的 version 字段

# 3. 提交并推送到 GitHub
git add -A && git commit -m "release: v3.2.0"
git push

# 4. 创建 GitHub Release
gh release create v3.2.0 --generate-notes
```

## English

`kai-xiaok-plugins` is the bundled plugin collection for the [xiaok](https://github.com/kaisersong/xiaok-cli) AI workspace. It provides deterministic content renderers, local transcription fallback, and desktop automation integrations through MCP and skills.

### Plugins

| Plugin | Description | MCP Server | Runtime |
|--------|-------------|------------|---------|
| [kai-slide-creator](plugins/kai-slide-creator) | HTML slide decks with 22 style presets | slide-renderer | Python |
| [kai-report-creator](plugins/kai-report-creator) | HTML reports with 8 themes and KPI/summary quality gates | report-renderer | Node.js |
| [kai-infinity-canvas](plugins/kai-infinity-canvas) | Local tldraw infinite canvas with drawing, annotations, image insertion, and export | canvas-server | Node.js |
| [kai-meeting-assistant](plugins/kai-meeting-assistant) | Local Whisper fallback and meeting-summary skill for AI Recording | meeting-transcriber | Python |

### Current Release Baseline

- Xiaok Desktop v1.4.22 continues to package this repository as the bundled plugin source. The desktop release workflow checks out the default branch, so README, registry, and renderer build guidance must be synchronized before the release tag is pushed.
- `kai-slide-creator` is registered at `3.2.0` for HTML presentation and slide generation.
- `kai-report-creator` is registered at `2.1.0` for HTML reports, dashboards, KPI summaries, and exportable interactive reports.
- `kai-infinity-canvas` is registered at `0.1.0` for local infinite canvas sessions, image annotation, MCP image insertion, and PNG/SVG export.
- `kai-meeting-assistant` is first registered at `0.1.0` for local Whisper file-transcription fallback, TLS certificate-chain compatibility, and the meeting-summary skill. Sherpa-ONNX, Alibaba Cloud, Volcengine, live recording, and punctuation restoration remain Desktop core responsibilities.
- The xiaok Desktop release workflow checks out this repository, builds the `kai-report-creator` `report-renderer` bundle, downloads the Python wheels needed by the slide renderer, and then packages macOS/Windows installers.
- v1.4.22 Desktop packaging includes both `kai-infinity-canvas/scripts/**` and the `kai-meeting-assistant` manifest, skill, Python server, and requirements, so installed builds retain the canvas runtime and the Whisper fallback path.
- `kai-infinity-canvas` preview keeps the smaller preview layer and lower tldraw watermark opacity so the watermark does not block canvas content.
- Plugins keep the core boundary intact: the LLM emits structured IR, while MCP renderers own deterministic HTML/CSS/JS output, shell structure, and quality gates.
- Xiaok v1.4.22 Automations/Loop output previews, Knowledge Base artifact previews, Canvas artifact editing, Canvas PDF rendering, and knowledge sources saved from AI Recording reuse the same artifact/knowledge preview boundary: plugins provide deterministic tools and inspectable artifacts, while Xiaok attaches, previews, edits, or displays results through Desktop surfaces.
- v2.1.0 report renderer improves prose Markdown rendering: nested headings, lists, tables, and inline strong/em/code become formal HTML instead of leaking raw Markdown or over-escaped text into report previews.
- Microphone capture, Sherpa-ONNX streaming, Alibaba Cloud and Volcengine ASR, punctuation restoration, model management, and recorder-window UI remain Xiaok Desktop core capabilities. `kai-meeting-assistant` does not store user ASR credentials.
- The Xiaok v1.4.22 plugin baseline is slide `3.2.0`, report `2.1.0`, canvas `0.1.0`, and meeting assistant `0.1.0`.

### Design Philosophy

The LLM should not hand-write production HTML. It generates a constrained intermediate representation instead: `BRIEF.json` for slides and `.report.md` IR for reports. The MCP server validates the IR, renders deterministic HTML, and applies shell/quality gates.

This gives the plugins four important properties:

- **Reproducibility**: same IR plus same renderer produces the same artifact.
- **Low context cost**: skills stay small; rendering rules live in server code, schemas, tests, and evals.
- **Quality by contract**: required shell IDs, export controls, summary metadata, theme CSS, and numeric KPI values are checked programmatically.
- **No runtime eval overhead**: eval suites run during development and release verification, not during normal user rendering.

### Eval Design

The report creator uses two eval layers:

| Layer | Purpose |
|-------|---------|
| Agent/skill evals | Follow the OpenAI skills eval model: outcome, process, style, and efficiency goals. |
| Renderer evals | Score deterministic renderer output for shell validity, component rendering, theme integrity, KPI quality, and performance. |

OpenAI-style skill goals are mapped as follows:

| Goal | What it asks | Report plugin signal |
|------|--------------|----------------------|
| Outcome | Did the task complete and does the artifact run? | HTML artifact exists, shell gates pass, negative cases do not generate reports. |
| Process | Did the agent invoke the skill and follow the intended steps? | IR → validate → render path is used; the agent does not hand-write HTML. |
| Style | Does the output follow conventions? | Theme, summary card, export menu, TOC, numeric KPI values, badges, tables, and charts follow contract. |
| Efficiency | Did it avoid thrashing or excessive context use? | Render time, command count, failed command count, read scope, and token metrics are tracked. |

Current report renderer rubric:

| Metric | Weight | Meaning |
|--------|--------|---------|
| L0 validation | 25 | No raw `:::` leakage and `ir-hash` is present. |
| L1 shell | 20 | HTML shell structure is complete. |
| L2 IDs | 20 | Required TOC, summary, edit, export, and `report-summary` IDs are present. |
| L3 output quality | 15 | Visible KPI values and `report-summary.kpis` contain real numbers. |
| Component accuracy | 10 | Components render to correct HTML with no unknown/empty component output. |
| Theme integrity | 5 | CSS loads correctly with no theme fallback errors. |
| Performance | 5 | Typical report render time stays below 500ms. |

Latest pre-push verification:

| Scope | Command | Result |
|-------|---------|--------|
| report-renderer unit tests | `npm test` | 5 test files, 180/180 tests passed |
| report-renderer evals | `npm run eval` | 3/3 cases passed, average score 100/100, average time 4ms |
| report CLI smoke | `node dist/cli.js render ... --theme regular-lumen` | L0/L1/L2/L3 all true |
| standalone gate compatibility | `python3 scripts/html_quality_gate.py /tmp/kai-report-plugin-regular-lumen.html` | `status=valid` |
