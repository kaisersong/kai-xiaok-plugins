# kai-xiaok-plugins

xiaok AI 工作台的内容生成插件集合。

## 插件

| 插件 | 说明 | MCP Server |
|------|------|------------|
| kai-slide-creator | HTML 幻灯片生成，22 种风格预设 | Python (stdio) |
| kai-report-creator | HTML 报告生成，6 套主题 | Node.js (stdio) |

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

### 本地安装

将 plugin 目录软链接到 xiaok plugins 目录：

```bash
ln -sfn ~/projects/kai-xiaok-plugins/plugins/kai-slide-creator ~/.xiaok/plugins/kai-slide-creator
ln -sfn ~/projects/kai-xiaok-plugins/plugins/kai-report-creator ~/.xiaok/plugins/kai-report-creator
```

### 测试

```bash
# slide-creator tests
cd plugins/kai-slide-creator/mcp-servers/slide-renderer
pip3 install -r requirements.txt
python3 -m pytest tests/ -v

# slide-creator plugin-level tests
cd plugins/kai-slide-creator
python3 -m pytest tests/ -v

# report-creator tests
cd plugins/kai-report-creator/mcp-servers/report-renderer
npm install
npx vitest run
```

## 用户安装

```bash
# 从 GitHub Release 下载
curl -L https://github.com/kaisersong/kai-xiaok-plugins/releases/latest/download/kai-slide-creator.tar.gz | tar xz -C ~/.xiaok/plugins/
curl -L https://github.com/kaisersong/kai-xiaok-plugins/releases/latest/download/kai-report-creator.tar.gz | tar xz -C ~/.xiaok/plugins/

# 安装依赖
pip3 install -r ~/.xiaok/plugins/kai-slide-creator/mcp-servers/slide-renderer/requirements.txt
cd ~/.xiaok/plugins/kai-report-creator/mcp-servers/report-renderer && npm install && npm run build
```

## 发布

```bash
# 打包
tar czf kai-slide-creator.tar.gz -C plugins kai-slide-creator
tar czf kai-report-creator.tar.gz -C plugins kai-report-creator

# 创建 GitHub Release 并上传
gh release create v1.0.0 kai-slide-creator.tar.gz kai-report-creator.tar.gz
```