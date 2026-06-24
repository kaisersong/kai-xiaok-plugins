---
name: canvas-insert
description: >
  将本地图片文件插入到画布上。触发词：插入图片到画布、put image on canvas、
  add image to canvas、把图片放到画布。不用于：AI 生成图片。
version: 0.1.0
metadata: {"emoji":"🖼️","os":["darwin","linux","win32"]}
---

# Canvas Insert Image

Insert a local image file onto the canvas.

## Workflow

1. Read the selected canvas shape (if any) to use as placement anchor:

```bash
# Via MCP tool
kai_canvas_get_selection({ projectDir: "<project>" })
```

2. Call the MCP tool to insert the image:

```bash
kai_canvas_insert_image({
  imagePath: "/path/to/image.png",
  projectDir: "<project>",
  canvasUrl: "http://127.0.0.1:43217",  // optional, for SSE refresh
  anchorShapeId: "<selected-shape-id>",  // optional
  placement: "right",                     // right | left | below
  margin: 40
})
```

3. The tool copies the image to `canvas/pages/<page-id>/assets/`, creates a tldraw
   image asset and shape, and saves. If canvasUrl is provided, the canvas refreshes
   via SSE.

## Notes

- The tool works offline (no HTTP server required). The image appears next time
  the canvas is opened.
- If no anchor is selected, the image is placed in a clear area on the current page.
- The tool avoids overlapping existing shapes.
