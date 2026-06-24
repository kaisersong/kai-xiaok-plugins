import {
  Tldraw,
  useEditor,
  DefaultStylePanel,
  DefaultStylePanelContent,
  DefaultSizeStyle,
  createShapeId,
  createTLStore,
} from 'tldraw'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// ── Constants ─────────────────────────────────────────────────────────

const AI_IMAGE_HOLDER_LABEL = 'AI 图片'
const AI_IMAGE_HOLDER_DEFAULT_W = 512
const AI_IMAGE_HOLDER_DEFAULT_H = 683
const AI_IMAGE_SIZE_MIN = 16
const AI_IMAGE_SIZE_MAX = 8192
const AI_IMAGE_ASPECT_PRESETS = [
  { id: '1-1', label: '1:1', w: 512, h: 512 },
  { id: '3-2', label: '3:2', w: 768, h: 512 },
  { id: '2-3', label: '2:3', w: 512, h: 768 },
  { id: '4-3', label: '4:3', w: 683, h: 512 },
  { id: '3-4', label: '3:4', w: 512, h: 683 },
  { id: '16-9', label: '16:9', w: 1024, h: 576 },
  { id: '9-16', label: '9:16', w: 512, h: 910 },
]

// ── Z-Order: reorder image shapes to back via fractional index ─────────

function reorderImagesToBackInStore(store: Record<string, unknown>): void {
  const shapes = Object.values(store).filter(r => (r as any)?.typeName === 'shape') as any[]
  const imageShapes = shapes.filter(s => s.type === 'image')
  const otherShapes = shapes.filter(s => s.type !== 'image')

  if (imageShapes.length === 0 || otherShapes.length === 0) return

  // Get the lowest index among non-image shapes
  const otherIndexes = otherShapes.map(s => s.index).filter(Boolean).sort()
  if (otherIndexes.length === 0) return

  // Generate new indexes for images, all lower than the first non-image shape
  let prev: string | null = null
  for (const shape of imageShapes) {
    const newKey = generateKeyBetween(prev, otherIndexes[0])
    shape.index = newKey
    prev = newKey
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function isCanvasSnapshot(value: unknown): value is { schema: unknown; store: Record<string, unknown> } {
  return !!value && typeof value === 'object' && !!(value as any).store && !!(value as any).schema
}

function recordsAreEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function storeChangedSinceSnapshot(
  editor: ReturnType<typeof useEditor>,
  baselineStore: Record<string, unknown>
): boolean {
  const currentStore = editor!.store.getStoreSnapshot().store as Record<string, unknown>
  const baselineIds = new Set(Object.keys(baselineStore))

  for (const [id, baselineRecord] of Object.entries(baselineStore)) {
    const currentRecord = currentStore[id]
    if (!currentRecord) return true
    if (!recordsAreEqual(currentRecord, baselineRecord)) return true
  }

  for (const id of Object.keys(currentStore)) {
    if (!baselineIds.has(id)) return true
  }

  return false
}

// ── Snapshot Sanitization ─────────────────────────────────────────────

function firstErrorLine(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error).split('\n')[0]
}

function describeSkippedRecord(record: unknown, reason: unknown) {
  const r = record as Record<string, unknown>
  return {
    id: typeof r?.id === 'string' ? r.id : '(missing id)',
    typeName: typeof r?.typeName === 'string' ? r.typeName : '(missing typeName)',
    type: typeof r?.type === 'string' ? r.type : null,
    reason: firstErrorLine(reason),
  }
}

function getRecordDependencies(record: unknown): string[] {
  const r = record as Record<string, unknown>
  const deps: string[] = []
  if (r?.typeName === 'shape') {
    if (typeof r.parentId === 'string') deps.push(r.parentId)
    const props = r.props as Record<string, unknown> | undefined
    if (r.type === 'image' && props && typeof props.assetId === 'string') {
      deps.push(props.assetId)
    }
  }
  if (r?.typeName === 'binding') {
    const fromId = (r.fromId ?? (r.props as Record<string, unknown>)?.fromId) as string | undefined
    const toId = (r.toId ?? (r.props as Record<string, unknown>)?.toId) as string | undefined
    if (typeof fromId === 'string') deps.push(fromId)
    if (typeof toId === 'string') deps.push(toId)
  }
  return deps
}

function pruneRecordsWithMissingDependencies(
  store: Record<string, unknown>,
  skippedRecords: ReturnType<typeof describeSkippedRecord>[]
): Record<string, unknown> {
  const prunedStore = { ...store }
  let changed = true

  while (changed) {
    changed = false
    for (const record of Object.values(prunedStore)) {
      const missingDep = getRecordDependencies(record).find((id) => !prunedStore[id])
      if (!missingDep) continue

      const r = record as Record<string, unknown>
      delete prunedStore[r.id as string]
      skippedRecords.push(describeSkippedRecord(record, `Missing dependent record: ${missingDep}`))
      changed = true
    }
  }

  return prunedStore
}

function sanitizeCanvasSnapshotForTldraw(snapshot: unknown): {
  snapshot: { schema: unknown; store: Record<string, unknown> } | null
  skippedRecords: ReturnType<typeof describeSkippedRecord>[]
} {
  if (!isCanvasSnapshot(snapshot)) {
    return { snapshot: null, skippedRecords: [] }
  }

  const validationStore = createTLStore()
  const skippedRecords: ReturnType<typeof describeSkippedRecord>[] = []
  let migratedSnapshot: { schema: unknown; store: Record<string, unknown> }

  try {
    migratedSnapshot = validationStore.migrateSnapshot(snapshot as any)
  } catch (error) {
    // Migration failed — try fallback: load records raw without schema migration
    try {
      validationStore.clear()
      for (const record of Object.values((snapshot as any).store)) {
        try { validationStore.put([record as any], 'initialize') } catch {}
      }
      const fallbackStore = validationStore.getStoreSnapshot()
      return {
        snapshot: { schema: fallbackStore.schema, store: fallbackStore.store as Record<string, unknown> },
        skippedRecords: [],
      }
    } catch {
      return {
        snapshot: null,
        skippedRecords: [{ id: '(snapshot)', typeName: 'snapshot', type: null, reason: firstErrorLine(error) }],
      }
    }
  }

  const validStore: Record<string, unknown> = {}
  for (const record of Object.values(migratedSnapshot.store)) {
    try {
      validationStore.put([record as any], 'initialize')
      const stored = validationStore.get((record as any).id)
      if (stored) validStore[(record as any).id] = stored
    } catch (error) {
      skippedRecords.push(describeSkippedRecord(record, error))
    }
  }

  return {
    snapshot: {
      schema: migratedSnapshot.schema,
      store: pruneRecordsWithMissingDependencies(validStore, skippedRecords),
    },
    skippedRecords,
  }
}

/** Apply remote snapshot with race protection */
function applyRemoteCanvasSnapshot(
  editor: ReturnType<typeof useEditor>,
  snapshot: unknown,
  options: { preserveLocalChanges?: boolean } = {}
): { changedRecords: number; skippedRecords: ReturnType<typeof describeSkippedRecord>[] } {
  if (!isCanvasSnapshot(snapshot)) return { changedRecords: 0, skippedRecords: [] }

  const sanitized = sanitizeCanvasSnapshotForTldraw(snapshot)
  if (!sanitized.snapshot) return { changedRecords: 0, skippedRecords: sanitized.skippedRecords }

  // Reorder images to back so annotations (arrows, text) always appear on top
  reorderImagesToBackInStore(sanitized.snapshot.store)

  const recordsToPut = Object.values(sanitized.snapshot.store).filter((record) => {
    const r = record as Record<string, unknown>
    const localRecord = editor!.store.get(r.id as string)
    if (!localRecord) return true
    if (options.preserveLocalChanges) return false
    return !recordsAreEqual(localRecord, record)
  })

  if (recordsToPut.length === 0) {
    return { changedRecords: 0, skippedRecords: sanitized.skippedRecords }
  }

  let changedRecords = 0
  editor!.store.mergeRemoteChanges(() => {
    for (const record of recordsToPut) {
      try {
        editor!.store.put([record as any])
        changedRecords += 1
      } catch (error) {
        sanitized.skippedRecords.push(describeSkippedRecord(record, error))
      }
    }
  })

  return { changedRecords, skippedRecords: sanitized.skippedRecords }
}

// ── AI Image Holder ───────────────────────────────────────────────────

function getAiImageHolderMeta() {
  return { kaiAiImageHolder: true, kaiAiImageHolderVersion: 1 }
}

function isAiImageHolderShape(shape: unknown): boolean {
  const s = shape as Record<string, unknown>
  const meta = s?.meta as Record<string, unknown> | undefined
  return s?.type === 'frame' && meta?.kaiAiImageHolder === true
}

function createAiImageHolderAtViewportCenter(editor: ReturnType<typeof useEditor>) {
  const zoom = editor!.getZoomLevel()
  const w = AI_IMAGE_HOLDER_DEFAULT_W / Math.max(zoom, 0.1)
  const h = AI_IMAGE_HOLDER_DEFAULT_H / Math.max(zoom, 0.1)
  const center = editor!.getViewportPageBounds().center
  const id = createShapeId()

  editor!.createShape({
    id,
    type: 'frame',
    x: center.x - w / 2,
    y: center.y - h / 2,
    meta: getAiImageHolderMeta(),
    props: { w, h, name: AI_IMAGE_HOLDER_LABEL, color: 'blue' },
  })
  editor!.select(id)
  editor!.setCurrentTool('select.idle')
}

function clampAiImageSize(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(AI_IMAGE_SIZE_MIN, Math.min(AI_IMAGE_SIZE_MAX, Math.round(value)))
}

function formatAiImageSize(value: number): string {
  return String(Math.round(value))
}

function getAspectIconStyle(preset: { w: number; h: number }) {
  const maxSize = 22
  const scale = Math.min(maxSize / preset.w, maxSize / preset.h)
  return {
    width: `${Math.max(8, Math.round(preset.w * scale))}px`,
    height: `${Math.max(8, Math.round(preset.h * scale))}px`,
  }
}

// ── Skipped Records Notice ────────────────────────────────────────────

function SkippedRecordsNotice({ records, onDismiss }: { records: ReturnType<typeof describeSkippedRecord>[]; onDismiss: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  if (!records.length || dismissed) return null

  return (
    <aside className="kai-canvas-skipped-records" aria-live="polite">
      <button
        className="kai-canvas-dismiss"
        onClick={() => { setDismissed(true); onDismiss() }}
        aria-label="关闭提示"
        type="button"
      >×</button>
      <strong>已跳过 {records.length} 条无效记录。</strong>
      <span>有效内容已正常加载。</span>
      <details>
        <summary>详情</summary>
        <ul>
          {records.slice(0, 8).map((record, index) => (
            <li key={`${record.id}:${index}`}>
              <code>{record.id}</code>
              {record.typeName ? ` ${record.typeName}` : ''}
              {record.type ? `/${record.type}` : ''}: {record.reason}
            </li>
          ))}
        </ul>
      </details>
    </aside>
  )
}

// ── AI Image Size Panel ───────────────────────────────────────────────

function AiImageSizePanel({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const selectedShapes = editor.getSelectedShapes()
  const aiImageShape = selectedShapes.find(isAiImageHolderShape) as Record<string, any> | undefined

  const [widthValue, setWidthValue] = useState('')
  const [heightValue, setHeightValue] = useState('')

  const currentWidth = aiImageShape?.props?.w ?? AI_IMAGE_HOLDER_DEFAULT_W
  const currentHeight = aiImageShape?.props?.h ?? AI_IMAGE_HOLDER_DEFAULT_H
  const currentRatio = currentWidth / currentHeight
  const isAspectLocked = aiImageShape?.meta?.kaiAiAspectLocked ?? false
  const activePreset = AI_IMAGE_ASPECT_PRESETS.find((preset) => {
    const presetRatio = preset.w / preset.h
    return Math.abs(currentRatio - presetRatio) < 0.01
  })

  useEffect(() => {
    setWidthValue(formatAiImageSize(currentWidth))
    setHeightValue(formatAiImageSize(currentHeight))
  }, [currentWidth, currentHeight])

  if (!aiImageShape) return null

  function updateAiImageSize(w: number, h: number, historyMark = 'resize-ai-image-holder') {
    const cw = clampAiImageSize(w)
    const ch = clampAiImageSize(h)
    if (!cw || !ch) return

    editor.markHistoryStoppingPoint(historyMark)
    editor.updateShapes([{
      id: aiImageShape.id,
      type: 'frame',
      meta: { ...aiImageShape.meta, kaiAiAspectRatio: cw / ch },
      props: { w: cw, h: ch },
    }])
  }

  function toggleAspectLock() {
    const nextLocked = !isAspectLocked
    editor.markHistoryStoppingPoint('toggle-ai-image-aspect-lock')
    editor.updateShapes([{
      id: aiImageShape.id,
      type: 'frame',
      meta: { ...aiImageShape.meta, kaiAiAspectLocked: nextLocked, kaiAiAspectRatio: currentRatio },
    }])
  }

  function commitWidth(value: string) {
    const nextWidth = clampAiImageSize(Number(value))
    if (!nextWidth) { setWidthValue(formatAiImageSize(currentWidth)); return }
    const nextHeight = isAspectLocked ? Math.round(nextWidth / currentRatio) : currentHeight
    updateAiImageSize(nextWidth, nextHeight)
  }

  function commitHeight(value: string) {
    const nextHeight = clampAiImageSize(Number(value))
    if (!nextHeight) { setHeightValue(formatAiImageSize(currentHeight)); return }
    const nextWidth = isAspectLocked ? Math.round(nextHeight * currentRatio) : currentWidth
    updateAiImageSize(nextWidth, nextHeight)
  }

  function handleNumberKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
    if (event.key === 'Escape') {
      setWidthValue(formatAiImageSize(currentWidth))
      setHeightValue(formatAiImageSize(currentHeight))
      ;(event.currentTarget as HTMLInputElement).blur()
    }
  }

  return (
    <div className="kai-ai-image-style-panel" aria-label="AI 图片尺寸设置">
      <section className="kai-ai-style-section">
        <div className="kai-ai-style-heading"><span>尺寸</span></div>
        <div className="kai-ai-size-row">
          <label className="kai-ai-size-field">
            <span>W</span>
            <input
              aria-label="AI 图片宽度"
              inputMode="numeric"
              min={AI_IMAGE_SIZE_MIN}
              max={AI_IMAGE_SIZE_MAX}
              value={widthValue}
              onChange={(e) => setWidthValue(e.target.value)}
              onBlur={(e) => commitWidth(e.target.value)}
              onKeyDown={handleNumberKeyDown}
            />
          </label>
          <button
            aria-label={isAspectLocked ? '解除宽高比例锁定' : '锁定宽高比例'}
            aria-pressed={isAspectLocked}
            className="kai-ai-aspect-lock"
            onClick={toggleAspectLock}
            type="button"
          >
            <AspectLockIcon locked={isAspectLocked} />
          </button>
          <label className="kai-ai-size-field">
            <span>H</span>
            <input
              aria-label="AI 图片高度"
              inputMode="numeric"
              min={AI_IMAGE_SIZE_MIN}
              max={AI_IMAGE_SIZE_MAX}
              value={heightValue}
              onChange={(e) => setHeightValue(e.target.value)}
              onBlur={(e) => commitHeight(e.target.value)}
              onKeyDown={handleNumberKeyDown}
            />
          </label>
        </div>
      </section>

      <section className="kai-ai-style-section">
        <div className="kai-ai-style-heading"><span>比例</span></div>
        <div className="kai-ai-aspect-grid">
          {AI_IMAGE_ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              aria-pressed={activePreset?.id === preset.id}
              className="kai-ai-aspect-preset"
              onClick={() => updateAiImageSize(preset.w, preset.h, `resize-ai-image-holder:${preset.id}`)}
              type="button"
            >
              <span className="kai-ai-aspect-icon" style={getAspectIconStyle(preset)} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function AspectLockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg aria-hidden="true" className="kai-ai-lock-icon" viewBox="0 0 20 20">
        <rect x="4.5" y="8.5" width="11" height="8" rx="2" />
        <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" className="kai-ai-lock-icon" viewBox="0 0 20 20">
      <rect x="4.5" y="8.5" width="11" height="8" rx="2" />
      <path d="M7 8.5V6.5a3 3 0 0 1 5.8-1.1" />
    </svg>
  )
}

// ── Custom Style Panel wrapper ────────────────────────────────────────

function KaiStylePanel({ children, editor }: { children?: ReactNode; editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <DefaultStylePanel>
      <DefaultStylePanelContent />
      <AiImageSizePanel editor={editor} />
    </DefaultStylePanel>
  )
}

// ── Main App ──────────────────────────────────────────────────────────

export default function App() {
  const [ready, setReady] = useState(false)
  const [skippedRecords, setSkippedRecords] = useState<ReturnType<typeof describeSkippedRecord>[]>([])

  const handleReady = useCallback(() => setReady(true), [])
  const handleSkippedRecords = useCallback((records: ReturnType<typeof describeSkippedRecord>[]) => setSkippedRecords(records), [])

  return (
    <div className="canvas-container">
      {!ready && (
        <div style={{
          position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
          color: '#4a5568', fontFamily: 'system-ui, sans-serif', fontSize: 14,
        }}>
          Loading canvas...
        </div>
      )}
      <SkippedRecordsNotice records={skippedRecords} onDismiss={() => setSkippedRecords([])} />
      <Tldraw>
        <CanvasSync onReady={handleReady} onSkippedRecords={handleSkippedRecords} />
        <DefaultShapeStyles />
        <AiImageHolderTool />
        <CustomStylePanel />
        <ExportMenu />
      </Tldraw>
    </div>
  )
}

// ── Default Shape Styles ─────────────────────────────────────────────

function DefaultShapeStyles() {
  const editor = useEditor()

  useEffect(() => {
    if (!editor) return
    // Set default text size to 'l' — tldraw resets styles on tool switch,
    // so we re-apply whenever the active tool changes
    const applyDefaults = () => {
      try { editor.setStyleForNextShapes(DefaultSizeStyle, 'l') } catch {}
    }

    applyDefaults()

    let lastTool = editor.getCurrentToolId()

    const unsubscribe = editor.store.listen(() => {
      const tool = editor.getCurrentToolId()
      if (tool !== lastTool) {
        lastTool = tool
        applyDefaults()
      }
    })

    return unsubscribe
  }, [editor])

  return null
}

// ── AI Image Holder Tool (toolbar button) ─────────────────────────────

function AiImageHolderTool() {
  const editor = useEditor()

  useEffect(() => {
    if (!editor) return

    function handleKeyboardShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        createAiImageHolderAtViewportCenter(editor)
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut)
    return () => window.removeEventListener('keydown', handleKeyboardShortcut)
  }, [editor])

  return null
}

// ── Custom Style Panel Registration ───────────────────────────────────

function CustomStylePanel() {
  const editor = useEditor()
  if (!editor) return null

  return <KaiStylePanelWrapper editor={editor} />
}

function KaiStylePanelWrapper({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const selectedShapes = editor.getSelectedShapes()
  const hasAiImageHolder = selectedShapes.some(isAiImageHolderShape)
  const selectionKey = selectedShapes.map(s => s.id).join(',')

  if (!hasAiImageHolder) return <DefaultStylePanel><DefaultStylePanelContent /></DefaultStylePanel>
  return <KaiStylePanel editor={editor} key={selectionKey} />
}

// ── Export Menu ───────────────────────────────────────────────────────

function ExportMenu() {
  const editor = useEditor()
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  if (!editor) return null

  async function handleExport(format: 'png' | 'svg') {
    setExporting(true)
    try {
      const shapes = editor!.getCurrentPageShapes()
      if (shapes.length === 0) { setOpen(false); return }

      if (format === 'svg') {
        const result = await editor!.getSvgString(shapes)
        if (!result) return
        const blob = new Blob([result.svg], { type: 'image/svg+xml' })
        downloadBlob(blob, `canvas-${Date.now()}.svg`)
      } else {
        const result = await editor!.toImage(shapes, { format: 'png', quality: 0.92 } as any)
        downloadBlob(result.blob, `canvas-${Date.now()}.png`)
      }
    } catch (e) {
      console.error('[canvas] Export failed:', e)
    } finally {
      setExporting(false)
      setOpen(false)
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="kai-export-menu" role="toolbar" aria-label="导出">
      <button
        className="kai-export-toggle"
        onClick={() => setOpen(!open)}
        disabled={exporting}
        title="导出画布"
        aria-expanded={open}
        type="button"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      {open && (
        <div className="kai-export-dropdown" role="menu">
          <button onClick={() => handleExport('png')} role="menuitem" disabled={exporting} type="button">
            {exporting ? '导出中...' : '导出 PNG'}
          </button>
          <button onClick={() => handleExport('svg')} role="menuitem" disabled={exporting} type="button">
            {exporting ? '导出中...' : '导出 SVG'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Canvas Sync (the core sync component) ─────────────────────────────

function CanvasSync({
  onReady,
  onSkippedRecords,
}: {
  onReady: () => void
  onSkippedRecords: (records: ReturnType<typeof describeSkippedRecord>[]) => void
}) {
  const editor = useEditor()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPutTimestamp = useRef(0)
  const isApplyingRemote = useRef(false)
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasUnsavedChanges = useRef(false)
  const isSaving = useRef(false)
  const hasPendingSave = useRef(false)
  const baselineStore = useRef<Record<string, unknown>>({})
  const lastUserEditTime = useRef(0)

  // 1. Load existing snapshot from server
  useEffect(() => {
    if (!editor) return

    let cancelled = false
    fetch('/api/canvas')
      .then(r => r.json())
      .then(({ snapshot }) => {
        if (cancelled) { onReady(); return }
        if (!snapshot?.store) { onReady(); return }

        const sanitized = sanitizeCanvasSnapshotForTldraw(snapshot)
        if (sanitized.snapshot) {
          // Reorder images to back BEFORE loading into store (data-level, no editor ops)
          reorderImagesToBackInStore(sanitized.snapshot.store)

          editor.store.mergeRemoteChanges(() => {
            for (const record of Object.values(sanitized.snapshot!.store)) {
              try { editor.store.put([record as any]) } catch {}
            }
          })
        }

        onSkippedRecords(sanitized.skippedRecords)
        baselineStore.current = editor.store.getStoreSnapshot().store as Record<string, unknown>
        onReady()
      })
      .catch(() => onReady())

    return () => { cancelled = true }
  }, [editor, onReady, onSkippedRecords])

  // 2. Debounce PUT on user changes
  useEffect(() => {
    if (!editor) return

    const unsubscribe = editor.store.listen(() => {
      if (isApplyingRemote.current) return

      hasUnsavedChanges.current = true
      lastUserEditTime.current = Date.now()

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        isSaving.current = true
        const snapshot = editor.store.getStoreSnapshot()
        lastPutTimestamp.current = Date.now()

        try {
          await fetch('/api/canvas', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(snapshot),
          })
          baselineStore.current = editor.store.getStoreSnapshot().store as Record<string, unknown>
          hasUnsavedChanges.current = false
        } catch (e) {
          console.error('[canvas] Save failed:', e)
        } finally {
          isSaving.current = false

          if (hasPendingSave.current) {
            hasPendingSave.current = false
            hasUnsavedChanges.current = true
            editor.store.put([])
          }
        }
      }, 500)
    }, { source: 'user', scope: 'document' })

    return unsubscribe
  }, [editor])

  // 3. SSE: merge remote changes safely
  useEffect(() => {
    if (!editor) return

    let eventSource: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function refreshFromServer() {
      // Cooldown: skip if user edited within last 2s (prevent editing interference)
      const sinceLastEdit = Date.now() - lastUserEditTime.current
      if (sinceLastEdit < 2000) return

      // Skip if we just saved
      const sinceLastPut = Date.now() - lastPutTimestamp.current
      if (sinceLastPut < 1000) {
        setTimeout(refreshFromServer, 1000 - sinceLastPut)
        return
      }

      const preserveLocalChanges = hasUnsavedChanges.current || isSaving.current
      const preFetchStore = preserveLocalChanges
        ? null
        : (editor!.store.getStoreSnapshot().store as Record<string, unknown>)

      try {
        const res = await fetch('/api/canvas')
        const { snapshot } = await res.json()
        if (!snapshot?.store) return

        // Re-check edit time after fetch (user may have started editing during fetch)
        const sinceLastEdit2 = Date.now() - lastUserEditTime.current
        if (sinceLastEdit2 < 2000) return

        const effectivePreserve =
          preserveLocalChanges ||
          sinceLastEdit2 < 3000 ||
          (!!preFetchStore && storeChangedSinceSnapshot(editor, preFetchStore))

        isApplyingRemote.current = true
        const { changedRecords, skippedRecords } = applyRemoteCanvasSnapshot(editor, snapshot, {
          preserveLocalChanges: effectivePreserve,
        })

        onSkippedRecords(skippedRecords)
        baselineStore.current = editor!.store.getStoreSnapshot().store as Record<string, unknown>

        if (changedRecords > 0 && effectivePreserve) {
          hasUnsavedChanges.current = true
          if (isSaving.current) hasPendingSave.current = true
        }

        isApplyingRemote.current = false
      } catch (e) {
        console.error('[canvas] SSE refresh failed:', e)
        isApplyingRemote.current = false
      }
    }

    function connectSSE() {
      eventSource = new EventSource('/api/canvas-events')
      eventSource.addEventListener('canvas-changed', refreshFromServer)
      eventSource.onerror = () => {
        eventSource?.close()
        eventSource = null
        if (!pollTimer) pollTimer = setInterval(refreshFromServer, 5000)
      }
    }

    connectSSE()
    return () => {
      eventSource?.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [editor, onSkippedRecords])

  // 4. Persist selection state (for MCP tools)
  useEffect(() => {
    if (!editor) return

    const unsubscribe = editor.store.listen(() => {
      if (isApplyingRemote.current) return

      if (selectionTimer.current) clearTimeout(selectionTimer.current)
      selectionTimer.current = setTimeout(() => {
        const selectedShapes = editor.getSelectedShapes()
        const selectionState = {
          selectedShapes: selectedShapes.map(s => ({
            id: s.id,
            type: s.type,
            x: s.x,
            y: s.y,
            rotation: s.rotation,
            props: { w: s.props?.w, h: s.props?.h, name: s.props?.name, assetId: s.props?.assetId },
            meta: s.meta,
          })),
          updatedAt: new Date().toISOString(),
        }

        fetch('/api/selection', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(selectionState),
        }).catch(() => {})
      }, 250)
    }, { source: 'user', scope: 'session' })

    return unsubscribe
  }, [editor])

  return null
}
