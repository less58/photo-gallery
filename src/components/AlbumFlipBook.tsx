'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Download, Loader2 } from 'lucide-react'
import type { Album } from '@/lib/types'

function getDisplayUrl(url: string): string {
  return url.replace('/upload/', '/upload/w_1200,q_auto:best,f_jpg/')
}

/** Paper-rustle sound synthesised via Web Audio — no file needed */
function playFlipSound() {
  try {
    const ctx = new AudioContext()
    const len = Math.floor(ctx.sampleRate * 0.11)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6) * 0.45
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 3200
    filt.Q.value = 0.9
    src.connect(filt)
    filt.connect(ctx.destination)
    src.start()
  } catch { /* AudioContext may require user gesture */ }
}

type AnimState = 'idle' | 'exiting' | 'entering'
const FLIP_MS = 320

type Props = {
  album: Album
  onClose: () => void
  allowDownload?: boolean
}

export default function AlbumFlipBook({ album, onClose, allowDownload = false }: Props) {
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [anim, setAnim] = useState<AnimState>('idle')
  const [animDir, setAnimDir] = useState<'next' | 'prev'>('next')
  const [downloading, setDownloading] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enterRef = useRef(false)

  const imageUrls = album.image_urls ?? []
  const total = imageUrls.length
  const urls = imageUrls.map(getDisplayUrl)

  // Preload adjacent images for instant flip
  useEffect(() => {
    [idx - 1, idx + 1].filter(i => i >= 0 && i < total).forEach(i => {
      const img = new window.Image()
      img.src = urls[i]
    })
  }, [idx, urls, total])

  useEffect(() => { setLoaded(false) }, [idx])

  const navigate = useCallback((dir: 'next' | 'prev') => {
    const newIdx = dir === 'next' ? idx + 1 : idx - 1
    if (anim !== 'idle' || newIdx < 0 || newIdx >= total) return
    playFlipSound()
    setAnimDir(dir)
    setAnim('exiting')
    timerRef.current = setTimeout(() => {
      setIdx(newIdx)
      setAnim('entering')
    }, FLIP_MS)
  }, [anim, idx, total])

  // entering → idle via double-RAF so CSS transition fires from offset position
  useEffect(() => {
    if (anim !== 'entering') return
    enterRef.current = true
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => {
        if (enterRef.current) { setAnim('idle'); enterRef.current = false }
      })
      return () => cancelAnimationFrame(r2)
    })
    return () => { cancelAnimationFrame(r1); enterRef.current = false }
  }, [anim])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') navigate('next')
      if (e.key === 'ArrowRight') navigate('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, navigate])

  async function downloadAlbum() {
    if (downloading || !album.image_urls) return
    setDownloading(true)
    try {
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
    } catch { /* ignore */ }
    setDownloading(false)
  }

  // 3D page-flip CSS — single portrait page, rotateY with perspective
  const pageStyle: React.CSSProperties = (() => {
    switch (anim) {
      case 'exiting':
        return {
          transform: `perspective(1400px) rotateY(${animDir === 'next' ? '-95deg' : '95deg'})`,
          opacity: 0,
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.55,0,0.8,0.4), opacity ${FLIP_MS * 0.5}ms ease`,
          transformOrigin: animDir === 'next' ? 'left center' : 'right center',
        }
      case 'entering':
        return {
          transform: `perspective(1400px) rotateY(${animDir === 'next' ? '95deg' : '-95deg'})`,
          opacity: 0,
          transition: 'none',
          transformOrigin: animDir === 'next' ? 'right center' : 'left center',
        }
      case 'idle':
        return {
          transform: 'perspective(1400px) rotateY(0deg)',
          opacity: loaded ? 1 : 0.25,
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.2,0,0.4,1), opacity 0.2s ease`,
          transformOrigin: 'center center',
        }
    }
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: '#1c1309' }}
      dir="rtl"
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 gap-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{album.name}</span>
          <span className="text-white/40 text-xs tabular-nums shrink-0">{idx + 1} / {total}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Page area ── */}
      <div className="flex-1 flex items-center justify-center gap-4 overflow-hidden px-3">

        {/* LEFT arrow = NEXT (RTL) */}
        <button
          type="button"
          onClick={() => navigate('next')}
          disabled={idx >= total - 1}
          className="shrink-0 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15"
          aria-label="עמוד הבא"
        >
          <ChevronLeft size={26} />
        </button>

        {/* The page — portrait aspect, 3D flip */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden"
          style={{ maxWidth: 'min(520px, calc(100vw - 180px))', height: '100%' }}
        >
          <div
            style={{
              ...pageStyle,
              position: 'relative',
              width: '100%',
              height: '100%',
              maxHeight: 'calc(100vh - 140px)',
              borderRadius: 4,
              boxShadow: anim !== 'idle'
                ? '0 8px 40px rgba(0,0,0,0.7)'
                : '6px 0 30px rgba(0,0,0,0.5), -2px 0 8px rgba(0,0,0,0.3)',
              background: '#111',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={urls[idx]}
              src={urls[idx]}
              alt={`עמוד ${idx + 1}`}
              draggable={false}
              onLoad={() => setLoaded(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            {!loaded && anim === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 size={28} className="text-white/30 animate-spin" />
              </div>
            )}
            {/* Book spine shadow on right side */}
            <div
              className="absolute inset-y-0 right-0 w-6 pointer-events-none"
              style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.35), transparent)' }}
            />
          </div>
        </div>

        {/* RIGHT arrow = PREV (RTL) */}
        <button
          type="button"
          onClick={() => navigate('prev')}
          disabled={idx <= 0}
          className="shrink-0 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15"
          aria-label="עמוד קודם"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      {/* ── Page dots ── */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
        {Array.from({ length: Math.min(total, 30) }, (_, i) => (
          <button
            key={i}
            onClick={() => {
              if (anim !== 'idle') return
              if (i !== idx) { setLoaded(false); setIdx(i) }
            }}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              background: i === idx ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
        {total > 30 && <span className="text-white/30 text-xs mr-1">+{total - 30}</span>}
      </div>
    </div>
  )
}
