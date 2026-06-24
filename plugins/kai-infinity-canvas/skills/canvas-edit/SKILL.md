---
name: canvas-edit
description: >
  直接编辑画布内容：添加文字、几何形状（矩形/箭头/椭圆）、移动/删除 shape、
  刷新画布显示。触发词：画布上加文字、canvas add text、画布加形状、
  画布编辑、edit canvas、canvas edit、修改画布、刷新画布、refresh canvas。
  不用于：打开画布（用 canvas-open）、插入图片（用 canvas-insert）、
  AI 生成图片（用 canvas-image-gen）、标注截图（用 canvas-annotate）。
version: 0.1.0
metadata: {"emoji":"✏️","os":["darwin","linux","win32"]}
---

# Canvas Edit

直接编辑画布内容：添加文字、几何形状、移动/删除 shape、刷新画布显示。

## 前置条件

画布服务器必须正在运行（默认 `http://127.0.0.1:43217`）。如果不确定，先检查：

```bash
curl -s http://127.0.0.1:43217/api/health
```

如果返回 `{"status":"ok",...}` 则就绪。如果连接失败，先执行 canvas-open skill。

## 画布 API 总览

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/canvas` | 读取完整画布快照（所有 page + shape + asset） |
| PUT | `/api/canvas` | 保存完整画布快照，自动触发 SSE 刷新 |
| GET | `/api/selection` | 读取当前选中的 shapes |
| POST | `/api/notify` | 仅触发 SSE 刷新（不修改数据，用于手动改了文件后通知前端） |
| GET | `/api/health` | 健康检查 |

**关键规则**：
- `PUT /api/canvas` 会**整体覆盖**画布数据。必须先 GET 读取当前快照，修改后再 PUT 回去。
- `POST /api/notify` 不修改数据，只通知前端"数据变了，请重新加载"。适用于直接改了 canvas.json 文件的场景。
- 画布数据格式是 tldraw snapshot：`{ schema: {...}, store: { "shape:id": {...}, ... } }`

## 工作流

### Step 1：读取当前画布快照

```bash
curl -s http://127.0.0.1:43217/api/canvas
```

返回格式：
```json
{
  "snapshot": {
    "schema": { "schemaVersion": 3, "storeVersion": 4, "recordVersions": {} },
    "store": {
      "page:page": { "typeName": "page", "id": "page:page", "name": "Page 1", "index": "a1", ... },
      "shape:xxx": { "typeName": "shape", "id": "shape:xxx", "type": "text", "parentId": "page:page", ... },
      "asset:yyy": { "typeName": "asset", "id": "asset:yyy", "type": "image", ... }
    }
  },
  "storage": "per-page"
}
```

也可以用 MCP 工具读取结构化摘要（更简洁）：
```
kai_canvas_get_content({ projectDir: "<project>" })
```

### Step 2：根据需求修改快照

#### 添加文字 shape

在 store 中新增一条 shape 记录：

```json
{
  "typeName": "shape",
  "id": "shape:<unique-id>",
  "type": "text",
  "x": 100,
  "y": 200,
  "rotation": 0,
  "index": "a1",
  "parentId": "page:page",
  "opacity": 1,
  "props": {
    "richText": "<text plain=\"true\">要添加的文字</text>",
    "color": "black",
    "size": "m",
    "font": "sans",
    "align": "middle",
    "autoSize": true,
    "w": 200,
    "h": 40
  }
}
```

- `id`：必须是唯一的，格式 `shape:xxx`，用随机字符串或时间戳
- `parentId`：通常是 `page:page`
- `index`：控制 z-order，用 fractional indexing（如 `a1`, `a2`, `b1`）
- `color`：`black` / `light-blue` / `light-red` / `light-green` / `light-violet` / `grey` / `white`
- `size`：`s` / `m` / l` / `xl`
- `x, y`：画布坐标，左上角原点

#### 添加矩形 shape

```json
{
  "typeName": "shape",
  "id": "shape:<unique-id>",
  "type": "geo",
  "x": 100,
  "y": 100,
  "rotation": 0,
  "index": "a1",
  "parentId": "page:page",
  "opacity": 1,
  "props": {
    "geo": "rectangle",
    "w": 200,
    "h": 120,
    "color": "black",
    "fill": "none",
    "dash": "draw",
    "size": "m",
    "font": "sans",
    "text": "",
    "align": "middle",
    "verticalAlign": "middle"
  }
}
```

- `geo`：`rectangle` / `ellipse` / `triangle` / `diamond` / `hexagon` / `cloud` / `star`
- `fill`：`none` / `semi` / `solid`
- `dash`：`draw`（手绘风）/ `solid`（实线）/ `dashed` / `dotted`

#### 添加箭头 shape

```json
{
  "typeName": "shape",
  "id": "shape:<unique-id>",
  "type": "arrow",
  "x": 100,
  "y": 100,
  "rotation": 0,
  "index": "a1",
  "parentId": "page:page",
  "opacity": 1,
  "props": {
    "dash": "draw",
    "size": "m",
    "fill": "none",
    "color": "black",
    "labelColor": "black",
    "bend": 0,
    "arrowheadStart": "none",
    "arrowheadEnd": "arrow",
    "start": { "x": 0, "y": 0, "type": "point" },
    "end": { "x": 200, "y": 0, "type": "point" }
  }
}
```

#### 移动 shape

修改 shape 的 `x` 和 `y` 坐标即可。先 GET 快照，找到目标 shape，修改坐标，PUT 回去。

#### 删除 shape

从 store 中移除对应的 shape 记录。如果该 shape 有关联的 asset（仅 image 类型），通常保留 asset 记录（可能被其他 shape 引用）。

### Step 3：保存修改并刷新画布

**方式 A（推荐）：PUT 整个快照**

修改完成后，把完整快照 PUT 回去，会自动触发 SSE 刷新：

```bash
curl -s -X PUT http://127.0.0.1:43217/api/canvas \
  -H "content-type: application/json" \
  -d '<修改后的完整 snapshot JSON>'
```

**方式 B：手动改了文件后刷新**

如果你直接修改了 `canvas/pages/page/canvas.json` 文件，需要通知前端重新加载：

```bash
curl -s -X POST http://127.0.0.1:43217/api/notify
```

### Step 4：验证

```bash
curl -s http://127.0.0.1:43217/api/canvas | python3 -c "
import sys, json
data = json.load(sys.stdin)
store = data.get('snapshot', {}).get('store', {})
shapes = [v for v in store.values() if v.get('typeName') == 'shape']
print(f'Total shapes: {len(shapes)}')
for s in shapes:
    t = s.get('type', '?')
    text = s.get('props', {}).get('text', '') or s.get('props', {}).get('richText', '')
    print(f'  {s[\"id\"]}: {t} @ ({s.get(\"x\",0):.0f},{s.get(\"y\",0):.0f}) {text[:40]}')
"
```

或用 MCP 工具验证：
```
kai_canvas_get_content({ projectDir: "<project>" })
```

## 注意事项

- **PUT 是全量覆盖**：始终先 GET 再修改再 PUT，不要凭空构造快照。
- **id 唯一性**：新增 shape 时确保 id 不与现有记录冲突。推荐用 `shape:ai-<timestamp>-<random>`。
- **index 冲突**：新增 shape 的 index 不要与同级 shape 重复，否则 z-order 异常。
- **parentId**：确保指向有效的 page id。默认 page 通常是 `page:page`。
- **asset 关联**：不要随意删除 asset 记录，除非确认没有 shape 引用它。
- **大快照**：如果画布内容很多，PUT body 可能较大（几 MB）。服务器限制 50MB。
