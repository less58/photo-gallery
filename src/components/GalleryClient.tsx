'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Check, X, HelpCircle, GitCompare, ChevronDown, Send } from 'lucide-react'
import type { Session, Photo, Selection, SelectionStatus } from '@/lib/types'
import ProgressBar from './ProgressBar'
import CompareModal from './CompareModal'
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
}

const STATUS_COLOR: Record<SelectionStatus, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

type GalleryTab = 'gallery' | 'selected'

export default function GalleryClient({
  sessions, allPhotos, initialSelections, quota, color,
  coverUrl, instructions, photographerName, logoUrl, portfolioTitle,
}: Props) {
  const toast = useToast()
  const [activeSession, setActiveSession] = useState<string | 'all'>('all')
  const [selections, setSelections] = useState<Record<string, SelectionStatus>>(() => {
    const m: Record<string, SelectionStatus> = {}
    initialSelections.forEach(s => { m[s.photo_id] = s.status })
    return m
  })
  const [compareMode, setCompareMode] = useState(false)
  const [compareQueue, setCompareQueue] = useState<string[]>([])
  const [comparePhotos, setComparePhotos] = useState<[Photo, Photo] | null>(null)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [tab, setTab] = useState<GalleryTab>('gallery')
  const [sendingReport, setSendingReport] = useState(false)
  const galleryRef = useRef<HTMLDivElement>(null)

  const visiblePhotos = activeSession === 'all'
    ? allPhotos
    : allPhotos.filter(p => p.session_id === activeSession)

  const approvedCount = Object.values(selections).filter(s => s === 'approved').length
  const approvedPhotos = allPhotos.filter(p => selections[p.id] === 'approved')

  const handleMark = useCallback(async (photoId: string, status: SelectionStatus | null) => {
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
  }, [selections, quota, toast])

  const handleToggleCompare = useCallback((photoId: string) => {
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
      {coverUrl && (
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
      )}

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">

          {/* Progress + send button row */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar selected={approvedCount} quota={quota} color={color} />
            </div>
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
          </div>

          {/* Instructions as plain text */}
          {instructions && (
            <p className="text-white/50 text-xs leading-relaxed">{instructions}</p>
          )}

          {/* Tab row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {/* Gallery / Selected tabs */}
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

            <button onClick={() => { setCompareMode(m => !m); setCompareQueue([]) }}
              className="shrink-0 mr-auto px-3 py-1 rounded-md text-xs font-medium border transition"
              style={compareMode
                ? { background: color, color: '#fff', borderColor: color }
                : { borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}>
              <GitCompare size={12} className="inline mr-1" />
              השוואה
            </button>
          </div>
        </div>
      </div>

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
                      onClick={() => !compareMode && setLightbox(photo)}
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

                      {/* Action buttons overlay */}
                      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-3 pt-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
                        {compareMode && (
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleToggleCompare(photo.id) }}
                            className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-90 shadow">
                            <GitCompare size={14} />
                          </button>
                        )}
                      </div>
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
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center"
            onClick={e => e.stopPropagation()}>
            <Image
              src={lightbox.url}
              alt={lightbox.name || ''}
              fill unoptimized
              className="object-contain"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
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
            <button type="button" onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 text-white/50 hover:text-white p-2">
              <X size={22} />
            </button>
          </div>
        </div>
      )}

      {/* Compare modal */}
      {comparePhotos && (
        <CompareModal photos={comparePhotos} onClose={() => setComparePhotos(null)} />
      )}
    </div>
  )
}
