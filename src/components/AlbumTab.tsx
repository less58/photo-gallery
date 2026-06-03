'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, BookOpen, Loader2, Eye } from 'lucide-react'
import type { Album } from '@/lib/types'
import AlbumViewer from './AlbumViewer'

type Props = {
  portfolioId: string
  color: string
}

export default function AlbumTab({ portfolioId, color }: Props) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
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
    setUploadStatus('מכין העלאה...')
    try {
      const folder = `albums/${portfolioId}`

      // Step 1: get a Cloudinary signature from our server (tiny request, no file data)
      setUploadStatus('מאמת...')
      const sigRes = await fetch('/api/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })
      if (!sigRes.ok) throw new Error('שגיאת אימות')
      const { signature, timestamp, apiKey, cloudName } = await sigRes.json()

      // Step 2: upload directly to Cloudinary — bypasses Vercel body-size limit entirely
      setUploadStatus(`מעלה PDF (${(file.size / 1024 / 1024).toFixed(1)} MB)...`)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      fd.append('timestamp', String(timestamp))
      fd.append('api_key', apiKey)
      fd.append('signature', signature)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: fd }
      )
      const uploadData = await uploadRes.json()
      if (!uploadData.secure_url) throw new Error(uploadData.error?.message || 'שגיאה בהעלאה ל-Cloudinary')

      // Step 3: save metadata to our DB (tiny JSON request)
      setUploadStatus('שומר...')
      const saveRes = await fetch('/api/dashboard/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          name: file.name.replace(/\.pdf$/i, ''),
          pdfUrl: uploadData.secure_url,
          pageCount: uploadData.pages ?? 0,
        }),
      })
      const album = await saveRes.json()
      if (album.id) setAlbums(prev => [album, ...prev])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה בהעלאה')
    }
    setUploading(false)
    setUploadStatus('')
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
