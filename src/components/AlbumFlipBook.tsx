'use client'

import { useRef, useState, useEffect, forwardRef } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { ChevronLeft, ChevronRight, X, Download, Loader2 } from 'lucide-react'
import type { Album } from '@/lib/types'

function getDisplayUrl(url: string): string {
  return url.replace('/upload/', '/upload/w_1200,q_auto:best,f_jpg/')
}

function playFlipSound() {
  try {
    const ctx = new AudioContext()
    const len = Math.floor(ctx.sampleRate * 0.1)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5) * 0.4
    const src = ctx.createBufferSource(); src.buffer = buf
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.8
    src.connect(f); f.connect(ctx.destination); src.start()
  } catch { /* ignore */ }
}

// react-pageflip requires page children to be forwardRef components
const Page = forwardRef<HTMLDivElement, { url: string }>(({ url }, ref) => (
  <div ref={ref} style={{ overflow: 'hidden', background: '#f5f2ee', position: 'relative' }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={url}
      alt=""
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  </div>
))
Page.displayName = 'Page'

type Props = { album: Album; onClose: () => void; allowDownload?: boolean }

export default function AlbumFlipBook({ album, onClose, allowDownload = false }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [pageW, setPageW] = useState(360)
  const [pageH, setPageH] = useState(540)

  const imageUrls = album.image_urls ?? []
  const total = imageUrls.length
  const urls = imageUrls.map(getDisplayUrl)

  // Portrait page sizing — fills available screen height
  useEffect(() => {
    function calc() {
      const availH = window.innerHeight - 130
      const availW = window.innerWidth - 180  // space for two arrow buttons
      // 2:3 aspect ratio (portrait)
      const wFromH = Math.floor(availH * 0.667)
      const w = Math.min(wFromH, availW, 480)
      const h = Math.min(Math.floor(w * 1.5), availH)
      setPageW(w)
      setPageH(h)
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
      const a = document.createElement('a'); a.href = URL.createObjectURL(zipBlob)
      a.download = `${album.name}.zip`; a.click(); URL.revokeObjectURL(a.href)
    } catch { /* ignore */ }
    setDownloading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col select-none" style={{ background: '#111' }} dir="rtl">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 gap-4"
        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{album.name}</span>
          <span className="text-white/40 text-xs tabular-nums shrink-0">{currentPage + 1} / {total}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allowDownload && (
            <button onClick={downloadAlbum} disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition disabled:opacity-40">
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              <span className="hidden sm:inline">{downloading ? 'מוריד...' : 'הורד'}</span>
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Flipbook area — LTR wrapper so react-pageflip renders correctly */}
      <div className="flex-1 flex items-center justify-center gap-4 overflow-hidden px-3" dir="ltr">
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          disabled={currentPage <= 0}
          className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20"
          aria-label="previous"
        >
          <ChevronLeft size={26} />
        </button>

        <HTMLFlipBook
          ref={bookRef}
          width={pageW}
          height={pageH}
          size="fixed"
          minWidth={150}
          maxWidth={520}
          minHeight={220}
          maxHeight={780}
          usePortrait={true}
          showCover={false}
          flippingTime={700}
          drawShadow={true}
          maxShadowOpacity={0.55}
          startPage={0}
          startZIndex={1}
          autoSize={false}
          mobileScrollSupport={false}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
          useMouseEvents={true}
          clickEventForward={false}
          style={{
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.5)',
          }}
          className=""
          onFlip={(e: { data: number }) => {
            setCurrentPage(e.data)
            playFlipSound()
          }}
        >
          {urls.map((url, i) => (
            <Page key={`${url}-${i}`} url={url} />
          ))}
        </HTMLFlipBook>

        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipNext()}
          disabled={currentPage >= total - 1}
          className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20"
          aria-label="next"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      {/* Page dots */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
        {Array.from({ length: Math.min(total, 30) }, (_, i) => (
          <button
            key={i}
            onClick={() => bookRef.current?.pageFlip().flip(i)}
            className="rounded-full transition-all"
            style={{
              width: i === currentPage ? 20 : 6,
              height: 6,
              background: i === currentPage ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
        {total > 30 && <span className="text-white/30 text-xs ml-1">+{total - 30}</span>}
      </div>
    </div>
  )
}
