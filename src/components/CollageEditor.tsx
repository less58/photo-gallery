'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, GripVertical, Plus, Save, ChevronRight, Trash2, Check } from 'lucide-react'
import type { Collage, CollageCell, CollageTemplate } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const EDITOR_W = 800
const EDITOR_H = 533  // 3:2 ratio
const SNAP = 8
const MIN_CELL = 60
const RENDER_W = 1600
const RENDER_H = 1067

// ─── Preset templates ─────────────────────────────────────────────────────────
const PRESETS: Array<{ id: string; name: string; cells: NCell[] }> = [
  { id: 'p1', name: 'שניים שווים', cells: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  { id: 'p2', name: '1 + 2 אופקי', cells: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  { id: 'p3', name: '2 + 1 אנכי', cells: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  { id: 'p4', name: 'רשת 2×2', cells: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  { id: 'p5', name: 'גדולה + 2 פסים', cells: [{ x: 0, y: 0, w: 0.67, h: 1 }, { x: 0.67, y: 0, w: 0.33, h: 0.5 }, { x: 0.67, y: 0.5, w: 0.33, h: 0.5 }] },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type NCell = { x: number; y: number; w: number; h: number }  // normalized 0-1
type ECell = { id: string } & NCell  // editor coordinates (also 0-1 here, stored as fraction)

// ECell coords are already normalized 0-1 since EDITOR_W/H is just the display size
// We use absolute pixel coords internally and normalize on save

type AbsCell = { id: string; x: number; y: number; w: number; h: number }  // pixels in editor

type FilledCell = AbsCell & { photo_url: string | null; pan_x: number; pan_y: number }

type DragOp =
  | { type: 'draw'; x0: number; y0: number }
  | { type: 'move'; id: string; origX: number; origY: number; mx0: number; my0: number }
  | { type: 'resize'; id: string; handle: 'se' | 'e' | 's'; origCell: AbsCell; mx0: number; my0: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function denorm(cells: NCell[]): AbsCell[] {
  return cells.map(c => ({
    id: uid(),
    x: c.x * EDITOR_W,
    y: c.y * EDITOR_H,
    w: c.w * EDITOR_W,
    h: c.h * EDITOR_H,
  }))
}

function toFilledCells(abs: AbsCell[]): FilledCell[] {
  return abs.map(c => ({ ...c, photo_url: null, pan_x: 0, pan_y: 0 }))
}

function normCells(abs: AbsCell[], photos: Map<string, { url: string; px: number; py: number }>): CollageCell[] {
  return abs.map(c => {
    const p = photos.get(c.id)
    return {
      x: c.x / EDITOR_W,
      y: c.y / EDITOR_H,
      w: c.w / EDITOR_W,
      h: c.h / EDITOR_H,
      photo_url: p?.url ?? null,
      pan_x: p?.px ?? 0,
      pan_y: p?.py ?? 0,
    }
  })
}

// ─── Canvas download renderer ─────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

async function renderCollageCanvas(collage: Collage): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = RENDER_W
  canvas.height = RENDER_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, RENDER_W, RENDER_H)

  for (const cell of collage.cells) {
    const x = cell.x * RENDER_W
    const y = cell.y * RENDER_H
    const w = cell.w * RENDER_W
    const h = cell.h * RENDER_H

    if (cell.photo_url) {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(cell.photo_url)}`
      const img = await loadImg(proxyUrl)
      const cellAspect = w / h
      const imgAspect = img.naturalWidth / img.naturalHeight
      let drawW: number, drawH: number, drawX: number, drawY: number
      if (imgAspect > cellAspect) {
        drawH = h; drawW = img.naturalWidth * (h / img.naturalHeight)
        const ov = drawW - w
        drawX = x - ov * (cell.pan_x + 1) / 2; drawY = y
      } else {
        drawW = w; drawH = img.naturalHeight * (w / img.naturalWidth)
        const ov = drawH - h
        drawX = x; drawY = y - ov * (cell.pan_y + 1) / 2
      }
      ctx.save()
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
      ctx.drawImage(img, drawX, drawY, drawW, drawH)
      ctx.restore()
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x, y, w, h)
    }
  }

  if (collage.border_enabled) {
    ctx.strokeStyle = collage.border_color
    ctx.lineWidth = collage.border_width * (RENDER_W / EDITOR_W)
    for (const cell of collage.cells) {
      const lw = ctx.lineWidth
      ctx.strokeRect(
        cell.x * RENDER_W + lw / 2,
        cell.y * RENDER_H + lw / 2,
        cell.w * RENDER_W - lw,
        cell.h * RENDER_H - lw,
      )
    }
  }

  return canvas
}

// ─── Preset mini-preview ──────────────────────────────────────────────────────
function PresetPreview({ cells, selected }: { cells: NCell[]; selected: boolean }) {
  const W = 120, H = 80
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="rounded overflow-hidden">
      <rect width={W} height={H} fill="#1a1a1a" />
      {cells.map((c, i) => (
        <rect key={i}
          x={c.x * W + 2} y={c.y * H + 2}
          width={c.w * W - 4} height={c.h * H - 4}
          fill={selected ? '#6366F1' : '#3a3a3a'} rx={2} />
      ))}
    </svg>
  )
}

// ─── Collage preview (CSS-based, no canvas) ───────────────────────────────────
export function CollagePreview({ collage, className }: { collage: Collage; className?: string }) {
  return (
    <div className={`relative bg-black overflow-hidden ${className ?? ''}`} style={{ aspectRatio: '3/2' }}>
      {collage.cells.map((cell, i) => (
        <div key={i} className="absolute overflow-hidden" style={{
          left: `${cell.x * 100}%`, top: `${cell.y * 100}%`,
          width: `${cell.w * 100}%`, height: `${cell.h * 100}%`,
        }}>
          {cell.photo_url && (
            <img src={cell.photo_url} alt="" draggable={false}
              className="absolute inset-0 w-full h-full object-cover select-none"
              style={{ objectPosition: `${(cell.pan_x + 1) / 2 * 100}% ${(cell.pan_y + 1) / 2 * 100}%` }} />
          )}
          {!cell.photo_url && (
            <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
              <span className="text-white/20 text-xs">{i + 1}</span>
            </div>
          )}
          {collage.border_enabled && (
            <div className="absolute inset-0 pointer-events-none" style={{
              border: `${collage.border_width}px solid ${collage.border_color}`,
              boxSizing: 'border-box',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  portfolioId: string
  color: string
  collage?: Collage
  onSave: (collage: Collage) => void
  onClose: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CollageEditor({ portfolioId, color, collage, onSave, onClose }: Props) {
  type Step = 'template' | 'layout' | 'fill'
  const [step, setStep] = useState<Step>(collage ? 'fill' : 'template')
  const [fromCustom, setFromCustom] = useState(false)
  const [collageName, setCollageName] = useState(collage?.name || 'קולאג׳ חדש')
  const [saving, setSaving] = useState(false)
  const [hasEdited, setHasEdited] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<CollageTemplate[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  // Layout builder state (editor cells in pixel coords)
  const [layoutCells, setLayoutCells] = useState<AbsCell[]>(() =>
    collage ? collage.cells.map((c, i) => ({ id: uid(), x: c.x * EDITOR_W, y: c.y * EDITOR_H, w: c.w * EDITOR_W, h: c.h * EDITOR_H })) : []
  )
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [guides, setGuides] = useState<{ h: number[]; v: number[] }>({ h: [], v: [] })
  const layoutEditorRef = useRef<HTMLDivElement>(null)
  const layoutDragRef = useRef<DragOp | null>(null)

  // Fill step state
  const [filledCells, setFilledCells] = useState<FilledCell[]>(() =>
    collage ? collage.cells.map(c => ({
      id: uid(),
      x: c.x * EDITOR_W, y: c.y * EDITOR_H, w: c.w * EDITOR_W, h: c.h * EDITOR_H,
      photo_url: c.photo_url, pan_x: c.pan_x, pan_y: c.pan_y,
    })) : []
  )
  const [uploadingCell, setUploadingCell] = useState<string | null>(null)
  const [uploadingAll, setUploadingAll] = useState(false)
  const [uploadAllProgress, setUploadAllProgress] = useState<{ done: number; total: number } | null>(null)
  const [borderEnabled, setBorderEnabled] = useState(collage?.border_enabled ?? false)
  const [borderColor, setBorderColor] = useState(collage?.border_color ?? '#ffffff')
  const [borderWidth, setBorderWidth] = useState(collage?.border_width ?? 4)
  const fillAllInputRef = useRef<HTMLInputElement>(null)
  const fillEditorRef = useRef<HTMLDivElement>(null)
  const panDragRef = useRef<{ cellId: string; mx0: number; my0: number; px0: number; py0: number } | null>(null)
  const [cellDragSource, setCellDragSource] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Fetch custom templates
  useEffect(() => {
    fetch('/api/dashboard/collage-templates')
      .then(r => r.json())
      .then(d => setCustomTemplates(d.templates || []))
      .catch(() => {})
  }, [])

  // ─── Close with confirmation ────────────────────────────────────────────────
  function handleClose() {
    if (hasEdited) { setShowCloseConfirm(true) } else { onClose() }
  }

  // ─── Template step ──────────────────────────────────────────────────────────
  function selectPreset(cells: NCell[]) {
    const abs = denorm(cells)
    setLayoutCells(abs)
    setFilledCells(toFilledCells(abs))
    setHasEdited(true)
    setFromCustom(false)
    setStep('fill')
  }

  function selectCustomTemplate(cells: NCell[]) {
    const abs = denorm(cells)
    setLayoutCells(abs)
    setFilledCells(toFilledCells(abs))
    setFromCustom(false)
    setStep('fill')
  }

  function goCustom() {
    setFromCustom(true)
    setHasEdited(true)
    setStep('layout')
  }

  // ─── Layout builder helpers ─────────────────────────────────────────────────
  function getEditorXY(e: React.MouseEvent): [number, number] {
    const rect = layoutEditorRef.current!.getBoundingClientRect()
    return [clamp(e.clientX - rect.left, 0, EDITOR_W), clamp(e.clientY - rect.top, 0, EDITOR_H)]
  }

  function computeSnap(excludeId: string | null, x: number, y: number, w: number, h: number, currentCells: AbsCell[]) {
    const others = currentCells.filter(c => c.id !== excludeId)
    const hSnaps = [0, EDITOR_H / 2, EDITOR_H, ...others.flatMap(c => [c.y, c.y + c.h / 2, c.y + c.h])]
    const vSnaps = [0, EDITOR_W / 2, EDITOR_W, ...others.flatMap(c => [c.x, c.x + c.w / 2, c.x + c.w])]

    const myHEdges = [y, y + h / 2, y + h]
    const myVEdges = [x, x + w / 2, x + w]

    let bestHDist = SNAP + 1, bestHSnap: number | null = null, bestHMy: number | null = null
    for (const s of hSnaps) for (const m of myHEdges) {
      const d = Math.abs(m - s); if (d < bestHDist) { bestHDist = d; bestHSnap = s; bestHMy = m }
    }
    let bestVDist = SNAP + 1, bestVSnap: number | null = null, bestVMy: number | null = null
    for (const s of vSnaps) for (const m of myVEdges) {
      const d = Math.abs(m - s); if (d < bestVDist) { bestVDist = d; bestVSnap = s; bestVMy = m }
    }

    const snappedY = bestHSnap !== null ? clamp(y + (bestHSnap - bestHMy!), 0, EDITOR_H - h) : clamp(y, 0, EDITOR_H - h)
    const snappedX = bestVSnap !== null ? clamp(x + (bestVSnap - bestVMy!), 0, EDITOR_W - w) : clamp(x, 0, EDITOR_W - w)

    return {
      snappedX, snappedY,
      hGuides: bestHSnap !== null ? [bestHSnap] : [],
      vGuides: bestVSnap !== null ? [bestVSnap] : [],
    }
  }

  function onLayoutEditorMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement) !== layoutEditorRef.current) return
    const [mx, my] = getEditorXY(e)
    layoutDragRef.current = { type: 'draw', x0: mx, y0: my }
    setDrawPreview({ x: mx, y: my, w: 0, h: 0 })
    e.preventDefault()
  }

  function onCellMouseDown(e: React.MouseEvent, cell: AbsCell) {
    e.stopPropagation()
    const [mx, my] = getEditorXY(e)
    layoutDragRef.current = { type: 'move', id: cell.id, origX: cell.x, origY: cell.y, mx0: mx, my0: my }
    e.preventDefault()
  }

  function onResizeMouseDown(e: React.MouseEvent, cell: AbsCell, handle: 'se' | 'e' | 's') {
    e.stopPropagation()
    const [mx, my] = getEditorXY(e)
    layoutDragRef.current = { type: 'resize', id: cell.id, handle, origCell: { ...cell }, mx0: mx, my0: my }
    e.preventDefault()
  }

  const onLayoutMouseMove = useCallback((e: React.MouseEvent) => {
    const op = layoutDragRef.current
    if (!op) return
    const [mx, my] = getEditorXY(e)

    if (op.type === 'draw') {
      const x = Math.min(op.x0, mx), y = Math.min(op.y0, my)
      const w = Math.abs(mx - op.x0), h = Math.abs(my - op.y0)
      setDrawPreview({ x, y, w, h })
      setGuides({ h: [], v: [] })
    } else if (op.type === 'move') {
      const dx = mx - op.mx0, dy = my - op.my0
      setLayoutCells(prev => {
        const cell = prev.find(c => c.id === op.id)!
        const { snappedX, snappedY, hGuides, vGuides } = computeSnap(op.id, op.origX + dx, op.origY + dy, cell.w, cell.h, prev)
        setGuides({ h: hGuides, v: vGuides })
        return prev.map(c => c.id === op.id ? { ...c, x: snappedX, y: snappedY } : c)
      })
    } else if (op.type === 'resize') {
      const dx = mx - op.mx0, dy = my - op.my0
      setLayoutCells(prev => prev.map(c => {
        if (c.id !== op.id) return c
        const oc = op.origCell
        let newW = oc.w, newH = oc.h
        if (op.handle === 'se' || op.handle === 'e') newW = clamp(oc.w + dx, MIN_CELL, EDITOR_W - oc.x)
        if (op.handle === 'se' || op.handle === 's') newH = clamp(oc.h + dy, MIN_CELL, EDITOR_H - oc.y)
        return { ...c, w: newW, h: newH }
      }))
    }
  }, [layoutCells])  // eslint-disable-line react-hooks/exhaustive-deps

  function onLayoutMouseUp() {
    const op = layoutDragRef.current
    layoutDragRef.current = null
    setGuides({ h: [], v: [] })

    if (op?.type === 'draw' && drawPreview) {
      setDrawPreview(null)
      if (drawPreview.w >= MIN_CELL && drawPreview.h >= MIN_CELL) {
        setLayoutCells(prev => {
          const { snappedX, snappedY } = computeSnap(null, drawPreview.x, drawPreview.y, drawPreview.w, drawPreview.h, prev)
          return [...prev, { id: uid(), x: snappedX, y: snappedY, w: drawPreview.w, h: drawPreview.h }]
        })
      }
    } else if (op?.type === 'draw') {
      setDrawPreview(null)
    }
  }

  function deleteLayoutCell(id: string) {
    setLayoutCells(prev => prev.filter(c => c.id !== id))
  }

  function proceedToFill() {
    setFilledCells(toFilledCells(layoutCells))
    setStep('fill')
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      const cells = layoutCells.map(c => ({ x: c.x / EDITOR_W, y: c.y / EDITOR_H, w: c.w / EDITOR_W, h: c.h / EDITOR_H }))
      const res = await fetch('/api/dashboard/collage-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, cells }),
      })
      const data = await res.json()
      if (data.id) {
        setCustomTemplates(prev => [{ id: data.id, name: data.name, cells: data.cells }, ...prev])
        setShowSaveTemplate(false)
        setTemplateName('')
      }
    } catch { /* ignore */ }
    setSavingTemplate(false)
  }

  // ─── Fill step handlers ─────────────────────────────────────────────────────
  async function uploadToCell(cellId: string, file: File) {
    setHasEdited(true)
    setUploadingCell(cellId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', `collages/${portfolioId}`)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        setFilledCells(prev => prev.map(c => c.id === cellId ? { ...c, photo_url: data.url, pan_x: 0, pan_y: 0 } : c))
      }
    } catch { /* ignore */ }
    setUploadingCell(null)
  }

  async function uploadAllFiles(files: FileList) {
    setHasEdited(true)
    setUploadingAll(true)
    const arr = Array.from(files).slice(0, filledCells.length)
    const total = arr.length
    setUploadAllProgress({ done: 0, total })

    const results = await Promise.all(arr.map((file, i) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', `collages/${portfolioId}`)
      return fetch('/api/upload', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(d => {
          setUploadAllProgress(p => p ? { done: p.done + 1, total: p.total } : null)
          return { i, url: (d.url as string) || null }
        })
        .catch(() => {
          setUploadAllProgress(p => p ? { done: p.done + 1, total: p.total } : null)
          return { i, url: null }
        })
    }))
    setFilledCells(prev => {
      const next = [...prev]
      for (const { i, url } of results) {
        if (url && i < next.length) next[i] = { ...next[i], photo_url: url, pan_x: 0, pan_y: 0 }
      }
      return next
    })
    setUploadingAll(false)
    setUploadAllProgress(null)
  }

  function removePhoto(cellId: string) {
    setFilledCells(prev => prev.map(c => c.id === cellId ? { ...c, photo_url: null, pan_x: 0, pan_y: 0 } : c))
  }

  // Pan handling (at fill editor level)
  function onFillEditorMouseMove(e: React.MouseEvent) {
    const pd = panDragRef.current
    if (!pd) return
    const cell = filledCells.find(c => c.id === pd.cellId)
    if (!cell) return
    const dx = e.clientX - pd.mx0
    const dy = e.clientY - pd.my0
    const newPx = clamp(pd.px0 + dx / (cell.w / 2), -1, 1)
    const newPy = clamp(pd.py0 + dy / (cell.h / 2), -1, 1)
    setFilledCells(prev => prev.map(c => c.id === pd.cellId ? { ...c, pan_x: newPx, pan_y: newPy } : c))
  }

  function onFillEditorMouseUp() {
    panDragRef.current = null
  }

  // Drag-to-swap
  function handleCellDrop(targetId: string) {
    if (!cellDragSource || cellDragSource === targetId) { setDropTarget(null); setCellDragSource(null); return }
    setFilledCells(prev => {
      const src = prev.find(c => c.id === cellDragSource)!
      const tgt = prev.find(c => c.id === targetId)!
      return prev.map(c => {
        if (c.id === cellDragSource) return { ...c, photo_url: tgt.photo_url, pan_x: tgt.pan_x, pan_y: tgt.pan_y }
        if (c.id === targetId) return { ...c, photo_url: src.photo_url, pan_x: src.pan_x, pan_y: src.pan_y }
        return c
      })
    })
    setDropTarget(null); setCellDragSource(null)
  }

  // ─── Save collage ───────────────────────────────────────────────────────────
  async function saveCollage() {
    setSaving(true)
    try {
      const cells: CollageCell[] = filledCells.map(c => ({
        x: c.x / EDITOR_W, y: c.y / EDITOR_H, w: c.w / EDITOR_W, h: c.h / EDITOR_H,
        photo_url: c.photo_url, pan_x: c.pan_x, pan_y: c.pan_y,
      }))

      const payload = { portfolioId, name: collageName, cells, border_enabled: borderEnabled, border_color: borderColor, border_width: borderWidth }

      let res: Response
      if (collage?.id) {
        res = await fetch(`/api/dashboard/collage/${collage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: collageName, cells, border_enabled: borderEnabled, border_color: borderColor, border_width: borderWidth }),
        })
      } else {
        res = await fetch('/api/dashboard/collages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (data.id) { setHasEdited(false); onSave(data as Collage) }
    } catch { /* ignore */ }
    setSaving(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const btnStyle = { background: color, color: '#fff' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4" onClick={handleClose}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: '95vw', maxWidth: 1060, maxHeight: '97vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close confirmation dialog */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-2xl">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center">
              <p className="text-stone-800 font-semibold text-base mb-1">לסגור ללא שמירה?</p>
              <p className="text-stone-500 text-sm mb-6">כל השינויים שלא נשמרו יאבדו</p>
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition">
                  סגור ללא שמירה
                </button>
                <button type="button" onClick={() => setShowCloseConfirm(false)}
                  className="px-5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold transition">
                  המשך עריכה
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-200 shrink-0">
          <input
            value={collageName}
            onChange={e => setCollageName(e.target.value)}
            className="flex-1 text-base font-semibold text-stone-800 border-none outline-none bg-transparent"
            placeholder="שם הקולאג׳"
          />
          <button onClick={handleClose} className="text-stone-400 hover:text-stone-600 p-1 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 min-h-0">

          {/* ── Template step ── */}
          {step === 'template' && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">בחר תבנית</h3>

              <div className="flex flex-wrap gap-4">
                {PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => selectPreset(p.cells)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-transparent hover:border-stone-200 transition group">
                    <PresetPreview cells={p.cells} selected={false} />
                    <span className="text-xs text-stone-600 group-hover:text-stone-800">{p.name}</span>
                  </button>
                ))}
                <button type="button" onClick={goCustom}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-400 transition">
                  <div className="w-[120px] h-[80px] flex items-center justify-center bg-stone-100 rounded">
                    <Plus size={28} className="text-stone-400" />
                  </div>
                  <span className="text-xs text-stone-500">תבנית מותאמת</span>
                </button>
              </div>

              {customTemplates.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">תבניות שמורות</h3>
                  <div className="flex flex-wrap gap-4">
                    {customTemplates.map(t => (
                      <button key={t.id} type="button" onClick={() => selectCustomTemplate(t.cells)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-transparent hover:border-stone-200 transition group">
                        <PresetPreview cells={t.cells} selected={false} />
                        <span className="text-xs text-stone-600 group-hover:text-stone-800">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Layout builder step ── */}
          {step === 'layout' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500">גרור בשטח הריק ליצירת ריבוע חדש. גרור ריבוע להזזה, גרור פינת הריבוע לשינוי גודל.</p>

              {/* Editor area */}
              <div
                ref={layoutEditorRef}
                className="relative bg-stone-900 rounded-xl overflow-hidden select-none"
                style={{ width: EDITOR_W, height: EDITOR_H, cursor: 'crosshair' }}
                onMouseDown={onLayoutEditorMouseDown}
                onMouseMove={onLayoutMouseMove}
                onMouseUp={onLayoutMouseUp}
                onMouseLeave={onLayoutMouseUp}
              >
                {/* Grid dots hint */}
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                {/* Cells */}
                {layoutCells.map(cell => (
                  <div key={cell.id}
                    className="absolute border-2 border-indigo-400 bg-indigo-500/20 group"
                    style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h, cursor: 'move' }}
                    onMouseDown={e => onCellMouseDown(e, cell)}
                  >
                    {/* Delete button */}
                    <button type="button"
                      onClick={e => { e.stopPropagation(); deleteLayoutCell(cell.id) }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <X size={10} className="text-white" />
                    </button>
                    {/* Resize handles */}
                    <div onMouseDown={e => onResizeMouseDown(e, cell, 'e')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-8 rounded-l bg-indigo-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div onMouseDown={e => onResizeMouseDown(e, cell, 's')}
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-3 w-8 rounded-t bg-indigo-400 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div onMouseDown={e => onResizeMouseDown(e, cell, 'se')}
                      className="absolute bottom-0 right-0 w-4 h-4 rounded-tl bg-indigo-400 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                    {/* Size label */}
                    <span className="absolute bottom-1 left-1 text-[10px] text-indigo-200/70 pointer-events-none select-none">
                      {Math.round(cell.w / EDITOR_W * 100)}×{Math.round(cell.h / EDITOR_H * 100)}
                    </span>
                  </div>
                ))}

                {/* Draw preview */}
                {drawPreview && drawPreview.w > 2 && (
                  <div className="absolute border-2 border-dashed border-white/60 bg-white/10 pointer-events-none"
                    style={{ left: drawPreview.x, top: drawPreview.y, width: drawPreview.w, height: drawPreview.h }} />
                )}

                {/* Snap guide lines */}
                {guides.h.map(y => (
                  <div key={`h${y}`} className="absolute pointer-events-none" style={{ top: y - 0.5, left: 0, right: 0, height: 1, background: '#818CF8' }} />
                ))}
                {guides.v.map(x => (
                  <div key={`v${x}`} className="absolute pointer-events-none" style={{ left: x - 0.5, top: 0, bottom: 0, width: 1, background: '#818CF8' }} />
                ))}

                {/* Empty state hint */}
                {layoutCells.length === 0 && !drawPreview && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <div className="w-12 h-12 rounded-xl border-2 border-dashed border-white/30 flex items-center justify-center">
                      <Plus size={20} className="text-white/30" />
                    </div>
                    <span className="text-white/30 text-sm">גרור ליצירת תאים</span>
                  </div>
                )}
              </div>

              {/* Save as template */}
              {layoutCells.length > 0 && (
                <div className="flex items-center gap-3">
                  {showSaveTemplate ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void saveAsTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false) }}
                        placeholder="שם התבנית"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-sm outline-none focus:border-indigo-400"
                      />
                      <button onClick={saveAsTemplate} disabled={savingTemplate || !templateName.trim()}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition"
                        style={btnStyle}>
                        {savingTemplate ? 'שומר...' : 'שמור'}
                      </button>
                      <button onClick={() => setShowSaveTemplate(false)} className="text-stone-400 hover:text-stone-600 text-sm">ביטול</button>
                    </>
                  ) : (
                    <button onClick={() => setShowSaveTemplate(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-stone-500 border border-stone-200 hover:bg-stone-50 transition">
                      <Save size={13} /> שמור כתבנית
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Fill step ── */}
          {step === 'fill' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-stone-500 flex-wrap">
                <span>{filledCells.length} תאים · {filledCells.filter(c => c.photo_url).length} ממולאים</span>
                <button type="button" onClick={() => !uploadingAll && fillAllInputRef.current?.click()}
                  disabled={uploadingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition disabled:cursor-not-allowed"
                  style={uploadingAll
                    ? { background: color + '18', borderColor: color + '40', color }
                    : { background: 'white', borderColor: '#e7e5e4', color: '#44403c' }}>
                  {uploadingAll ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="font-bold text-sm">
                        {uploadAllProgress ? `מעלה ${uploadAllProgress.done}/${uploadAllProgress.total}...` : 'מעלה...'}
                      </span>
                    </>
                  ) : (
                    <><Upload size={13} /><span>העלה הכל</span></>
                  )}
                </button>
                <input ref={fillAllInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { if (e.target.files) void uploadAllFiles(e.target.files); e.target.value = '' }} />
              </div>

              {/* Collage canvas */}
              <div
                ref={fillEditorRef}
                className="relative bg-black overflow-hidden rounded-xl select-none"
                style={{ width: EDITOR_W, height: EDITOR_H }}
                onMouseMove={onFillEditorMouseMove}
                onMouseUp={onFillEditorMouseUp}
                onMouseLeave={onFillEditorMouseUp}
                onDragOver={e => e.preventDefault()}
              >
                {filledCells.map((cell, idx) => (
                  <FillCellItem
                    key={cell.id}
                    cell={cell}
                    idx={idx}
                    total={filledCells.length}
                    uploading={uploadingCell === cell.id}
                    isDragTarget={dropTarget === cell.id}
                    onUpload={file => uploadToCell(cell.id, file)}
                    onRemove={() => removePhoto(cell.id)}
                    onPanStart={(mx, my) => {
                      panDragRef.current = { cellId: cell.id, mx0: mx, my0: my, px0: cell.pan_x, py0: cell.pan_y }
                    }}
                    onDragStart={() => setCellDragSource(cell.id)}
                    onDragEnter={() => setDropTarget(cell.id)}
                    onDragLeave={() => setDropTarget(prev => prev === cell.id ? null : prev)}
                    onDrop={() => handleCellDrop(cell.id)}
                  />
                ))}

                {/* Border preview */}
                {borderEnabled && filledCells.map(cell => (
                  <div key={cell.id + '_border'} className="absolute pointer-events-none"
                    style={{
                      left: cell.x, top: cell.y, width: cell.w, height: cell.h,
                      border: `${borderWidth}px solid ${borderColor}`,
                      boxSizing: 'border-box',
                    }} />
                ))}
              </div>

              {/* Border controls */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-stone-50 border border-stone-200 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={borderEnabled} onChange={e => setBorderEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-500" />
                  <span className="text-sm font-medium text-stone-700">מסגרת בין תאים</span>
                </label>
                {borderEnabled && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-stone-600">
                      צבע
                      <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)}
                        className="w-8 h-7 rounded border border-stone-300 cursor-pointer p-0.5" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-stone-600">
                      עובי
                      <input type="range" min={1} max={20} value={borderWidth} onChange={e => setBorderWidth(Number(e.target.value))}
                        className="w-24" />
                      <span className="w-6 text-center text-stone-500">{borderWidth}</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-stone-200 shrink-0">
          <div>
            {step !== 'template' && (
              <button type="button"
                onClick={() => setStep(step === 'fill' ? (fromCustom ? 'layout' : 'template') : 'template')}
                className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 transition">
                <ChevronRight size={14} /> חזרה
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === 'layout' && layoutCells.length > 0 && (
              <button type="button" onClick={proceedToFill}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition"
                style={btnStyle}>
                הבא: הוסף תמונות ←
              </button>
            )}
            {step === 'fill' && (
              <button type="button" onClick={saveCollage} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40"
                style={btnStyle}>
                <Check size={14} />
                {saving ? 'שומר...' : collage ? 'עדכן קולאג׳' : 'שמור קולאג׳'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FillCellItem sub-component ───────────────────────────────────────────────
type FillCellProps = {
  cell: FilledCell
  idx: number
  total: number
  uploading: boolean
  isDragTarget: boolean
  onUpload: (f: File) => void
  onRemove: () => void
  onPanStart: (mx: number, my: number) => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: () => void
}

function FillCellItem({ cell, idx, total, uploading, isDragTarget, onUpload, onRemove, onPanStart, onDragStart, onDragEnter, onDragLeave, onDrop }: FillCellProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const posX = `${(cell.pan_x + 1) / 2 * 100}%`
  const posY = `${(cell.pan_y + 1) / 2 * 100}%`

  return (
    <div
      className={`absolute overflow-hidden transition-all ${isDragTarget ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
      style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h }}
      onDragOver={e => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop() }}
    >
      {cell.photo_url ? (
        <>
          {/* Photo */}
          <img src={cell.photo_url} alt="" draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ objectPosition: `${posX} ${posY}` }} />

          {/* Pan overlay */}
          <div className="absolute inset-0" style={{ cursor: 'grab' }}
            onMouseDown={e => { onPanStart(e.clientX, e.clientY); e.preventDefault() }} />

          {/* Remove */}
          <button type="button" onClick={e => { e.stopPropagation(); onRemove() }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20">
            <X size={11} className="text-white" />
          </button>

          {/* Drag handle for swap */}
          <div draggable
            onDragStart={e => { e.stopPropagation(); onDragStart() }}
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded bg-black/60 flex items-center justify-center cursor-grab opacity-0 hover:opacity-100 transition-opacity z-20"
            title="גרור להחלפה">
            <GripVertical size={11} className="text-white" />
          </div>
        </>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-white/25 text-white/40 hover:border-white/50 hover:text-white/70 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          {uploading
            ? <div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
            : <><Upload size={18} /><span className="text-[11px] font-medium">{idx + 1}/{total}</span></>}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
    </div>
  )
}

// ─── Download helper (exported for use in CollageTab / GalleryClient) ─────────
export async function downloadCollage(collage: Collage) {
  const canvas = await renderCollageCanvas(collage)
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('render failed')); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${collage.name}.jpg`
      a.click()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/jpeg', 0.92)
  })
}
