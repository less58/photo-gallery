'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { Collage } from '@/lib/types'
import CollageEditor, { CollagePreview, downloadCollage } from './CollageEditor'

type Props = {
  portfolioId: string
  color: string
}

export default function CollageTab({ portfolioId, color }: Props) {
  const [collages, setCollages] = useState<Collage[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingCollage, setEditingCollage] = useState<Collage | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/collages?portfolioId=${portfolioId}`)
      .then(r => r.json())
      .then(d => setCollages(d.collages || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [portfolioId])

  function openNew() {
    setEditingCollage(undefined)
    setEditorOpen(true)
  }

  function openEdit(collage: Collage) {
    setEditingCollage(collage)
    setEditorOpen(true)
  }

  function handleSaved(collage: Collage) {
    setCollages(prev => {
      const exists = prev.find(c => c.id === collage.id)
      return exists ? prev.map(c => c.id === collage.id ? collage : c) : [collage, ...prev]
    })
    setEditorOpen(false)
  }

  async function deleteCollage(id: string) {
    if (!confirm('למחוק את הקולאג׳?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/dashboard/collage/${id}`, { method: 'DELETE' })
      setCollages(prev => prev.filter(c => c.id !== id))
    } catch { /* ignore */ }
    setDeletingId(null)
  }

  async function handleDownload(collage: Collage) {
    setDownloadingId(collage.id)
    try {
      await downloadCollage(collage)
    } catch { /* ignore */ }
    setDownloadingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-stone-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> טוען קולאג׳ים...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">{collages.length === 0 ? 'אין קולאג׳ים עדיין' : `${collages.length} קולאג׳ים`}</span>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition"
          style={{ background: color }}
        >
          <Plus size={14} /> קולאג׳ חדש
        </button>
      </div>

      {collages.length === 0 ? (
        <button
          type="button"
          onClick={openNew}
          className="w-full py-12 rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center gap-3 text-stone-400 hover:border-stone-300 hover:text-stone-500 transition"
        >
          <Plus size={32} strokeWidth={1.5} />
          <span className="text-sm">צור קולאג׳ ראשון</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collages.map(collage => (
            <div key={collage.id} className="rounded-xl overflow-hidden border border-stone-200 bg-stone-50 group">
              {/* Preview */}
              <div className="relative">
                <CollagePreview collage={collage} className="w-full" />
                {/* Overlay buttons */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => openEdit(collage)}
                    className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white transition">
                    <Pencil size={14} className="text-stone-700" />
                  </button>
                  <button type="button" onClick={() => handleDownload(collage)} disabled={downloadingId === collage.id}
                    className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white transition disabled:opacity-60">
                    {downloadingId === collage.id
                      ? <Loader2 size={14} className="text-stone-700 animate-spin" />
                      : <Download size={14} className="text-stone-700" />}
                  </button>
                  <button type="button" onClick={() => deleteCollage(collage.id)} disabled={deletingId === collage.id}
                    className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-red-500 hover:text-white transition disabled:opacity-60">
                    {deletingId === collage.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} className="text-red-500 group-hover:text-inherit" />}
                  </button>
                </div>
              </div>
              {/* Name */}
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-stone-700 truncate">{collage.name}</p>
                <p className="text-xs text-stone-400">{collage.cells.length} תאים</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <CollageEditor
          portfolioId={portfolioId}
          color={color}
          collage={editingCollage}
          onSave={handleSaved}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
