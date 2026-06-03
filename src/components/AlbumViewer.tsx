'use client'

import React, { useRef, useState, useEffect, forwardRef } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, X, BookOpen, ZoomIn, ZoomOut, Download } from 'lucide-react'
import type { Album } from '@/lib/types'

type AnyComponent = React.ComponentType<any> // eslint-disable-line @typescript-eslint/no-explicit-any
const HTMLFlipBook = dynamic(() => import('react-pageflip').then(m => m.default as AnyComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  ),
})

function getPageUrl(album: Album, pageIdx: number): string {
  if (album.image_urls?.length) {
    return album.image_urls[pageIdx] ?? ''
  }
  const page = pageIdx + 1
  return (album.pdf_url ?? '').replace('/upload/', `/upload/pg_${page},f_jpg,w_1800,q_auto:best/`)
}

const AlbumPage = forwardRef<HTMLDivElement, { url: string; pageNum: number }>(
  ({ url, pageNum }, ref) => {
    const [loaded, setLoaded] = useState(false)
    return (
      <div ref={ref} className="overflow-hidden bg-stone-200 select-none">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-200">
            <div className="w-6 h-6 border-2 border-stone-400 border-t-stone-700 rounded-full animate-spin" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`עמוד ${pageNum}`}
          className="w-full h-full object-cover"
          draggable={false}
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        />
      </div>
    )
  }
)
AlbumPage.displayName = 'AlbumPage'

type Props = {
  album: Album
  onClose: () => void
  allowDownload?: boolean
}

export default function AlbumViewer({ album, onClose, allowDownload = false }: Props) {
  const bookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; getCurrentPageIndex: () => number } }>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [bookDims, setBookDims] = useState({ w: 400, h: 267 })
  const [mounted, setMounted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [downloading, setDownloading] = useState(false)

  const pageCount = album.image_urls?.length ?? album.page_count
  const isImageAlbum = !!album.image_urls?.length

  useEffect(() => {
    setMounted(true)
    function calc() {
      const maxW = Math.min(Math.floor((window.innerWidth - 180) / 2), 540)
      const w = Math.max(maxW, 180)
      setBookDims({ w, h: Math.round(w * 0.667) })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') bookRef.current?.pageFlip().flipNext()
      if (e.key === 'ArrowLeft') bookRef.current?.pageFlip().flipPrev()
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom(z => Math.min(2, +(z + 0.15).toFixed(2))) }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(z => Math.max(0.4, +(z - 0.15).toFixed(2))) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pages = Array.from({ length: pageCount }, (_, i) => i)
  const isFirst = currentPage === 0
  const isLast = currentPage >= pageCount - 1

  const totalViews = 1 + Math.ceil((pageCount - 1) / 2)
  const currentView = currentPage === 0 ? 0 : Math.floor((currentPage + 1) / 2)

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

  function pageLabel() {
    if (currentPage === 0) return 'שער'
    const p1 = currentPage
    const p2 = Math.min(currentPage + 1, pageCount)
    return p1 === p2 ? `עמוד ${p1}` : `עמודים ${p1}–${p2}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1008] flex flex-col" onClick={onClose}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0 gap-4"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-amber-200/80 min-w-0">
          <BookOpen size={16} className="shrink-0" />
          <span className="font-medium text-sm truncate">{album.name}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-white/40 text-xs hidden sm:block">
            {pageLabel()} · {pageCount} עמודים
          </span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-1 py-0.5">
            <button
              onClick={() => setZoom(z => Math.max(0.4, +(z - 0.15).toFixed(2)))}
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white transition rounded"
              title="הקטן (Ctrl -)"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-white/50 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))}
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white transition rounded"
              title="הגדל (Ctrl +)"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Download */}
          {allowDownload && (
            <button
              onClick={downloadAlbum}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition disabled:opacity-40"
              title="הורד אלבום"
            >
              <Download size={13} />
              <span className="hidden sm:inline">{downloading ? 'מוריד...' : 'הורד'}</span>
            </button>
          )}

          <button onClick={onClose} className="text-white/50 hover:text-white transition p-1">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Book area */}
      <div
        className="flex-1 flex items-center justify-center gap-6 px-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          disabled={isFirst}
          className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={26} />
        </button>

        <div
          className="relative overflow-hidden"
          style={{
            filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.7))',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }}
        >
          {mounted && pageCount > 0 ? (
            <HTMLFlipBook
              ref={bookRef as React.Ref<unknown>}
              width={bookDims.w}
              height={bookDims.h}
              showCover={true}
              drawShadow={true}
              flippingTime={700}
              useMouseEvents={true}
              usePortrait={false}
              startZIndex={10}
              autoSize={false}
              maxShadowOpacity={0.5}
              mobileScrollSupport={false}
              showPageCorners={true}
              disableFlipByClick={false}
              className=""
              style={{}}
              onFlip={(e: { data: number }) => setCurrentPage(e.data)}
            >
              {pages.map(i => (
                <AlbumPage key={i} url={getPageUrl(album, i)} pageNum={i + 1} />
              ))}
            </HTMLFlipBook>
          ) : (
            <div className="flex items-center justify-center" style={{ width: bookDims.w * 2, height: bookDims.h }}>
              <div className="w-10 h-10 border-2 border-amber-300/40 border-t-amber-300 rounded-full animate-spin" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipNext()}
          disabled={isLast}
          className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      {/* Page indicator dots */}
      <div
        className="flex items-center justify-center gap-1.5 py-3 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {Array.from({ length: totalViews }, (_, i) => (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === currentView ? 20 : 6,
              height: 6,
              background: i === currentView ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
