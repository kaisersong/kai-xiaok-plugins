---
name: canvas-annotate
description: >
  在画布上标注图片或截图。触发词：标注图片、annotate image、画布标注、
  screenshot annotate、截图标注、标记图片。不用于：生成图片（用 canvas-image-gen）。
version: 0.1.0
metadata: {"emoji":"✏️","os":["darwin","linux","win32"]}
---

# Canvas Annotate

在画布上对图片或截图进行标注。

## 工作流

### 步骤 1：确保画布已打开

如果画布未运行，先启动：

```bash
node /Users/song/projects/kai-xiaok-plugins/plugins/kai-infinity-canvas/scripts/start-canvas.mjs [project-dir]
```

### 步骤 2：放置需要标注的图片

**方式 A — 插入已有图片文件：**

```
kai_canvas_insert_image({
  imagePath: "/path/to/screenshot.png",
  projectDir: "<project>",
  canvasUrl: "http://127.0.0.1:43217",
  placement: "center"
})
```

**方式 B — 使用 AI 图片占位框：**

按 `Ctrl+Shift+A` 创建占位框，然后上传图片。

### 步骤 3：使用 tldraw 原生工具标注

画布已内置以下标注工具（在左侧工具栏）：

| 工具 | 快捷键 | 用途 |
|------|--------|------|
| 箭头 | `A` | 画箭头指向 |
| 文字 | `T` | 添加文字说明 |
| 矩形 | `R` | 框选区域 |
| 椭圆 | `O` | 圆圈标记 |
| 画笔 | `D` | 自由手绘 |
| 高亮 | `H` | 半透明标记 |

### 步骤 4：导出标注结果

点击画布右上角导出按钮：
- **PNG**：导出为位图，适合分享
- **SVG**：导出为矢量图，适合二次编辑

## 截图标注场景

如果用户需要标注屏幕截图：

1. 提示用户截图（macOS: `Cmd+Shift+4`，Windows: `Win+Shift+S`）
2. 将截图保存到临时目录
3. 使用 `kai_canvas_insert_image` 插入到画布
4. 引导用户使用 tldraw 工具进行标注

## 约束

- 如果画布未打开，先提示用户打开画布
- 标注工具是 tldraw 原生功能，无需额外开发
- 导出功能在画布右上角，支持 PNG 和 SVG
