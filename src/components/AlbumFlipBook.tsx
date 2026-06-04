'use client'

import { useRef, useState, useEffect, forwardRef } from 'react'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HTMLFlipBook = require('react-pageflip').HTMLFlipBook
import { ChevronLeft, ChevronRight, X, Download, Loader2 } from 'lucide-react'
import type { Album } from '@/lib/types'

function getDisplayUrl(url: string): string {
  return url.replace('/upload/', '/upload/w_1200,q_auto:best,f_jpg/')
}

/** Short paper-rustle synthesized via Web Audio — no file needed */
function playFlipSound() {
  try {
    const ctx = new AudioContext()
    const duration = 0.11
    const len = Math.floor(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / len
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.6) * 0.45
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
  } catch { /* ignore – AudioContext may be blocked before user gesture */ }
}

// react-pageflip requires each page to be a forwardRef component
const FlipPage = forwardRef<HTMLDivElement, { url: string; num: number }>(
  ({ url, num }, ref) => (
    <div
      ref={ref}
      style={{ overflow: 'hidden', background: '#0d0b09', position: 'relative' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`עמוד ${num}`}
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  )
)
FlipPage.displayName = 'FlipPage'

type Props = {
  album: Album
  onClose: () => void
  allowDownload?: boolean
}

export default function AlbumFlipBook({ album, onClose, allowDownload = false }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [dims, setDims] = useState({ w: 380, h: 510, portrait: true })

  const imageUrls = album.image_urls ?? []
  const total = imageUrls.length
  // Add blank last page when odd count (so two-page spread is complete)
  const pages = total % 2 !== 0 ? [...imageUrls, null] : imageUrls

  // Responsive sizing
  useEffect(() => {
    function calc() {
      const vw = window.innerWidth
      const vh = window.innerHeight - 140
      const isMobile = vw < 640
      if (isMobile) {
        // Portrait single-page view
        const w = Math.min(vw - 130, 380)
        const h = Math.min(Math.floor(w * 1.35), vh)
        setDims({ w: Math.min(w, Math.floor(h / 1.35)), h: Math.min(h, Math.floor(w * 1.35)), portrait: true })
      } else {
        // Two-page spread
        const w = Math.min(Math.floor((vw - 200) / 2), 440)
        const h = Math.min(Math.floor(w * 1.35), vh)
        const fw = Math.min(w, Math.floor(h / 1.35))
        setDims({ w: fw, h: Math.floor(fw * 1.35), portrait: false })
      }
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') bookRef.current?.pageFlip().flipNext()
      if (e.key === 'ArrowRight') bookRef.current?.pageFlip().flipPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const visibleImageIndex = dims.portrait ? currentPage : Math.floor(currentPage / 2)
  const totalImages = total

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: '#1a1208' }}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 gap-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{album.name}</span>
          <span className="text-white/40 text-xs tabular-nums shrink-0">
            {visibleImageIndex + 1} / {totalImages}
          </span>
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

      {/* Flipbook */}
      <div className="flex-1 flex items-center justify-center gap-3 overflow-hidden px-2" dir="ltr">
        {/* Prev arrow (left side in LTR context = prev in RTL reading) */}
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          disabled={currentPage <= 0}
          className="shrink-0 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15"
          aria-label="עמוד קודם"
        >
          <ChevronLeft size={26} />
        </button>

        <HTMLFlipBook
          ref={bookRef}
          width={dims.w}
          height={dims.h}
          size="fixed"
          flippingTime={680}
          drawShadow={true}
          showCover={false}
          usePortrait={dims.portrait}
          maxShadowOpacity={0.55}
          mobileScrollSupport={false}
          swipeDistance={25}
          showPageCorners={true}
          disableFlipByClick={false}
          startPage={0}
          startZIndex={1}
          autoSize={false}
          useMouseEvents={true}
          clickEventForward={false}
          style={{ direction: 'ltr' }}
          className=""
          onFlip={(e: { data: number }) => {
            setCurrentPage(e.data)
            playFlipSound()
          }}
        >
          {pages.map((url, i) =>
            url ? (
              <FlipPage key={`${url}-${i}`} url={getDisplayUrl(url)} num={i + 1} />
            ) : (
              // Blank last page for odd-count albums
              <div key="blank" style={{ background: '#0d0b09' }} />
            )
          )}
        </HTMLFlipBook>

        {/* Next arrow */}
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipNext()}
          disabled={currentPage >= pages.length - 1}
          className="shrink-0 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white transition disabled:opacity-15"
          aria-label="עמוד הבא"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      {/* Page dots – one per image */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
        {Array.from({ length: Math.min(totalImages, 30) }, (_, i) => (
          <button
            key={i}
            onClick={() => bookRef.current?.pageFlip().flip(dims.portrait ? i : i * 2)}
            className="rounded-full transition-all"
            style={{
              width: i === visibleImageIndex ? 20 : 6,
              height: 6,
              background: i === visibleImageIndex ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
        {totalImages > 30 && <span className="text-white/30 text-xs ml-1">+{totalImages - 30}</span>}
      </div>
    </div>
  )
}
