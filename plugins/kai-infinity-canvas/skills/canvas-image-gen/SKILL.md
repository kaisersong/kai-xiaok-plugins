---
name: canvas-image-gen
description: >
  在画布上生成 AI 图片。触发词：画布上生成图片、generate image on canvas、
  画布生成、AI 画图到画布。不用于：纯插入已有图片（用 canvas-insert）。
version: 0.2.0
metadata: {"emoji":"🎨","os":["darwin","linux","win32"]}
---

# Canvas AI Image Generation

Generate AI images and place them on the canvas.

## CRITICAL RULES — READ BEFORE ACTING

1. **NEVER claim you generated an image if you didn't.** If you cannot generate
   images, you MUST tell the user honestly. Do NOT hallucinate file paths,
   dimensions, or coordinates.

2. **Check your capability FIRST**: Can you actually generate images in this
   session? If you are a text-only model (no image generation API available),
   go directly to the "Degradation" section below.

3. **NEVER fabricate tool results.** If you call `kai_canvas_insert_image` and
   it fails or you can't call it, tell the user it failed. Do NOT pretend it
   succeeded.

## If you CAN generate images

1. Generate the image and save to `/tmp/canvas-gen-{timestamp}.png`
2. Call the MCP tool to insert it:

```
kai_canvas_insert_image({
  imagePath: "/tmp/canvas-gen-1234567890.png",
  projectDir: "<project>",
  canvasUrl: "http://127.0.0.1:43217"
})
```

3. Report the actual result from the tool call.

## Degradation — If you CANNOT generate images

Tell the user honestly:

> 当前模型不支持图片生成。我可以帮你：
> 1. 在画布上创建一个 AI 图片占位框（按 Ctrl+Shift+A）
> 2. 你上传图片后，我帮你插入到画布
> 3. 如果你有图片 URL，我可以下载并插入

Then create a placeholder by guiding the user to press `Ctrl+Shift+A`.

## AI 图片占位框使用

- 按 `Ctrl+Shift+A` 在视口中心创建占位框
- 选中后样式面板可设尺寸/比例/锁定
- 预设比例：1:1、3:2、2:3、4:3、3:4、16:9、9:16
