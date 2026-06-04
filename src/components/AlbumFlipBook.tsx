'use client'

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { ChevronLeft, ChevronRight, X, Download, Loader2 } from 'lucide-react'
import type { Album } from '@/lib/types'

function cloudinaryTransform(url: string, transform: string): string {
  return url.includes('/upload/') ? url.replace('/upload/', `/upload/${transform}/`) : url
}

function getDisplayUrl(url: string): string {
  return cloudinaryTransform(url, 'w_2200,q_auto:best,f_jpg')
}

function getThumbUrl(url: string, w: number, h: number): string {
  return cloudinaryTransform(url, `w_${w * 2},h_${h * 2},c_fill,q_auto:good,f_jpg`)
}

function getPageLabel(index: number): string {
  if (index === 0) return '1'
  const first = index * 2
  return `${first}-${first + 1}`
}

function pageIndexForImage(imageIndex: number): number {
  return imageIndex === 0 ? 0 : 1 + (imageIndex - 1) * 2
}

function imageIndexForPage(pageIndex: number): number {
  return pageIndex === 0 ? 0 : Math.floor((pageIndex - 1) / 2) + 1
}

const THUMB_H = 82
const DEFAULT_SPREAD_ASPECT = 2
const DEFAULT_COVER_ASPECT = 0.75

function playPageTurnSound() {
  try {
    const ctx = new AudioContext()
    const duration = 0.18
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) * 0.09
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1550
    filter.Q.value = 0.75
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.035)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    noise.start()
    noise.stop(ctx.currentTime + duration)
  } catch { /* ignore audio errors */ }
}

type PageProps =
  | { kind: 'cover'; url: string }
  | { kind: 'spread-half'; url: string; side: 'left' | 'right' }

const Page = forwardRef<HTMLDivElement, PageProps>((props, ref) => {
  if (props.kind === 'cover') {
    return (
      <div ref={ref} className="relative overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.url}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div ref={ref} className="relative overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${props.url})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '200% 100%',
          backgroundPosition: props.side === 'left' ? 'left center' : 'right center',
        }}
      />
      <div
        className="absolute inset-y-0 w-px bg-black/10"
        style={props.side === 'left' ? { right: 0 } : { left: 0 }}
      />
    </div>
  )
})
Page.displayName = 'AlbumFlipBookPage'

type Props = { album: Album; onClose: () => void; allowDownload?: boolean }

export default function AlbumFlipBook({ album, onClose, allowDownload = false }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [pageW, setPageW] = useState(360)
  const [pageH, setPageH] = useState(520)
  const [spreadAspect, setSpreadAspect] = useState(DEFAULT_SPREAD_ASPECT)
  const [coverAspect, setCoverAspect] = useState(DEFAULT_COVER_ASPECT)
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([])
  const isManualTurn = useRef(false)

  const imageUrls = useMemo(() => album.image_urls ?? [], [album.image_urls])
  const total = imageUrls.length
  const displayUrls = useMemo(() => imageUrls.map(getDisplayUrl), [imageUrls])

  useEffect(() => {
    const cover = imageUrls[0]
    if (!cover) return
    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setCoverAspect(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = getDisplayUrl(cover)
  }, [imageUrls])

  useEffect(() => {
    const firstSpread = imageUrls[1]
    if (!firstSpread) return
    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setSpreadAspect(Math.max(1.35, Math.min(2.4, img.naturalWidth / img.naturalHeight)))
      }
    }
    img.src = getDisplayUrl(firstSpread)
  }, [imageUrls])

  useEffect(() => {
    function calc() {
      const thumbnailH = THUMB_H + 32
      const headerH = 56
      const availH = window.innerHeight - headerH - thumbnailH - 40
      const availW = window.innerWidth - 168
      const pageAspect = spreadAspect / 2
      const pageFromH = Math.floor(availH * pageAspect)
      const pageFromW = Math.floor(availW / 2)
      const w = Math.max(170, Math.min(900, pageFromH, pageFromW))
      setPageW(w)
      setPageH(Math.floor(w / pageAspect))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [spreadAspect])

  useEffect(() => {
    thumbRefs.current[currentImageIndex]?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    })
  }, [currentImageIndex])

  useEffect(() => {
    const toPreload = [currentImageIndex - 1, currentImageIndex + 1].filter(i => i >= 0 && i < total)
    toPreload.forEach(i => {
      const img = new window.Image()
      img.src = getDisplayUrl(imageUrls[i])
    })
  }, [currentImageIndex, imageUrls, total])

  const goToImage = useCallback((imageIndex: number) => {
    isManualTurn.current = true
    bookRef.current?.pageFlip().turnToPage(pageIndexForImage(imageIndex))
    setCurrentImageIndex(imageIndex)
    setTimeout(() => { isManualTurn.current = false }, 600)
  }, [])

  const goNext = useCallback(() => {
    setCurrentImageIndex(current => {
      if (current >= total - 1) return current
      const next = current + 1
      bookRef.current?.pageFlip().flipNext()
      return next
    })
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentImageIndex(current => {
      if (current <= 0) return current
      const next = current - 1
      bookRef.current?.pageFlip().flipPrev()
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goNext()
      if (e.key === 'ArrowRight') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

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

  const coverThumbW = Math.round(THUMB_H * coverAspect)
  const spreadThumbW = Math.round(THUMB_H * spreadAspect)

  return (
    <div className="fixed inset-0 z-50 flex flex-col select-none bg-[#111]" dir="rtl">
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 gap-4"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{album.name}</span>
          <span className="text-white/45 text-xs tabular-nums shrink-0">
            {getPageLabel(currentImageIndex)}
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
            className="w-8 h-8 flex items-center justify-center text-white/55 hover:text-white transition rounded-lg hover:bg-white/10"
            aria-label="סגירה"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden px-4 sm:px-20 py-5" dir="ltr">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentImageIndex <= 0}
          className="absolute left-3 sm:left-6 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-default"
          aria-label="הקודם"
        >
          <ChevronLeft size={26} />
        </button>

        <HTMLFlipBook
          ref={bookRef}
          width={pageW}
          height={pageH}
          size="fixed"
          minWidth={160}
          maxWidth={900}
          minHeight={220}
          maxHeight={900}
          usePortrait={false}
          showCover={true}
          flippingTime={850}
          drawShadow={true}
          maxShadowOpacity={0.65}
          startPage={0}
          startZIndex={1}
          autoSize={false}
          mobileScrollSupport={false}
          swipeDistance={25}
          showPageCorners={true}
          disableFlipByClick={false}
          useMouseEvents={true}
          clickEventForward={false}
          style={{
            boxShadow: '0 24px 70px rgba(0,0,0,0.72), 0 5px 16px rgba(0,0,0,0.55)',
          }}
          className=""
          onFlip={(e: { data: number }) => {
            if (isManualTurn.current) return
            setCurrentImageIndex(Math.min(total - 1, imageIndexForPage(e.data)))
            playPageTurnSound()
          }}
        >
          {displayUrls.flatMap((url, i) => (
            i === 0
              ? [<Page key={`${url}-cover`} kind="cover" url={url} />]
              : [
                  <Page key={`${url}-left`} kind="spread-half" url={url} side="left" />,
                  <Page key={`${url}-right`} kind="spread-half" url={url} side="right" />,
                ]
          ))}
        </HTMLFlipBook>

        <button
          type="button"
          onClick={goNext}
          disabled={currentImageIndex >= total - 1}
          className="absolute right-3 sm:right-6 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-default"
          aria-label="הבא"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      <div className="shrink-0 bg-black/50 px-10 sm:px-16 py-3" dir="ltr">
        <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1">
          {imageUrls.map((url, i) => {
            const isSpread = i > 0
            const thumbW = isSpread ? spreadThumbW : coverThumbW
            const active = i === currentImageIndex
            return (
              <button
                key={`${url}-${i}`}
                ref={el => { thumbRefs.current[i] = el }}
                type="button"
                onClick={() => goToImage(i)}
                className="relative shrink-0 overflow-hidden border-2 transition"
                style={{
                  width: thumbW,
                  height: THUMB_H,
                  borderColor: active ? '#ef4444' : 'transparent',
                }}
                aria-label={`עמודים ${getPageLabel(i)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getThumbUrl(url, thumbW, THUMB_H)}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                {isSpread && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-semibold tabular-nums">
                    {getPageLabel(i)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
