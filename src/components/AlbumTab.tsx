'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, BookOpen, Loader2, Eye } from 'lucide-react'
import type { Album } from '@/lib/types'
import AlbumViewer from './AlbumViewer'

const CHUNK_SIZE = 6 * 1024 * 1024 // 6 MB per chunk — within Cloudinary limits

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

    // Try to parse response (intermediate chunks may return partial JSON)
    let data: Record<string, unknown> = {}
    try { data = await res.json() } catch { /* intermediate chunk with no JSON body */ }

    if (!res.ok && res.status !== 499) {
      const msg = (data?.error as Record<string, string>)?.message || `שגיאת Cloudinary (${res.status})`
      throw new Error(msg)
    }

    if (data.secure_url) result = data  // final chunk
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
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/dashboard/albums?portfolioId=${portfolioId}`)
      .then(r => r.json())
      .then(d => setAlbums(d.albums || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [portfolioId])

  async function handleUpload(file: File) {
    if (file.type !== 'application/pdf') {
      alert('יש להעלות קובץ PDF בלבד')
      return
    }
    setUploading(true)
    setUploadPct(0)
    setUploadStatus('מאמת...')
    try {
      const folder = `albums/${portfolioId}`

      // Tiny request to get a Cloudinary signature — no file data, never 413
      const sigRes = await fetch('/api/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })
      if (!sigRes.ok) throw new Error('שגיאת אימות — רענן את הדף ונסה שנית')
      const sig: SignData = await sigRes.json()

      const sizeMB = (file.size / 1024 / 1024).toFixed(1)
      setUploadStatus(`מעלה ${sizeMB} MB ישירות ל-Cloudinary...`)

      // Upload directly from browser → Cloudinary in chunks (bypasses Vercel entirely)
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
        ? `הקובץ גדול מדי עבור חשבון Cloudinary הנוכחי. שדרגי את חשבון Cloudinary שלך ונסי שנית.\n\n(שגיאה: ${msg})`
        : msg)
    }
    setUploading(false)
    setUploadStatus('')
    setUploadPct(0)
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-stone-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> טוען אלבומים...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">
          {albums.length === 0 ? 'אין אלבומים עדיין' : `${albums.length} אלבומים`}
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ background: color }}
        >
          {uploading ? (
            <><Loader2 size={14} className="animate-spin" /> {uploadStatus || 'מעלה...'}</>
          ) : (
            <><Upload size={14} /> העלה אלבום PDF</>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
        />
      </div>

      {/* Upload progress bar */}
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full py-12 rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center gap-3 text-stone-400 hover:border-stone-300 hover:text-stone-500 transition disabled:opacity-40"
        >
          <BookOpen size={32} strokeWidth={1.5} />
          <span className="text-sm">העלה קובץ PDF של אלבום</span>
          <span className="text-xs text-stone-300">העמוד הראשון יוצג כשער, השאר כפרישות כפולות</span>
        </button>
      ) : (
        <div className="space-y-2">
          {albums.map(album => (
            <div key={album.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 group hover:bg-stone-100 transition">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: color + '18' }}>
                <BookOpen size={18} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-700 truncate">{album.name}</p>
                <p className="text-xs text-stone-400">{album.page_count} עמודים</p>
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
    </div>
  )
}
