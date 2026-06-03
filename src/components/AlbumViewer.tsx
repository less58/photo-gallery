'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react'
import type { Album } from '@/lib/types'

function getPageUrl(album: Album, idx: number): string {
  if (album.image_urls?.length) return album.image_urls[idx] ?? ''
  const page = idx + 1
  return (album.pdf_url ?? '').replace('/upload/', `/upload/pg_${page},f_jpg,w_1800,q_auto:best/`)
}

type Props = {
  album: Album
  onClose: () => void
  allowDownload?: boolean
}

export default function AlbumViewer({ album, onClose, allowDownload = false }: Props) {
  const totalPages = album.image_urls?.length ?? album.page_count
  const isImageAlbum = !!album.image_urls?.length

  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // Slide animation
  const [animating, setAnimating] = useState(false)
  const [slideDir, setSlideDir] = useState<'next' | 'prev'>('next')
  const animTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // In RTL (Hebrew): left = next page, right = prev page
  const goNext = useCallback(() => {
    if (animating || idx >= totalPages - 1) return
    setSlideDir('next')
    setAnimating(true)
    setLoaded(false)
    animTimeout.current = setTimeout(() => {
      setIdx(i => i + 1)
      setAnimating(false)
    }, 180)
  }, [animating, idx, totalPages])

  const goPrev = useCallback(() => {
    if (animating || idx <= 0) return
    setSlideDir('prev')
    setAnimating(true)
    setLoaded(false)
    animTimeout.current = setTimeout(() => {
      setIdx(i => i - 1)
      setAnimating(false)
    }, 180)
  }, [animating, idx])

  useEffect(() => {
    return () => { if (animTimeout.current) clearTimeout(animTimeout.current) }
  }, [])

  useEffect(() => {
    setLoaded(false)
    setZoom(1)
  }, [idx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goNext()   // RTL: ← = forward
      if (e.key === 'ArrowRight') goPrev()  // RTL: → = back
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom(z => Math.min(3, +(z + 0.2).toFixed(1))) }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1))) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goNext, goPrev])

  async function downloadAlbum() {
    if (downloading) return
    setDownloading(true)
    try {
      if (isImageAlbum && album.image_urls) {
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        for (let i = 0; i < album.image_urls.length; i++) {
          const res = await fetch(album.image_urls[i])
          const blob = await res.blob()
          const ext = blob.type.split('/')[1]?.split('+')[0] || 'jpg'
          zip.file(`${String(i + 1).padStart(3, '0')}.${ext}`, blob)
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(zipBlob)
        a.download = `${album.name}.zip`
        a.click()
        URL.revokeObjectURL(a.href)
      } else if (album.pdf_url) {
        const a = document.createElement('a')
        a.href = album.pdf_url
        a.download = `${album.name}.pdf`
        a.target = '_blank'
        a.click()
      }
    } catch { /* ignore */ }
    setDownloading(false)
  }

  const currentUrl = getPageUrl(album, idx)

  // Slide translate direction
  const translateX = animating
    ? (slideDir === 'next' ? '-6%' : '6%')
    : '0%'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: '#111' }}
      dir="rtl"
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 gap-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Album name + page counter */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{album.name}</span>
          <span className="text-white/40 text-xs shrink-0 tabular-nums">
            {idx + 1} / {totalPages}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom */}
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg px-1">
            <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)))}
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white rounded transition"
              title="הקטן">
              <ZoomOut size={14} />
            </button>
            <span className="text-white/50 text-[11px] w-9 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))}
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white rounded transition"
              title="הגדל">
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Download */}
          {allowDownload && (
            <button
              onClick={downloadAlbum}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition disabled:opacity-40"
            >
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              <span className="hidden sm:inline">{downloading ? 'מוריד...' : 'הורד'}</span>
            </button>
          )}

          {/* Close */}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Main image area ── */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onClick={onClose}
      >
        {/* LEFT arrow = NEXT (RTL forward) */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); goNext() }}
          disabled={idx >= totalPages - 1}
          className="absolute left-3 z-10 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15 disabled:cursor-default"
          aria-label="עמוד הבא"
        >
          <ChevronLeft size={26} />
        </button>

        {/* Image */}
        <div
          className="flex-1 h-full flex items-center justify-center px-20 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="relative flex items-center justify-center w-full h-full"
            style={{
              transform: `translateX(${translateX}) scale(${zoom})`,
              opacity: animating ? 0 : (loaded ? 1 : 0.3),
              transition: animating ? 'opacity 0.18s ease, transform 0.18s ease' : 'opacity 0.25s ease',
              transformOrigin: 'center center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentUrl}
              src={currentUrl}
              alt={`עמוד ${idx + 1}`}
              draggable={false}
              onLoad={() => setLoaded(true)}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
              style={{ maxHeight: 'calc(100vh - 130px)' }}
            />
            {!loaded && !animating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={32} className="text-white/30 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT arrow = PREV (RTL back) */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); goPrev() }}
          disabled={idx <= 0}
          className="absolute right-3 z-10 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15 disabled:cursor-default"
          aria-label="עמוד קודם"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      {/* ── Page dots ── */}
      <div
        className="shrink-0 flex items-center justify-center gap-1.5 py-3"
        onClick={e => e.stopPropagation()}
      >
        {Array.from({ length: Math.min(totalPages, 30) }, (_, i) => (
          <button
            key={i}
            onClick={() => { setLoaded(false); setIdx(i) }}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              background: i === idx ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
        {totalPages > 30 && (
          <span className="text-white/30 text-xs mr-1">+{totalPages - 30}</span>
        )}
      </div>
    </div>
  )
}
