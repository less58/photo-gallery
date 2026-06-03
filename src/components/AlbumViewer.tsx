'use client'

import React, { useRef, useState, useEffect, forwardRef } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, X, BookOpen } from 'lucide-react'
import type { Album } from '@/lib/types'

// SSR-safe import — react-pageflip uses DOM APIs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>
// SSR-safe import — react-pageflip uses DOM APIs
const HTMLFlipBook = dynamic(() => import('react-pageflip').then(m => m.default as AnyComponent), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>,
})

// react-pageflip props (minimal subset for TypeScript)
type FlipBookProps = {
  width: number
  height: number
  showCover?: boolean
  drawShadow?: boolean
  flippingTime?: number
  useMouseEvents?: boolean
  usePortrait?: boolean
  startZIndex?: number
  autoSize?: boolean
  maxShadowOpacity?: number
  mobileScrollSupport?: boolean
  showPageCorners?: boolean
  disableFlipByClick?: boolean
  className?: string
  style?: React.CSSProperties
  onFlip?: (e: { data: number }) => void
  children: React.ReactNode
  ref?: React.Ref<unknown>
}

// Build Cloudinary transformation URL for a specific PDF page
function pageUrl(pdfUrl: string, page: number): string {
  return pdfUrl.replace('/upload/', `/upload/pg_${page},f_jpg,w_1800,q_auto:best/`)
}

// Each page must be a forwardRef component for react-pageflip
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
}

export default function AlbumViewer({ album, onClose }: Props) {
  const bookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; getCurrentPageIndex: () => number } }>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [bookDims, setBookDims] = useState({ w: 400, h: 267 })
  const [mounted, setMounted] = useState(false)

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

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') bookRef.current?.pageFlip().flipNext()
      if (e.key === 'ArrowLeft') bookRef.current?.pageFlip().flipPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pages = Array.from({ length: album.page_count }, (_, i) => i + 1)
  const isFirst = currentPage === 0
  const isLast = currentPage >= album.page_count - 1

  // Spread count for display: cover(1) + spreads
  const totalViews = 1 + Math.ceil((album.page_count - 1) / 2)
  // Current view index (0-based)
  const currentView = currentPage === 0 ? 0 : Math.floor((currentPage + 1) / 2)

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1008] flex flex-col" onClick={onClose}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-amber-200/80">
          <BookOpen size={16} />
          <span className="font-medium text-sm truncate max-w-xs">{album.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs">
            {currentPage === 0
              ? 'שער'
              : `עמודים ${currentPage}–${Math.min(currentPage + 1, album.page_count)}`}
            {' '}· {album.page_count} עמודים
          </span>
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
        {/* Left arrow — go to previous spread */}
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          disabled={isFirst}
          className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={26} />
        </button>

        {/* Flipbook */}
        <div className="relative" style={{ filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.7))' }}>
          {mounted && album.page_count > 0 ? (
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
              {pages.map(p => (
                <AlbumPage key={p} url={pageUrl(album.pdf_url, p)} pageNum={p} />
              ))}
            </HTMLFlipBook>
          ) : (
            <div className="flex items-center justify-center" style={{ width: bookDims.w * 2, height: bookDims.h }}>
              <div className="w-10 h-10 border-2 border-amber-300/40 border-t-amber-300 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Right arrow — go to next spread */}
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
