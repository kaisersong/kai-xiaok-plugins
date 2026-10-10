# 自定义主题

在这个目录下放置文件夹，即可为 kai-report-creator 添加自己的主题。

## 目录结构

```
themes/
  your-theme-name/
    reference.md   ← 风格描述文件（AI 读取后生成 CSS 变量）
    theme.css      ← 直接定义 CSS（可选，优先级高于 reference.md）
```

两种文件可以单独使用，也可以同时存在：

| 情况 | 行为 |
|------|------|
| 只有 `reference.md` | AI 读取风格描述，推导并生成 `:root` CSS 变量 |
| 只有 `theme.css` | 直接使用该文件中的 CSS 变量，完全可预期 |
| 两者都有 | `theme.css` 优先；`reference.md` 作为风格说明供参考 |

## 调用方式

```bash
/report --theme your-theme-name "报告主题"
```

或在 `.report.md` 的 frontmatter 中指定：

```yaml
theme: your-theme-name
```

## reference.md 格式

```markdown
# 主题名称 — 风格参考

一句话描述。灵感来源 / 美学风格 / 氛围。

---

## Colors

​```css
:root {
  --primary:      #...;   /* 主色，用于标题下划线、链接、强调 */
  --bg:           #...;   /* 页面背景 */
  --surface:      #...;   /* 卡片背景 */
  --text:         #...;   /* 正文 */
  --text-muted:   #...;   /* 次要文字 */
  --border:       #...;   /* 边框/分割线 */
}
​```

## Typography

字体选择说明。衬线 or 无衬线？几何 or 人文？推荐 Google Fonts 链接。

## Layout

留白风格、卡片圆角、最大宽度等布局偏好。

## Best For

适用场景：品牌报告、研究文档、内部周报……
```

## theme.css 格式

直接定义 `:root` CSS 变量，覆盖内置主题的默认值。

```css
:root {
  --primary:      #C2410C;  /* 主色 */
  --primary-light:#FFF7ED;  /* 主色浅色背景 */
  --accent:       #EA580C;  /* 强调色 */
  --bg:           #FFFBF7;  /* 页面背景 */
  --surface:      #FFFFFF;  /* 卡片背景 */
  --text:         #1C1917;  /* 正文 */
  --text-muted:   #78716C;  /* 次要文字 */
  --border:       #E7E5E4;  /* 边框 */
  --font-sans:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
  --radius:       6px;
}
```

可用变量参考内置主题 `templates/themes/corporate-blue.css`。

## 注意事项

- 以 `_` 开头的目录（如 `_example-warm-editorial`）会被自动忽略，不会出现在主题列表中
- 主题名只支持字母、数字和连字符，例如 `my-brand`、`warm-editorial`
- 自定义主题与内置主题同等优先级，同名时自定义主题优先

## 内置：forest-editorial（米绿纸感编辑风）

`themes/forest-editorial/` —— 米绿纸底（`#f5f7f3`）+ 标题区深林绿锚块
（`#102d27`，带金色 eyebrow 细线）+ 17–26px 大圆角与柔和长阴影。
适合「整体要浅色易读、但需要一块深色视觉锚点」的报告。

```yaml
theme: forest-editorial
```

主题绿走 `.kpi-card` 顶边，而不是 KPI 数字 —— `shared.css` 刻意把
`.kpi-value` 锁为中性色，本主题遵守该约定。图表配色（ECharts 不读 CSS 变量）
写在 `theme.css` 顶部的 `chart palette:` 注释里。

## 预设：radar-board（dark-board + 一个 override）

`dark-board` 的情报盘风味。它是**预设而非独立主题**：冻结夹具换肤对比显示，
它与 `dark-board` 的差别只有 accent 色，不值得在主题表里单独占一行。

```yaml
theme: dark-board
theme_overrides:
  primary_color: "#5ee1b4"
```

能力边界：`theme_overrides` 只映射 `primary_color` → `--primary` 与
`font_family` → `--font-sans`。状态三色、底色微调、KPI 等宽数字、
「最近更新」时间戳栏都**超出 overrides 能力**；要完整 radar 风格需升格为独立
主题（触发条件：≥2 个真实用户显式要求）。

## 用冻结夹具对比主题

判断一个主题是否真的有辨识度，请给**冻结夹具**换肤，而不是各生成一份样张
——AI 渲染的样张在措辞和结构上会漂移，污染对比：

```bash
python tests/fixtures/skin_fixture.py minimal forest-editorial dark-board
python tests/fixtures/skin_fixture.py dark-board --overrides primary_color=#5ee1b4 --label radar-board
```

产物写到 `/tmp/theme-skin/`，并排打开即可。

## 分享主题

将主题文件夹发布为 git 仓库，其他人 clone 进自己的 `themes/` 目录即可使用：

```bash
git clone https://github.com/yourname/report-theme-mybrand \
  ~/.claude/skills/report-creator/themes/mybrand
```
