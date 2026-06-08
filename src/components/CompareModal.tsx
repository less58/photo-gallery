'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Check, X, HelpCircle, ZoomIn, ZoomOut } from 'lucide-react'
import type { Photo, SelectionStatus } from '@/lib/types'

const STATUS_COLOR: Record<SelectionStatus, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

type Props = {
  photos: [Photo, Photo]
  selections: Record<string, SelectionStatus>
  isApproveBlocked: boolean
  onMark: (photoId: string, status: SelectionStatus | null) => void
  onClose: () => void
}

export default function CompareModal({ photos, selections, isApproveBlocked, onMark, onClose }: Props) {
  const [zooms, setZooms] = useState<[number, number]>([100, 100])
  const [pans, setPans] = useState<[{ x: number; y: number }, { x: number; y: number }]>([{ x: 0, y: 0 }, { x: 0, y: 0 }])
  const dragging = useRef<{ idx: 0 | 1; mx: number; my: number; px: number; py: number } | null>(null)

  function zoomIn(idx: 0 | 1) {
    setZooms(z => { const n = [...z] as [number, number]; n[idx] = Math.min(n[idx] + 25, 400); return n })
  }

  function zoomOut(idx: 0 | 1) {
    setZooms(z => {
      const n = [...z] as [number, number]
      n[idx] = Math.max(n[idx] - 25, 100)
      if (n[idx] === 100) setPans(p => { const pp = [...p] as typeof p; pp[idx] = { x: 0, y: 0 }; return pp })
      return n
    })
  }

  function handleWheel(e: React.WheelEvent, idx: 0 | 1) {
    e.stopPropagation()
    setZooms(z => {
      const n = [...z] as [number, number]
      n[idx] = Math.max(100, Math.min(400, n[idx] + (e.deltaY < 0 ? 25 : -25)))
      if (n[idx] === 100) setPans(p => { const pp = [...p] as typeof p; pp[idx] = { x: 0, y: 0 }; return pp })
      return n
    })
  }

  function handleMouseDown(e: React.MouseEvent, idx: 0 | 1) {
    if (zooms[idx] <= 100 || (e.target as HTMLElement).closest('button')) return
    dragging.current = { idx, mx: e.clientX, my: e.clientY, px: pans[idx].x, py: pans[idx].y }
    e.preventDefault()
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const { idx, mx, my, px, py } = dragging.current
    setPans(p => {
      const n = [...p] as typeof p
      n[idx] = { x: px + (e.clientX - mx), y: py + (e.clientY - my) }
      return n
    })
  }

  function handleMouseUp() { dragging.current = null }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className="modal-pop bg-neutral-900 rounded-2xl overflow-hidden w-full max-w-6xl flex flex-col"
        style={{ height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700 shrink-0">
          <h3 className="text-white font-medium">השוואת תמונות</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div
          className="flex flex-1 gap-4 p-4 overflow-hidden min-h-0"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {photos.map((photo, i) => {
            const idx = i as 0 | 1
            const status = selections[photo.id] ?? null
            const blocked = isApproveBlocked && status !== 'approved'
            return (
              <div key={photo.id} className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Image */}
                <div
                  className="flex-1 relative rounded-xl overflow-hidden bg-black min-h-0"
                  onMouseDown={e => handleMouseDown(e, idx)}
                  onWheel={e => handleWheel(e, idx)}
                  style={{ cursor: zooms[idx] > 100 ? 'grab' : 'default' }}
                >
                  <Image
                    src={photo.url}
                    alt={photo.name || ''}
                    fill
                    unoptimized
                    draggable={false}
                    className="object-contain pointer-events-none select-none"
                    sizes="50vw"
                    style={{
                      transform: `translate(${pans[idx].x}px, ${pans[idx].y}px) scale(${zooms[idx] / 100})`,
                      transformOrigin: 'center',
                    }}
                  />
                  {photo.name && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap z-10">
                      {photo.name}
                    </div>
                  )}
                  {status && (
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10"
                      style={{ background: STATUS_COLOR[status] }}>
                      {status === 'approved' ? <Check size={16} className="text-white" />
                        : status === 'rejected' ? <X size={16} className="text-white" />
                        : <HelpCircle size={16} className="text-white" />}
                    </div>
                  )}
                  {/* Zoom controls */}
                  <div
                    className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-xl px-2 py-1.5 z-10"
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <button type="button" onClick={() => zoomOut(idx)} disabled={zooms[idx] <= 100}
                      className="w-5 h-5 flex items-center justify-center hover:bg-white/15 rounded transition disabled:opacity-30">
                      <ZoomOut size={12} className="text-white" />
                    </button>
                    <span className="text-[11px] text-white/70 font-mono w-8 text-center select-none">{zooms[idx]}%</span>
                    <button type="button" onClick={() => zoomIn(idx)}
                      className="w-5 h-5 flex items-center justify-center hover:bg-white/15 rounded transition">
                      <ZoomIn size={12} className="text-white" />
                    </button>
                  </div>
                </div>

                {/* Selection buttons */}
                <div className="flex justify-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => onMark(photo.id, status === 'approved' ? null : 'approved')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: status === 'approved' ? STATUS_COLOR.approved : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    <Check size={15} />
                    {status === 'approved' ? 'נבחרה' : 'בחרי'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMark(photo.id, status === 'maybe' ? null : 'maybe')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{
                      background: status === 'maybe' ? STATUS_COLOR.maybe : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    <HelpCircle size={15} />
                    {status === 'maybe' ? 'בהתלבטות' : 'התלבטות'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMark(photo.id, status === 'rejected' ? null : 'rejected')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{
                      background: status === 'rejected' ? STATUS_COLOR.rejected : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    <X size={15} />
                    {status === 'rejected' ? 'לא רוצה' : 'דחי'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
