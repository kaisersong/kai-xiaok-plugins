# kai-xiaok-plugins

[English](README.md) | 简体中文

[Xiaok](https://github.com/kaisersong/xiaok-cli) AI 工作台的随包 skill 与 MCP 工具集合：确定性报告和幻灯片、本地画布、会议转写回退及 macOS Computer Use。Xiaok CLI / Desktop 负责模型执行、用户交互、权限和插件生命周期。

## 插件一览

以下版本取自当前 `plugin.json`，按 **2026-09-07** 的源码核对。

| 插件 | 版本 | 用途 | MCP server / 运行时 |
|---|---|---|---|
| [kai-slide-creator](plugins/kai-slide-creator) | 3.3.0 | 将结构化 brief 渲染为 HTML 幻灯片，提供风格预设和校验 | slide-renderer / Python |
| [kai-report-creator](plugins/kai-report-creator) | 2.3.0 | 将报告 IR 渲染为 HTML，提供主题、封面和 KPI 质量门禁 | report-renderer / Node.js |
| [kai-infinity-canvas](plugins/kai-infinity-canvas) | 0.2.0 | 本地 tldraw 画布、标注、图片插入和 PNG/SVG 导出 | canvas-server / Node.js |
| [kai-meeting-assistant](plugins/kai-meeting-assistant) | 0.1.0 | 本地 Whisper 文件转写回退和会议纪要 skill | meeting-transcriber / Python |
| [cua-computer-use](plugins/cua-computer-use) | 0.2.1 | 用户启用并完成授权后，观察和操作 macOS 应用 | cua-driver / 仅 macOS |

## 当前发布基线

- Xiaok Desktop 已发布版本为 **1.5.1**；release workflow 固定检出本仓库的 **`desktop-v1.5.1`** 快照，工作区变更不会自动进入该安装包。
- Desktop 打包上述五个插件。实际可用性取决于平台、运行时就绪和激活要求；Windows / Linux 不提供 Computer Use。
- slide/report manifest 声明 modern MCP stdio 及启动/调用超时。report 使用 `dist/server.bundle.js`；Python renderer 需要匹配的随包 runtime 与 wheels。
- CuaDriver 显式使用 `legacy` adapter；会议转写保持 MCP 1.x runtime。协议以各自 manifest 为准。
- Desktop 负责麦克风采集、Sherpa-ONNX 实时 ASR、用户配置的阿里云/火山引擎 ASR、标点、模型管理、录音界面和知识保存。会议插件只提供 Whisper 回退与总结 skill，不保存用户 ASR key。
- CLI 发现入口使用的旧 `registry.json` 仍列 report **2.2.0**、canvas **0.1.0**；当前 manifest 与 `registry-v2.json` 为 **2.3.0**、**0.2.0**。这是不同索引快照，需核对安装路径后再判断实际安装版本。

## 快速安装

### 通过 Xiaok CLI

```bash
xiaok plugin search
xiaok plugin install kai-slide-creator
xiaok plugin install kai-report-creator
xiaok plugin install kai-meeting-assistant
```

Desktop 部署随包插件，并在设置中显示激活与依赖状态。Computer Use 还需要 macOS 权限及已启用的 CUA Driver。

### 通过提示词

在 Xiaok 中提出“安装报告生成器插件”，检查返回的安装与依赖操作。能否执行取决于当前会话实际提供的插件工具和权限策略。

### 源码开发

```bash
git clone https://github.com/kaisersong/kai-xiaok-plugins.git
cd kai-xiaok-plugins
```

按下文命令构建和测试单个插件。构建 Desktop 时，将本仓库与 `xiaok-cli`、`kswarm`、`intent-broker` 放在同一父目录，打包配置直接读取这些关联目录。

## 架构

```text
Xiaok CLI / Desktop
  ├─ 模型 + 选定 skill → 结构化 IR
  │    └─ MCP renderer → 校验 → 确定性 HTML + evidence
  ├─ canvas MCP → 本地画布 / 图片 / 导出
  ├─ meeting MCP → 本地转写回退
  └─ macOS Computer Use wrapper → 已启用的 CUA Driver

Xiaok 将可检查的结果关联到会话、预览、知识库、
自动化运行或 KSwarm 项目交付物。
```

### 关联项目

| 项目 | 职责 |
|---|---|
| [xiaok-cli](https://github.com/kaisersong/xiaok-cli) | CLI/Desktop、模型与工具执行、SubAgent、Goal、知识库、自动化、插件部署和预览。 |
| [kswarm](https://github.com/kaisersong/kswarm) | 持久化项目、工作流执行状态、任务评审、产物合同和交付。 |
| [intent-broker](https://github.com/kaisersong/intent-broker) | participant、协作空间、事件、审批与可恢复任务交接。 |

renderer 调用成功意味着提供了一个产物；项目审批与定时任务是否成功，还需要 Xiaok 和 KSwarm 的完成检查。

## 设计思想

报告和幻灯片由模型准备结构化 IR：slide 使用 `BRIEF.json`，report 使用 `.report.md`。MCP server 校验 IR、确定性渲染 HTML/CSS/JS，再检查 shell 和输出合同。

- **可复现**：固定 IR 与 renderer 版本，方便检查输出变化和回归测试。
- **精简指令**：skill 说明工具使用方式，详细格式规则由 schema、renderer、tests 和 evals 承担。
- **程序化质量检查**：必需 ID、导出控件、摘要元数据、主题和 KPI 数字由代码验证。
- **开发评测独立运行**：eval 用于开发与发布验证，不在每次用户渲染时额外执行。

### Report Creator Eval 设计

Agent/skill 评测检查交付结果及 agent 如何使用 skill；renderer 评测检查固定 IR 的确定性输出，包括 validation、shell、必需 ID、KPI 质量、组件、主题与性能。以当前 [rubric](plugins/kai-report-creator/evals/rubric.json) 和 [eval cases](plugins/kai-report-creator/evals) 为准。

评测需要检查真实输出，并区分 renderer 通过与端到端任务成功。历史测试数量和耗时不代表当前验证结果。

## 目录结构

```text
kai-xiaok-plugins/
├── registry.json                 # 旧 CLI 发现索引
├── registry-v2.json              # 固定源版本、digest、类型化安装步骤
├── scripts/
│   ├── vendor.sh                 # 同步选定的上游 renderer 源码
│   └── update-registry-v2.mjs    # 从已提交 Git 对象生成索引
├── tests/                        # Registry 完整性测试
└── plugins/
    ├── kai-slide-creator/        # Skill、schema、风格、Python renderer
    ├── kai-report-creator/       # Skill、Node renderer、evals
    ├── kai-infinity-canvas/      # 本地画布应用与 MCP server
    ├── kai-meeting-assistant/    # 会议 skill 与 Python transcriber
    └── cua-computer-use/         # macOS driver 集成
```

## 开发

以下各段均从本仓库根目录执行。Python 测试需使用已安装相应依赖的环境；源码测试不能替代随包 Python runtime 验证。

### 同步渲染引擎

仅在明确要从上游 renderer 仓库更新时运行 vendor，它会复制文件到本仓库，不属于普通安装步骤。

```bash
./scripts/vendor.sh slide-creator
./scripts/vendor.sh report-creator
```

Bash 脚本默认读取 `~/projects/slide-creator`、`~/projects/report-creator`，可通过 `SLIDE_CREATOR_REPO`、`REPORT_CREATOR_REPO` 覆盖。构建前检查复制后的 diff；Windows 执行此脚本需 Bash 兼容环境。

### 构建与测试

Report renderer：

```bash
npm ci --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm run build --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm run build:bundle --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm test --prefix plugins/kai-report-creator/mcp-servers/report-renderer
npm run eval --prefix plugins/kai-report-creator/mcp-servers/report-renderer
```

Slide renderer 与集成测试（按实际环境将 `python3` 换成对应 Python 可执行文件）：

```bash
python3 -m pip install -r plugins/kai-slide-creator/mcp-servers/slide-renderer/requirements.txt
python3 -m pytest plugins/kai-slide-creator/mcp-servers/slide-renderer/tests -q
python3 -m pytest plugins/kai-slide-creator/tests -q
```

会议转写与 registry 测试：

```bash
python3 -m pip install -r plugins/kai-meeting-assistant/mcp-servers/meeting-transcriber/requirements.txt
python3 -m pytest plugins/kai-meeting-assistant/tests -q
node --test tests/registry-integrity.test.mjs
```

修改 runtime / MCP 后，还需跑真实 stdio initialize smoke test 和一个代表性工具调用。Python requirements 不包含全部开发测试依赖，测试环境需要安装 `pytest`。Canvas 应用与 server 验证见其 [README](plugins/kai-infinity-canvas/README.md)。

## Plugin Registry

[registry.json](registry.json) 是 `xiaok plugin search` 使用的旧发现索引；[registry-v2.json](registry-v2.json) 为新版安装器提供固定 source commit、hash 和类型化安装步骤。插件能力、协议、平台和版本以各自 `plugin.json` 为准。

v2 generator 读取**已提交的 Git 对象**，不打包任意工作区文件。先提交并 push 目标源码，确保 source commit 可从 `origin` 的远端引用到达，且工作区干净，再生成索引：

```bash
node scripts/update-registry-v2.mjs --commit <source-commit>
```

提交生成的 registry、恢复干净工作区后，仍针对原始 source commit 验证：

```bash
node scripts/update-registry-v2.mjs --commit <source-commit> --check
```

省略 `--commit` 会选择 HEAD。若 registry 在后续提交中保存，验证时仍需明确原始 source commit。旧索引与 manifest 的版本差异应在明确的插件发布中同步处理。

## 发布流程

1. 更新目标插件源码、manifest 版本和相关索引，检查 vendor diff。
2. 跑插件测试/eval；涉及 report 时构建 bundle，验证 MCP 初始化及代表性产物。
3. 准备并验证目标平台的 runtime closure 与 Python wheels；macOS 和 Windows 资源不能混用。
4. 提交并 push 目标源码快照，从该 commit 生成 v2 元数据；提交 registry 后针对原始 source commit 验证，记录并发布索引修订。
5. 与 Xiaok 关联仓库的发布标签对齐，跑 Desktop packaging contract 并检查未签名的 unpacked app，再进入正式发布。

集成合同见 [Xiaok release workflow](https://github.com/kaisersong/xiaok-cli/blob/master/.github/workflows/desktop-release.yml) 和 [打包配置](https://github.com/kaisersong/xiaok-cli/blob/master/desktop/electron-builder.json)。源码、bundle、registry 验证和发布状态分别检查。
