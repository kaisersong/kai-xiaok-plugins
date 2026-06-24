---
name: canvas-image-gen
description: >
  在画布上生成 AI 图片。触发词：画布上生成图片、generate image on canvas、
  画布生成、AI 画图到画布。不用于：纯插入已有图片（用 canvas-insert）。
version: 0.3.0
metadata: {"emoji":"🎨","os":["darwin","linux","win32"]}
---

# Canvas AI Image Generation

在画布上生成 AI 图片。所有操作必须围绕**画布**进行。

## ABSOLUTE PROHIBITIONS — 违反即为失败

1. **绝不生成 HTML 文件作为替代方案。** 不要写 .html、不要打开浏览器、不要"截图保存"。
2. **绝不假装生成了图片。** 不能生成就直说，不要编造假路径、假坐标、假结果。
3. **绝不偏离画布。** 用户要的是图片出现在画布上，不是在浏览器里。
4. **绝不静默失败后转向其他方案。** 如果画布没开、MCP 工具不可用、模型不能生图，必须如实告知用户并给出画布内的替代方案。

## 执行流程

### Step 1: 确保画布已打开

```bash
node /Users/song/projects/kai-xiaok-plugins/plugins/kai-infinity-canvas/scripts/start-canvas.mjs
```

如果输出 `started:` 或 `reuse:`，画布已就绪。

### Step 2: 检查你是否有图片生成能力

问自己：**当前会话是否有 text-to-image API？**

- 如果你有 DALL-E、Stable Diffusion、或其他图片生成工具 → 走 Step 3A
- 如果你是纯文本模型（大多数 coding 模型都是）→ 走 Step 3B

### Step 3A: 可以生成图片

1. 调用图片生成 API，保存 PNG 到 `/tmp/canvas-gen-{timestamp}.png`
2. 用 MCP 工具插入到画布：

```
kai_canvas_insert_image({
  imagePath: "/tmp/canvas-gen-1234567890.png",
  canvasUrl: "http://127.0.0.1:43217"
})
```

3. 报告工具返回的实际结果。如果工具调用失败，告知用户。

### Step 3B: 不能生成图片（常见情况）

诚实告诉用户，然后在画布上创建占位框：

> 当前模型不支持图片生成。我已经在画布上为你创建了 AI 图片占位框。
> 
> 你可以：
> 1. **上传图片**到占位框位置 — 把图片文件路径告诉我，我用 canvas-insert 帮你放进去
> 2. **给我图片 URL** — 我下载后插入到画布
> 3. **手动拖拽** — 直接把图片拖到画布上

然后通过画布的 SSE 机制触发占位框创建（按 Ctrl+Shift+A），或者用 MCP 工具读选区确认占位框已创建。

## 常见错误行为（绝对不要做）

| 错误行为 | 正确做法 |
|---------|---------|
| 生成 HTML 海报代替图片 | 诚实说不能生图，创建画布占位框 |
| 打开浏览器展示 HTML | 在画布上操作 |
| 假装调用了 MCP 工具 | 如实报告工具状态 |
| 让用户"截图保存" | 图片应该在画布上，不是在浏览器里 |
