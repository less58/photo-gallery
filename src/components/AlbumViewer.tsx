'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react'
import type { Album } from '@/lib/types'

function getPageUrl(album: Album, idx: number): string {
  if (album.image_urls?.length) {
    const url = album.image_urls[idx] ?? ''
    return url.replace('/upload/', '/upload/w_1800,q_auto:best,f_jpg/')
  }
  const page = idx + 1
  return (album.pdf_url ?? '').replace('/upload/', `/upload/pg_${page},f_jpg,w_1800,q_auto:best/`)
}

type Props = {
  album: Album
  onClose: () => void
  allowDownload?: boolean
}

type AnimState = 'idle' | 'exiting' | 'entering'

const EXIT_MS = 220

export default function AlbumViewer({ album, onClose, allowDownload = false }: Props) {
  const totalPages = album.image_urls?.length ?? album.page_count
  const isImageAlbum = !!album.image_urls?.length

  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [animState, setAnimState] = useState<AnimState>('idle')
  const [animDir, setAnimDir] = useState<'next' | 'prev'>('next')
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enteringRef = useRef(false)

  // Preload adjacent images for instant navigation
  useEffect(() => {
    const toPreload = [idx - 1, idx + 1].filter(i => i >= 0 && i < totalPages)
    toPreload.forEach(i => {
      const img = new window.Image()
      img.src = getPageUrl(album, i)
    })
  }, [idx, album, totalPages])

  const goNext = useCallback(() => {
    if (animState !== 'idle' || idx >= totalPages - 1) return
    setAnimDir('next')
    setAnimState('exiting')
    exitTimerRef.current = setTimeout(() => {
      setIdx(i => i + 1)
      setAnimState('entering')
    }, EXIT_MS)
  }, [animState, idx, totalPages])

  const goPrev = useCallback(() => {
    if (animState !== 'idle' || idx <= 0) return
    setAnimDir('prev')
    setAnimState('exiting')
    exitTimerRef.current = setTimeout(() => {
      setIdx(i => i - 1)
      setAnimState('entering')
    }, EXIT_MS)
  }, [animState, idx])

  // 'entering' → 'idle' via double-RAF so CSS transition plays from offset to center
  useEffect(() => {
    if (animState !== 'entering') return
    enteringRef.current = true
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (enteringRef.current) {
          setAnimState('idle')
          enteringRef.current = false
        }
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => {
      cancelAnimationFrame(raf1)
      enteringRef.current = false
    }
  }, [animState])

  useEffect(() => () => { if (exitTimerRef.current) clearTimeout(exitTimerRef.current) }, [])

  useEffect(() => {
    setLoaded(false)
    setZoom(1)
  }, [idx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goNext()
      if (e.key === 'ArrowRight') goPrev()
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

  // Flip-style animation: exit slides out, enter slides in from opposite side
  const imageStyle: React.CSSProperties = (() => {
    switch (animState) {
      case 'exiting':
        return {
          transform: `translateX(${animDir === 'next' ? '-60%' : '60%'}) scale(0.85)`,
          opacity: 0,
          transition: `transform ${EXIT_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${EXIT_MS}ms ease`,
        }
      case 'entering':
        return {
          transform: `translateX(${animDir === 'next' ? '50%' : '-50%'}) scale(0.9)`,
          opacity: 0,
          transition: 'none',
        }
      case 'idle':
        return {
          transform: `translateX(0) scale(${zoom})`,
          opacity: loaded ? 1 : 0.25,
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease',
          transformOrigin: 'center center',
        }
    }
  })()

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
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{album.name}</span>
          <span className="text-white/40 text-xs shrink-0 tabular-nums">
            {idx + 1} / {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg px-1">
            <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)))}
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white rounded transition">
              <ZoomOut size={14} />
            </button>
            <span className="text-white/50 text-[11px] w-9 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))}
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white rounded transition">
              <ZoomIn size={14} />
            </button>
          </div>

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
          className="absolute left-3 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15 disabled:cursor-default"
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
            style={imageStyle}
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
            {!loaded && animState === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
          className="absolute right-3 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15 disabled:cursor-default"
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
            onClick={() => {
              if (animState !== 'idle') return
              setLoaded(false)
              setIdx(i)
            }}
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
