'use client'

import { useState, useRef } from 'react'
import { X, Upload, GripVertical, Loader2, Save, AlertCircle } from 'lucide-react'
import type { Album } from '@/lib/types'

type SignData = { signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }

type ImageItem = {
  id: string
  name: string
  url: string | null
  uploading: boolean
  progress: number
  error: string | null
}

type Props = {
  portfolioId: string
  color: string
  onSave: (name: string, imageUrls: string[]) => Promise<void>
  onClose: () => void
  editAlbum?: Album
}

function uploadXHR(
  file: File,
  sig: SignData,
  onProgress: (pct: number) => void,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', sig.folder)
    fd.append('timestamp', String(sig.timestamp))
    fd.append('api_key', sig.apiKey)
    fd.append('signature', sig.signature)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      xhrRef.current = null
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          data.secure_url ? resolve(data.secure_url) : reject(new Error('לא התקבל URL'))
        } catch { reject(new Error('שגיאה בפענוח תגובה')) }
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          reject(new Error(data.error?.message || `שגיאת Cloudinary (${xhr.status})`))
        } catch { reject(new Error(`שגיאת Cloudinary (${xhr.status})`)) }
      }
    }
    xhr.onerror = () => { xhrRef.current = null; reject(new Error('שגיאת רשת')) }
    xhr.onabort = () => { xhrRef.current = null; reject(new Error('בוטל')) }

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`)
    xhr.send(fd)
  })
}

export default function AlbumImageEditor({ portfolioId, color, onSave, onClose, editAlbum }: Props) {
  const isEdit = !!editAlbum

  const [albumName, setAlbumName] = useState(editAlbum?.name ?? 'אלבום חדש')
  const [images, setImages] = useState<ImageItem[]>(() => {
    if (editAlbum?.image_urls) {
      return editAlbum.image_urls.map((url, i) => ({
        id: `existing_${i}_${url.slice(-20)}`,
        name: `תמונה ${i + 1}`,
        url,
        uploading: false,
        progress: 100,
        error: null,
      }))
    }
    return []
  })
  const [currentUpload, setCurrentUpload] = useState<{ name: string; index: number; total: number; progress: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const isUploading = images.some(img => img.uploading)
  const uploadedCount = images.filter(img => img.url).length

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (arr.length === 0) return

    const sorted = arr.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    )

    const newItems: ImageItem[] = sorted.map(f => ({
      id: `${f.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: f.name,
      url: null,
      uploading: false,
      progress: 0,
      error: null,
    }))

    setImages(prev => [...prev, ...newItems])
    cancelRef.current = false

    for (let i = 0; i < sorted.length; i++) {
      if (cancelRef.current) break
      const file = sorted[i]
      const item = newItems[i]

      setImages(prev => prev.map(img => img.id === item.id ? { ...img, uploading: true, progress: 0 } : img))
      setCurrentUpload({ name: file.name, index: i + 1, total: sorted.length, progress: 0 })

      try {
        const sigRes = await fetch('/api/cloudinary-sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: `albums/${portfolioId}` }),
        })
        if (!sigRes.ok) throw new Error('שגיאת אימות')
        const sig: SignData = await sigRes.json()

        const url = await uploadXHR(file, sig, pct => {
          setImages(prev => prev.map(img => img.id === item.id ? { ...img, progress: pct } : img))
          setCurrentUpload(prev => prev ? { ...prev, progress: pct } : prev)
        }, xhrRef)

        setImages(prev => prev.map(img =>
          img.id === item.id ? { ...img, url, uploading: false, progress: 100 } : img
        ))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'שגיאה'
        setImages(prev => prev.map(img =>
          img.id === item.id
            ? msg === 'בוטל' ? { ...img, uploading: false } : { ...img, error: msg, uploading: false }
            : img
        ))
      }
    }

    setCurrentUpload(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  function removeImage(id: string) {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  function onDragStartItem(e: React.DragEvent, idx: number) {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverItem(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (draggedIdx !== null && draggedIdx !== idx) setDropTargetIdx(idx)
  }

  function onDropItem(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return
    setImages(prev => {
      const next = [...prev]
      const [moved] = next.splice(draggedIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDraggedIdx(null)
    setDropTargetIdx(null)
  }

  function handleClose() {
    cancelRef.current = true
    xhrRef.current?.abort()
    if (!isEdit && images.length > 0) {
      if (!confirm('לצאת בלי לשמור? האלבום לא יישמר')) return
    }
    onClose()
  }

  async function handleSave() {
    const urls = images.filter(img => img.url).map(img => img.url!)
    if (urls.length === 0) return
    setSaving(true)
    try {
      await onSave(albumName, urls)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
              {isEdit ? 'עריכת אלבום' : 'אלבום חדש'}
            </p>
            <button onClick={handleClose} className="text-stone-400 hover:text-stone-600 transition">
              <X size={20} />
            </button>
          </div>
          <input
            autoFocus={!isEdit}
            value={albumName}
            onChange={e => setAlbumName(e.target.value)}
            className="w-full text-xl font-bold text-stone-800 bg-stone-50 border-2 border-stone-200 hover:border-stone-300 focus:border-rose-400 focus:outline-none rounded-xl px-4 py-3 transition"
            placeholder="שם האלבום"
          />
        </div>

        {/* Drop zone */}
        <div
          className={`mx-5 mt-4 shrink-0 rounded-xl border-2 border-dashed transition-colors ${
            dragOver ? 'border-rose-400 bg-rose-50' : 'border-stone-200 hover:border-stone-300'
          } ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileRef.current?.click()}
        >
          <div className="py-5 flex flex-col items-center gap-1.5 text-stone-400">
            <Upload size={22} strokeWidth={1.5} />
            <span className="text-sm font-medium">גרור תמונות לכאן או לחץ לבחירה</span>
            <span className="text-xs text-stone-300">JPG, PNG · מסודר אוטומטית לפי שם הקובץ</span>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />

        {/* Upload progress */}
        {currentUpload && (
          <div className="mx-5 mt-3 shrink-0 rounded-xl bg-stone-50 px-4 py-3 flex items-center gap-3 border border-stone-100">
            <Loader2 size={14} className="animate-spin text-stone-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                <span className="truncate font-medium">{currentUpload.name}</span>
                <span className="shrink-0 mr-2 tabular-nums">{currentUpload.index} / {currentUpload.total}</span>
              </div>
              <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{ width: `${currentUpload.progress}%`, background: color }}
                />
              </div>
            </div>
            <button
              onClick={() => { cancelRef.current = true; xhrRef.current?.abort() }}
              className="text-stone-400 hover:text-red-500 transition shrink-0 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Images grid */}
        {images.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="flex flex-col gap-1"
                  draggable={!!img.url}
                  onDragStart={e => onDragStartItem(e, idx)}
                  onDragOver={e => onDragOverItem(e, idx)}
                  onDrop={e => onDropItem(e, idx)}
                  onDragEnd={() => { setDraggedIdx(null); setDropTargetIdx(null) }}
                >
                  <div
                    className={`h-20 rounded-lg overflow-hidden bg-stone-100 border-2 relative select-none transition-all ${
                      dropTargetIdx === idx && draggedIdx !== idx ? 'border-rose-400 scale-105' : 'border-transparent'
                    } ${draggedIdx === idx ? 'opacity-30' : ''} ${img.url ? 'cursor-grab' : ''}`}
                  >
                    {img.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" className="w-full h-full object-contain" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {img.error
                          ? <AlertCircle size={18} className="text-red-400" />
                          : <Loader2 size={18} className="animate-spin text-stone-300" />
                        }
                      </div>
                    )}

                    <div className="absolute bottom-0.5 left-0.5 bg-black/50 text-white text-[9px] rounded px-1 leading-4 pointer-events-none">
                      {idx + 1}
                    </div>

                    {img.url && (
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 hover:bg-red-500 text-white flex items-center justify-center transition"
                      >
                        <X size={9} />
                      </button>
                    )}

                    {img.uploading && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-stone-200">
                        <div className="h-full transition-all duration-100" style={{ width: `${img.progress}%`, background: color }} />
                      </div>
                    )}

                    {img.url && (
                      <div className="absolute top-0.5 left-0.5 text-white/50 pointer-events-none">
                        <GripVertical size={11} />
                      </div>
                    )}
                  </div>

                  <p className="text-[9px] text-stone-400 truncate text-center leading-tight px-0.5" title={img.name}>
                    {img.name}
                  </p>
                </div>
              ))}
            </div>

            {uploadedCount > 0 && (
              <p className="text-xs text-stone-400 mt-3 text-center">
                {uploadedCount} תמונות · גרור כדי לשנות סדר
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-stone-100 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-50 transition"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={uploadedCount === 0 || isUploading || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: color }}
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : <Save size={14} />
            }
            {isEdit ? 'שמור שינויים' : `שמור אלבום`} {uploadedCount > 0 ? `(${uploadedCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
