'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Check, X, HelpCircle, GitCompare, ChevronDown, ChevronLeft, ChevronRight, Send, MessageCircle, ZoomIn, ZoomOut } from 'lucide-react'
import type { Session, Photo, Selection, SelectionStatus } from '@/lib/types'
import ProgressBar from './ProgressBar'
import CompareModal from './CompareModal'
import NoteChat from './NoteChat'
import { useToast } from './Toast'

type Props = {
  sessions: Session[]
  allPhotos: Photo[]
  initialSelections: Selection[]
  quota: number
  color: string
  portfolioId: string
  portfolioTitle: string
  coverUrl: string | null
  instructions: string | null
  photographerName: string
  logoUrl: string | null
  showSendButton?: boolean
  isDone?: boolean
}

const STATUS_COLOR: Record<SelectionStatus, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

type GalleryTab = 'gallery' | 'selected'

export default function GalleryClient({
  sessions, allPhotos, initialSelections, quota, color,
  coverUrl, instructions, photographerName, logoUrl, portfolioTitle, portfolioId,
  showSendButton = true,
  isDone = false,
}: Props) {
  const toast = useToast()
  const [activeSession, setActiveSession] = useState<string | 'all'>('all')
  const [selections, setSelections] = useState<Record<string, SelectionStatus>>(() => {
    const m: Record<string, SelectionStatus> = {}
    initialSelections.forEach(s => { m[s.photo_id] = s.status })
    return m
  })
  const [compareQueue, setCompareQueue] = useState<string[]>([])
  const [comparePhotos, setComparePhotos] = useState<[Photo, Photo] | null>(null)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [tab, setTab] = useState<GalleryTab>('gallery')
  const [sendingReport, setSendingReport] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [unreadFromPhotographer, setUnreadFromPhotographer] = useState(0)
  const galleryRef = useRef<HTMLDivElement>(null)

  // Lightbox zoom/pan state
  const [lightboxZoom, setLightboxZoom] = useState(100)
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 })
  const [lbGrabbing, setLbGrabbing] = useState(false)
  const lbDragging = useRef(false)
  const lbDragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const lightboxContainerRef = useRef<HTMLDivElement>(null)

  // Poll for unread messages from photographer (badge on chat button)
  useEffect(() => {
    let alive = true
    function check() {
      fetch(`/api/notes/${portfolioId}/unread`)
        .then(r => r.json())
        .then(d => { if (alive) setUnreadFromPhotographer(d.count ?? 0) })
        .catch(() => {})
    }
    check()
    const interval = setInterval(check, 15000)
    return () => { alive = false; clearInterval(interval) }
  }, [portfolioId])

  // Reset zoom+pan when switching photos
  useEffect(() => {
    setLightboxZoom(100)
    setLightboxPan({ x: 0, y: 0 })
  }, [lightbox?.id])

  // Non-passive wheel listener so we can preventDefault and prevent background scroll
  useEffect(() => {
    if (!lightbox) return
    const el = lightboxContainerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      setLightboxZoom(prev => {
        const next = Math.max(100, Math.min(400, prev + (e.deltaY < 0 ? 25 : -25)))
        if (next === 100) setLightboxPan({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [lightbox])

  const visiblePhotos = activeSession === 'all'
    ? allPhotos
    : allPhotos.filter(p => p.session_id === activeSession)

  const approvedCount = Object.values(selections).filter(s => s === 'approved').length
  const approvedPhotos = allPhotos.filter(p => selections[p.id] === 'approved')

  const moveLightbox = useCallback((direction: -1 | 1) => {
    if (!lightbox || visiblePhotos.length <= 1) return
    const idx = visiblePhotos.findIndex(p => p.id === lightbox.id)
    if (idx < 0) return
    const nextIndex = (idx + direction + visiblePhotos.length) % visiblePhotos.length
    setLightbox(visiblePhotos[nextIndex])
  }, [lightbox, visiblePhotos])

  // Keyboard navigation for lightbox
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightbox) return
      if (e.key === 'ArrowRight') moveLightbox(1)
      if (e.key === 'ArrowLeft') moveLightbox(-1)
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, moveLightbox])

  // Lightbox zoom handlers
  function lbZoomIn(e: React.MouseEvent) {
    e.stopPropagation()
    setLightboxZoom(z => Math.min(z + 25, 400))
  }

  function lbZoomOut(e: React.MouseEvent) {
    e.stopPropagation()
    setLightboxZoom(z => {
      const next = Math.max(z - 25, 100)
      if (next === 100) setLightboxPan({ x: 0, y: 0 })
      return next
    })
  }

  // Lightbox pan (mouse)
  function lbMouseDown(e: React.MouseEvent) {
    if (lightboxZoom <= 100 || (e.target as HTMLElement).closest('button')) return
    lbDragging.current = true
    setLbGrabbing(true)
    lbDragOrigin.current = { mx: e.clientX, my: e.clientY, px: lightboxPan.x, py: lightboxPan.y }
    e.preventDefault()
  }

  function lbMouseMove(e: React.MouseEvent) {
    if (!lbDragging.current) return
    setLightboxPan({
      x: lbDragOrigin.current.px + (e.clientX - lbDragOrigin.current.mx),
      y: lbDragOrigin.current.py + (e.clientY - lbDragOrigin.current.my),
    })
  }

  function lbMouseUp() {
    lbDragging.current = false
    setLbGrabbing(false)
  }

  // Lightbox pan (touch)
  function lbTouchStart(e: React.TouchEvent) {
    if (lightboxZoom <= 100 || e.touches.length !== 1) return
    const t = e.touches[0]
    lbDragging.current = true
    lbDragOrigin.current = { mx: t.clientX, my: t.clientY, px: lightboxPan.x, py: lightboxPan.y }
  }

  function lbTouchMove(e: React.TouchEvent) {
    if (!lbDragging.current || e.touches.length !== 1) return
    const t = e.touches[0]
    setLightboxPan({
      x: lbDragOrigin.current.px + (t.clientX - lbDragOrigin.current.mx),
      y: lbDragOrigin.current.py + (t.clientY - lbDragOrigin.current.my),
    })
  }

  function lbTouchEnd() { lbDragging.current = false }

  const handleMark = useCallback(async (photoId: string, status: SelectionStatus | null) => {
    if (isDone) {
      toast('התיק הושלם על ידי הצלמת — לא ניתן לשנות בחירות', 'error')
      return
    }
    if (status === 'approved') {
      const currentCount = Object.values(selections).filter(s => s === 'approved').length
      const isCurrentlyApproved = selections[photoId] === 'approved'
      if (!isCurrentlyApproved && currentCount >= quota) {
        toast(`הגעת למגבלה של ${quota} תמונות. הסירי בחירה כדי לבחור תמונה אחרת.`, 'error')
        return
      }
    }

    setSelections(prev => {
      const next = { ...prev }
      if (status === null) delete next[photoId]
      else next[photoId] = status
      return next
    })
    if (status === null) {
      await fetch('/api/selections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId }) })
    } else {
      await fetch('/api/selections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId, status }) })
    }
  }, [selections, quota, toast, isDone])

  const handleToggleCompare = useCallback((photoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompareQueue(prev => {
      const next = prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId].slice(-2)
      if (next.length === 2) {
        const [a, b] = next.map(id => allPhotos.find(p => p.id === id)!)
        if (a && b) setComparePhotos([a, b])
        return []
      }
      return next
    })
  }, [allPhotos])

  async function sendReport() {
    if (approvedCount === 0) {
      toast('לא נבחרו תמונות עדיין', 'error')
      return
    }
    setSendingReport(true)
    try {
      const res = await fetch('/api/report', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast(data.emailSent
          ? `הבחירה נשלחה לצלמת! נבחרו ${data.count} תמונות.`
          : `הבחירה נשמרה (${data.count} תמונות). הצלמת תראה את הבחירה בלוח הבקרה שלה.`)
      } else {
        toast(data.error || 'שגיאה בשליחה', 'error')
      }
    } catch {
      toast('שגיאה בחיבור', 'error')
    } finally {
      setSendingReport(false)
    }
  }

  const isApproveBlocked = approvedCount >= quota

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A', color: '#fff' }}>

      {/* ── HERO / Cover ── */}
      {coverUrl ? (
        <div className="relative h-screen flex items-center justify-center overflow-hidden">
          <Image src={coverUrl} alt={portfolioTitle} fill unoptimized className="object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

          <div className="relative z-10 text-center px-6">
            {logoUrl && (
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <Image src={logoUrl} alt={photographerName} fill unoptimized className="object-contain" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-white mb-2">{portfolioTitle}</h1>
            <p className="text-white/60 text-sm">{photographerName}</p>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-bounce">
            <span className="text-white/50 text-xs">גלגלי למטה לבחירה</span>
            <ChevronDown size={20} className="text-white/50" />
          </div>
        </div>
      ) : (
        <div
          className="relative flex items-center justify-center py-14 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="relative z-10 text-center px-6">
            {logoUrl && (
              <div className="w-20 h-20 mx-auto mb-5 relative">
                <Image src={logoUrl} alt={photographerName} fill unoptimized className="object-contain" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-white drop-shadow mb-2">{portfolioTitle}</h1>
            <p className="text-white/70 text-sm">{photographerName}</p>
          </div>
        </div>
      )}

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">

          {/* Progress + send button row */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar selected={approvedCount} quota={quota} color={color} />
            </div>
            {showSendButton && (
              <button
                type="button"
                onClick={sendReport}
                disabled={sendingReport || approvedCount === 0}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: color, color: '#fff' }}
              >
                <Send size={12} />
                {sendingReport ? 'שולח...' : 'שלח לצלמת'}
              </button>
            )}
          </div>

          {/* Tab row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setTab('gallery')}
              className="shrink-0 px-3 py-1 rounded-md text-xs font-medium transition"
              style={tab === 'gallery' ? { background: color, color: '#fff' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              גלריה
            </button>
            <button
              onClick={() => setTab('selected')}
              className="shrink-0 px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1"
              style={tab === 'selected' ? { background: color, color: '#fff' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              נבחרו
              {approvedCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px]">{approvedCount}</span>
              )}
            </button>

            <div className="w-px h-4 bg-white/20 shrink-0" />

            {/* Session tabs */}
            {tab === 'gallery' && (
              <>
                <button onClick={() => setActiveSession('all')}
                  className="shrink-0 px-3 py-1 rounded-md text-xs font-medium transition"
                  style={activeSession === 'all' ? { background: 'rgba(255,255,255,0.2)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  הכל ({allPhotos.length})
                </button>
                {sessions.map(s => (
                  <button key={s.id} onClick={() => setActiveSession(s.id)}
                    className="shrink-0 px-3 py-1 rounded-md text-xs font-medium transition"
                    style={activeSession === s.id ? { background: 'rgba(255,255,255,0.2)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                    {s.name} ({(s.photos || []).length})
                  </button>
                ))}
              </>
            )}

            {/* Compare hint */}
            {compareQueue.length > 0 && (
              <span className="shrink-0 mr-auto px-3 py-1 rounded-md text-xs font-medium border"
                style={{ borderColor: color, color }}>
                <GitCompare size={12} className="inline mr-1" />
                {compareQueue.length === 1 ? 'בחרי עוד תמונה להשוואה' : 'פותח השוואה...'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Instructions banner (below header, above gallery) ── */}
      {instructions && tab === 'gallery' && (
        <div className="max-w-7xl mx-auto px-4 pt-5">
          <p className="text-white/60 text-sm leading-relaxed italic border-r-2 pr-3"
            style={{ borderColor: color }}>
            {instructions}
          </p>
        </div>
      )}

      {/* ── Selected tab ── */}
      {tab === 'selected' && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          {approvedPhotos.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <Check size={36} strokeWidth={1.2} className="mx-auto mb-3 opacity-40" />
              <p>עדיין לא בחרת תמונות</p>
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
              {approvedPhotos.map(photo => (
                <div key={photo.id} className="break-inside-avoid relative group">
                  <div className="relative rounded-lg overflow-hidden bg-stone-900">
                    <Image
                      src={photo.thumbnail_url || photo.url}
                      alt={photo.name || ''}
                      width={600} height={400}
                      unoptimized
                      className="w-full h-auto object-cover"
                    />
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: STATUS_COLOR.approved }}>
                      <Check size={12} className="text-white" />
                    </div>
                    {photo.name && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white/80 text-[10px] px-2 py-1 truncate">
                        {photo.name}
                      </div>
                    )}
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleMark(photo.id, null)}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="הסר בחירה"
                    >
                      <X size={13} className="text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Completed banner ── */}
      {isDone && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.15)' }}>
            <span className="text-xl shrink-0">🔒</span>
            <p className="text-white/80 leading-snug">
              <span className="font-semibold text-white">הצלמת סיימה לטפל בתיק שלך</span>
              <br />
              <span className="text-white/60 text-xs">לא ניתן לשנות בחירת תמונות</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Gallery grid ── */}
      {tab === 'gallery' && (
        <div ref={galleryRef} className="max-w-7xl mx-auto px-3 py-6">
          {visiblePhotos.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-white/30">
              אין תמונות בסשן זה
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
              {visiblePhotos.map((photo, i) => {
                const status = selections[photo.id] ?? null
                const inCompare = compareQueue.includes(photo.id)
                const canApprove = status === 'approved' || !isApproveBlocked
                return (
                  <div
                    key={photo.id}
                    className="break-inside-avoid relative group cursor-pointer photo-enter"
                    style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
                  >
                    <div
                      className="relative rounded-lg overflow-hidden bg-stone-900"
                      onClick={() => setLightbox(photo)}
                    >
                      <Image
                        src={photo.thumbnail_url || photo.url}
                        alt={photo.name || ''}
                        width={600}
                        height={400}
                        unoptimized
                        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {/* Status badge */}
                      {status && (
                        <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg"
                          style={{ background: STATUS_COLOR[status] }}>
                          {status === 'approved' ? <Check size={14} /> : status === 'rejected' ? <X size={14} /> : <HelpCircle size={14} />}
                        </div>
                      )}

                      {/* Compare ring */}
                      {inCompare && (
                        <div className="absolute inset-0 rounded-lg" style={{ outline: `3px solid ${color}`, outlineOffset: '-3px' }} />
                      )}

                      {/* Photo name — hover on desktop, always visible on mobile */}
                      {photo.name && (
                        <div className="absolute inset-x-0 top-0 px-2 pt-1.5 pb-4 pointer-events-none
                          opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }}>
                          <p className="text-white/90 text-[10px] truncate" dir="ltr">{photo.name}</p>
                        </div>
                      )}

                      {/* Action buttons - always visible on mobile, hover on desktop */}
                      {!isDone && (
                      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-3 pt-6
                        opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                        <button type="button"
                          disabled={!canApprove}
                          onClick={e => { e.stopPropagation(); handleMark(photo.id, status === 'approved' ? null : 'approved') }}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-green-600 hover:bg-green-500 hover:text-white transition-all active:scale-90 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                          title={!canApprove ? `הגעת למגבלה של ${quota} תמונות` : undefined}>
                          <Check size={16} />
                        </button>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); handleMark(photo.id, status === 'maybe' ? null : 'maybe') }}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-white transition-all active:scale-90 shadow">
                          <HelpCircle size={16} />
                        </button>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); handleMark(photo.id, status === 'rejected' ? null : 'rejected') }}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow">
                          <X size={16} />
                        </button>
                        <button type="button"
                          onClick={e => handleToggleCompare(photo.id, e)}
                          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shadow"
                          style={inCompare
                            ? { background: color, color: '#fff' }
                            : { background: 'rgba(255,255,255,0.9)', color: '#3b82f6' }}
                          title="השוואה">
                          <GitCompare size={14} />
                        </button>
                      </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            ref={lightboxContainerRef}
            className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center overflow-hidden"
            onClick={e => e.stopPropagation()}
            onMouseDown={lbMouseDown}
            onMouseMove={lbMouseMove}
            onMouseUp={lbMouseUp}
            onMouseLeave={lbMouseUp}
            onTouchStart={lbTouchStart}
            onTouchMove={lbTouchMove}
            onTouchEnd={lbTouchEnd}
            style={{ cursor: lbGrabbing ? 'grabbing' : lightboxZoom > 100 ? 'grab' : 'default' }}
          >
            <Image
              src={lightbox.url}
              alt={lightbox.name || ''}
              fill unoptimized
              draggable={false}
              className="object-contain pointer-events-none select-none"
              style={{
                transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom / 100})`,
                transformOrigin: 'center',
              }}
            />

            {/* Navigation arrows */}
            {visiblePhotos.length > 1 && (
              <>
                <button type="button" onClick={e => { e.stopPropagation(); moveLightbox(1) }}
                  className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-10">
                  <ChevronRight size={24} />
                </button>
                <button type="button" onClick={e => { e.stopPropagation(); moveLightbox(-1) }}
                  className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-10">
                  <ChevronLeft size={24} />
                </button>
              </>
            )}

            {/* Photo name */}
            {lightbox.name && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-[70vw] truncate rounded-full bg-black/50 px-3 py-1 text-xs text-white/70 z-10" dir="ltr">
                {lightbox.name}
              </div>
            )}

            {/* Zoom controls */}
            <div
              className="absolute bottom-16 right-4 flex flex-col items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-xl p-2 z-10"
              onMouseDown={e => e.stopPropagation()}
            >
              <button type="button" onClick={lbZoomIn}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/15 rounded-lg transition">
                <ZoomIn size={14} className="text-white" />
              </button>
              <span className="text-[11px] text-white/70 font-mono w-10 text-center select-none">{lightboxZoom}%</span>
              <button type="button" onClick={lbZoomOut} disabled={lightboxZoom <= 100}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/15 rounded-lg transition disabled:opacity-30">
                <ZoomOut size={14} className="text-white" />
              </button>
            </div>

            {/* Selection buttons */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-10">
              {(['approved', 'maybe', 'rejected'] as SelectionStatus[]).map(s => {
                const blocked = s === 'approved' && isApproveBlocked && selections[lightbox.id] !== 'approved'
                return (
                  <button key={s} type="button"
                    disabled={blocked}
                    onClick={() => { handleMark(lightbox.id, selections[lightbox.id] === s ? null : s); setLightbox(null) }}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-all active:scale-90 shadow-xl disabled:opacity-40"
                    style={{ background: selections[lightbox.id] === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.15)' }}>
                    {s === 'approved' ? <Check size={18} /> : s === 'rejected' ? <X size={18} /> : <HelpCircle size={18} />}
                  </button>
                )
              })}
            </div>

            {/* Close button */}
            <button type="button" onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 text-white/50 hover:text-white p-2 z-10">
              <X size={22} />
            </button>
          </div>
        </div>
      )}

      {/* Compare modal */}
      {comparePhotos && (
        <CompareModal
          photos={comparePhotos}
          selections={selections}
          isApproveBlocked={isApproveBlocked}
          onMark={handleMark}
          onClose={() => setComparePhotos(null)}
        />
      )}

      {/* ── Chat floating button ── */}
      <button
        type="button"
        onClick={() => {
          if (!showChat) setUnreadFromPhotographer(0)
          setShowChat(v => !v)
        }}
        className="fixed bottom-5 left-4 z-50 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-95"
        style={{ background: color }}
        title="הודעות לצלמת"
      >
        {showChat ? <X size={20} className="text-white" /> : <MessageCircle size={20} className="text-white" />}
        {!showChat && unreadFromPhotographer > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold px-0.5">
            {unreadFromPhotographer}
          </span>
        )}
      </button>

      {/* ── Chat panel ── */}
      {showChat && (
        <div className="fixed bottom-20 left-4 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
          style={{ maxHeight: '70vh' }}>
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between"
            style={{ background: color + '12' }}>
            <p className="font-semibold text-stone-700 text-sm">הודעות לצלמת</p>
            <button type="button" onClick={() => setShowChat(false)}>
              <X size={16} className="text-stone-400 hover:text-stone-600" />
            </button>
          </div>
          <NoteChat
            fetchUrl={`/api/notes/${portfolioId}`}
            postUrl={`/api/notes/${portfolioId}`}
            mySender="client"
            brandColor={color}
          />
        </div>
      )}
    </div>
  )
}
