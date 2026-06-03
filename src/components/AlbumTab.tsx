'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, BookOpen, Loader2, Eye, Images, Pencil, Check, X } from 'lucide-react'
import type { Album } from '@/lib/types'
import AlbumViewer from './AlbumViewer'
import AlbumImageEditor from './AlbumImageEditor'

const CHUNK_SIZE = 6 * 1024 * 1024

type SignData = { signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }

async function uploadChunked(
  file: File,
  sig: SignData,
  onProgress: (pct: number) => void
): Promise<{ secure_url: string; pages: number }> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`
  let result: Record<string, unknown> = {}

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const fd = new FormData()
    fd.append('file', chunk)
    fd.append('folder', sig.folder)
    fd.append('timestamp', String(sig.timestamp))
    fd.append('api_key', sig.apiKey)
    fd.append('signature', sig.signature)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
      {
        method: 'POST',
        headers: {
          'X-Unique-Upload-Id': uploadId,
          'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
        },
        body: fd,
      }
    )

    onProgress(Math.round(((i + 1) / totalChunks) * 100))

    let data: Record<string, unknown> = {}
    try { data = await res.json() } catch { /* intermediate chunk */ }

    if (!res.ok && res.status !== 499) {
      const msg = (data?.error as Record<string, string>)?.message || `שגיאת Cloudinary (${res.status})`
      throw new Error(msg)
    }
    if (data.secure_url) result = data
  }

  if (!result.secure_url) throw new Error('לא התקבל URL מ-Cloudinary')
  return { secure_url: result.secure_url as string, pages: (result.pages as number) ?? 0 }
}

type Props = {
  portfolioId: string
  color: string
}

export default function AlbumTab({ portfolioId, color }: Props) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingAlbum, setViewingAlbum] = useState<Album | null>(null)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [savingNameId, setSavingNameId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/dashboard/albums?portfolioId=${portfolioId}`)
      .then(r => r.json())
      .then(d => setAlbums(d.albums || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [portfolioId])

  async function handlePdfUpload(file: File) {
    if (file.type !== 'application/pdf') {
      alert('יש להעלות קובץ PDF בלבד')
      return
    }
    setUploading(true)
    setUploadPct(0)
    setUploadStatus('מאמת...')
    try {
      const sigRes = await fetch('/api/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: `albums/${portfolioId}` }),
      })
      if (!sigRes.ok) throw new Error('שגיאת אימות — רענן את הדף ונסה שנית')
      const sig: SignData = await sigRes.json()

      const sizeMB = (file.size / 1024 / 1024).toFixed(1)
      setUploadStatus(`מעלה ${sizeMB} MB...`)

      const uploadData = await uploadChunked(file, sig, pct => {
        setUploadPct(pct)
        setUploadStatus(`מעלה... ${pct}%`)
      })

      setUploadStatus('שומר...')
      const saveRes = await fetch('/api/dashboard/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          name: file.name.replace(/\.pdf$/i, ''),
          pdfUrl: uploadData.secure_url,
          pageCount: uploadData.pages,
        }),
      })
      const album = await saveRes.json()
      if (album.id) setAlbums(prev => [album, ...prev])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה בהעלאה'
      alert(msg.includes('10 MB') || msg.includes('large') || msg.includes('413')
        ? `הקובץ גדול מדי. שדרגי את חשבון Cloudinary שלך ונסי שנית.\n\n(שגיאה: ${msg})`
        : msg)
    }
    setUploading(false)
    setUploadStatus('')
    setUploadPct(0)
  }

  async function handleImageAlbumSave(name: string, imageUrls: string[]) {
    const saveRes = await fetch('/api/dashboard/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId,
        name,
        imageUrls,
        pageCount: imageUrls.length,
      }),
    })
    const album = await saveRes.json()
    if (album.id) {
      setAlbums(prev => [album, ...prev])
      setShowImageEditor(false)
    }
  }

  async function deleteAlbum(id: string) {
    if (!confirm('למחוק את האלבום?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/dashboard/album/${id}`, { method: 'DELETE' })
      setAlbums(prev => prev.filter(a => a.id !== id))
    } catch { /* ignore */ }
    setDeletingId(null)
  }

  async function saveAlbumName(id: string) {
    const name = editingNameValue.trim()
    if (!name) return
    setSavingNameId(id)
    try {
      const res = await fetch(`/api/dashboard/album/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setAlbums(prev => prev.map(a => a.id === id ? { ...a, name } : a))
        setEditingNameId(null)
      }
    } catch { /* ignore */ }
    setSavingNameId(null)
  }

  function startEditName(album: Album) {
    setEditingNameId(album.id)
    setEditingNameValue(album.name)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-stone-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> טוען אלבומים...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-stone-500">
          {albums.length === 0 ? 'אין אלבומים עדיין' : `${albums.length} אלבומים`}
        </span>
        <div className="flex items-center gap-2">
          {/* Image album button */}
          <button
            type="button"
            onClick={() => setShowImageEditor(true)}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition disabled:opacity-60 border"
            style={{ color, borderColor: color + '60', background: color + '10' }}
          >
            <Images size={14} /> אלבום תמונות
          </button>
          {/* PDF button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: color }}
          >
            {uploading
              ? <><Loader2 size={14} className="animate-spin" /> {uploadStatus || 'מעלה...'}</>
              : <><Upload size={14} /> העלה PDF</>
            }
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = '' }}
        />
      </div>

      {/* PDF upload progress */}
      {uploading && uploadPct > 0 && (
        <div className="rounded-xl bg-stone-100 px-4 py-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>{uploadStatus}</span>
            <span>{uploadPct}%</span>
          </div>
          <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${uploadPct}%`, background: color }}
            />
          </div>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="w-full py-10 rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center gap-4 text-stone-400">
          <BookOpen size={32} strokeWidth={1.5} />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">אין אלבומים עדיין</p>
            <p className="text-xs text-stone-300">העלה PDF או צור אלבום מתמונות</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowImageEditor(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition border"
              style={{ color, borderColor: color + '60', background: color + '10' }}
            >
              <Images size={14} /> אלבום תמונות
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ background: color }}
            >
              <Upload size={14} /> העלה PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {albums.map(album => (
            <div key={album.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 group hover:bg-stone-100 transition">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: color + '18' }}>
                {album.image_urls?.length
                  ? <Images size={18} style={{ color }} />
                  : <BookOpen size={18} style={{ color }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                {editingNameId === album.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editingNameValue}
                      onChange={e => setEditingNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveAlbumName(album.id)
                        if (e.key === 'Escape') setEditingNameId(null)
                      }}
                      className="flex-1 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                    <button onClick={() => saveAlbumName(album.id)} disabled={!!savingNameId}
                      className="text-green-500 hover:text-green-600 transition">
                      {savingNameId === album.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setEditingNameId(null)} className="text-stone-400 hover:text-stone-600 transition">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group/name">
                    <p className="text-sm font-medium text-stone-700 truncate">{album.name}</p>
                    <button
                      onClick={() => startEditName(album)}
                      className="opacity-0 group-hover/name:opacity-100 text-stone-400 hover:text-stone-600 transition"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
                <p className="text-xs text-stone-400 mt-0.5">
                  {album.image_urls?.length ?? album.page_count} תמונות
                  {album.image_urls ? '' : ' · PDF'}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setViewingAlbum(album)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition"
                >
                  <Eye size={12} /> תצוגה מקדימה
                </button>
                <button
                  type="button"
                  onClick={() => deleteAlbum(album.id)}
                  disabled={deletingId === album.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition disabled:opacity-40"
                >
                  {deletingId === album.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingAlbum && (
        <AlbumViewer album={viewingAlbum} onClose={() => setViewingAlbum(null)} />
      )}

      {showImageEditor && (
        <AlbumImageEditor
          portfolioId={portfolioId}
          color={color}
          onSave={handleImageAlbumSave}
          onClose={() => setShowImageEditor(false)}
        />
      )}
    </div>
  )
}
