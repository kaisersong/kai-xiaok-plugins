# kai-xiaok-plugins

[xiaok](https://github.com/kaisersong/xiaok-cli) AI 工作台的内容生成插件集合。通过 MCP（Model Context Protocol）为 xiaok 提供高质量的 HTML 内容生成能力。

## 插件一览

| 插件 | 说明 | MCP Server | 语言 |
|------|------|------------|------|
| [kai-slide-creator](plugins/kai-slide-creator) | HTML 幻灯片生成，22 种风格预设 | slide-renderer | Python |
| [kai-report-creator](plugins/kai-report-creator) | HTML 报告生成，6 套主题 | report-renderer | Node.js |

## 快速安装

### 方式一：通过 xiaok CLI（推荐）

```bash
xiaok plugin search           # 浏览可用插件
xiaok plugin install kai-slide-creator   # 安装幻灯片插件
xiaok plugin install kai-report-creator  # 安装报告插件
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

# 安装依赖
pip3 install -r plugins/kai-slide-creator/mcp-servers/slide-renderer/requirements.txt
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
│  │      skill: kai-slide-creator         │  │
│  │  LLM 生成 BRIEF.json (IR)              │  │
│  └──────────────┬────────────────────────┘  │
│                 │                           │
│  ┌──────────────▼────────────────────────┐  │
│  │   mcp__slide-renderer__render_slide   │  │
│  │  MCP Server (Python stdio)            │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  validate_brief()                │  │  │
│  │  │  render_from_brief()             │  │  │
│  │  │  validate_html(strict=True)      │  │  │
│  │  │  → presentation.html             │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**核心设计：** LLM 只生成结构化 IR（BRIEF.json），MCP Server 负责确定性渲染。输出始终一致，不依赖 LLM 的 HTML 能力。

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
│       └── evals/
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
```

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
      "version": "3.1.0"
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
git add -A && git commit -m "release: v3.1.0"
git push

# 4. 创建 GitHub Release
gh release create v3.1.0 --generate-notes
```
