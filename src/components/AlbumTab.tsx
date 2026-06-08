'use client'

import { useState, useEffect } from 'react'
import { Trash2, BookOpen, Loader2, Eye, Images, Pencil, Check, X, Pen } from 'lucide-react'
import type { Album } from '@/lib/types'
import AlbumViewer from './AlbumViewer'
import AlbumImageEditor from './AlbumImageEditor'

const PROXY_PFX = '/api/image-proxy?url='

function applyTransform(url: string, transform: string): string {
  if (url.startsWith(PROXY_PFX)) {
    const orig = decodeURIComponent(url.slice(PROXY_PFX.length))
    const t = orig.includes('/upload/') ? orig.replace('/upload/', `/upload/${transform}/`) : orig
    return `${PROXY_PFX}${encodeURIComponent(t)}`
  }
  return url.includes('/upload/') ? url.replace('/upload/', `/upload/${transform}/`) : url
}

function getAlbumThumb(album: Album): string | null {
  if (album.image_urls?.[0]) {
    return applyTransform(album.image_urls[0], 'w_120,h_80,c_fill,q_auto,f_jpg')
  }
  if (album.pdf_url) {
    return applyTransform(album.pdf_url, 'pg_1,f_jpg,w_120,h_80,c_fill,q_auto')
  }
  return null
}

type Props = {
  portfolioId: string
  color: string
}

export default function AlbumTab({ portfolioId, color }: Props) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingAlbum, setViewingAlbum] = useState<Album | null>(null)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [savingNameId, setSavingNameId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/albums?portfolioId=${portfolioId}`)
      .then(r => r.json())
      .then(d => setAlbums(d.albums || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [portfolioId])

  async function handleImageAlbumSave(name: string, imageUrls: string[], lastPageSingle: boolean) {
    if (editingAlbum) {
      const res = await fetch(`/api/dashboard/album/${editingAlbum.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, imageUrls, pageCount: imageUrls.length, lastPageSingle }),
      })
      const album = await res.json()
      if (album.id) {
        setAlbums(prev => prev.map(a => a.id === album.id ? album : a))
        setEditingAlbum(null)
        setShowImageEditor(false)
      }
    } else {
      const saveRes = await fetch('/api/dashboard/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          name,
          imageUrls,
          pageCount: imageUrls.length,
          lastPageSingle,
        }),
      })
      const album = await saveRes.json()
      if (album.id) {
        setAlbums(prev => [album, ...prev])
        setShowImageEditor(false)
      }
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

  function openEditor(album?: Album) {
    setEditingAlbum(album ?? null)
    setShowImageEditor(true)
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
      {albums.length === 0 && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => openEditor()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition border"
            style={{ color, borderColor: color + '60', background: color + '10' }}
          >
            <Images size={14} /> צור אלבום
          </button>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="w-full py-10 rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center gap-4 text-stone-400">
          <BookOpen size={32} strokeWidth={1.5} />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">אין אלבום עדיין</p>
            <p className="text-xs text-stone-300">צרי אלבום מתמונות</p>
          </div>
          <button
            type="button"
            onClick={() => openEditor()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition border"
            style={{ color, borderColor: color + '60', background: color + '10' }}
          >
            <Images size={14} /> צור אלבום
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Only one album per portfolio */}
          {albums.slice(0, 1).map(album => {
            const thumb = getAlbumThumb(album)
            return (
              <div key={album.id}
                className="flex items-center gap-3 px-3 py-3 rounded-xl border border-stone-200 bg-stone-50 group hover:bg-stone-100 transition">
                {/* Thumbnail */}
                <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-stone-200 flex items-center justify-center">
                  {thumb
                    ? <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} />
                    : <Images size={16} style={{ color }} />
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
                    <button
                      type="button"
                      onClick={() => startEditName(album)}
                      className="flex items-center gap-1.5 group/name rounded px-1 -mx-1 hover:bg-stone-200 transition text-right"
                      title="לחצי לשינוי שם"
                    >
                      <p className="text-sm font-medium text-stone-700 truncate">{album.name}</p>
                      <Pencil size={11} className="text-stone-400 shrink-0 opacity-60 group-hover/name:opacity-100 transition" />
                    </button>
                  )}
                  <p className="text-xs text-stone-400 mt-0.5">
                    {album.image_urls?.length ?? album.page_count} תמונות
                  </p>
                </div>

                <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setViewingAlbum(album)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition"
                  >
                    <Eye size={12} /> תצוגה
                  </button>
                  {album.image_urls?.length ? (
                    <button
                      type="button"
                      onClick={() => openEditor(album)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition"
                    >
                      <Pen size={12} /> ערוך
                    </button>
                  ) : null}
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
            )
          })}
        </div>
      )}

      {viewingAlbum && (
        <AlbumViewer album={viewingAlbum} onClose={() => setViewingAlbum(null)} isPhotographer={true} color={color} />
      )}

      {showImageEditor && (
        <AlbumImageEditor
          portfolioId={portfolioId}
          color={color}
          onSave={handleImageAlbumSave}
          onClose={() => { setShowImageEditor(false); setEditingAlbum(null) }}
          editAlbum={editingAlbum ?? undefined}
        />
      )}
    </div>
  )
}
