'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, FolderOpen, ImageIcon, Plus, CheckCircle2, Circle, Download, X, Search } from 'lucide-react'
import { useToast } from './Toast'
import { useUpload } from '@/context/UploadContext'

type Portfolio = {
  id: string
  title: string
  client_email: string
  quota: number
  sessionCount: number
  photoCount: number
  selectionCount: number
  cover_url: string | null
  is_done: boolean
}

export default function PortfolioList({
  portfolios: initial, color, photographerName,
}: {
  portfolios: Portfolio[]
  color: string
  photographerName: string
}) {
  const toast = useToast()
  const { jobs } = useUpload()
  const [portfolios, setPortfolios] = useState(initial)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    function fetchUnread() {
      fetch('/api/dashboard/notes/summary', { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) return
          const counts: Record<string, number> = {}
          data.forEach((c: { portfolioId: string; unreadCount: number }) => {
            if (c.unreadCount > 0) counts[c.portfolioId] = c.unreadCount
          })
          setUnreadCounts(counts)
        })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [togglingDone, setTogglingDone] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string; selectionCount: number; quota: number } | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return portfolios
    const q = search.trim().toLowerCase()
    return portfolios.filter(p =>
      p.title.toLowerCase().includes(q) || p.client_email.toLowerCase().includes(q)
    )
  }, [portfolios, search])

  async function confirmDelete(id: string, includeReport: boolean) {
    setDeleteModal(null)
    setDeleting(id)
    try {
      const res = await fetch('/api/dashboard/portfolio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, includeReport }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.txt) {
          const blob = new Blob([data.txt], { type: 'text/plain;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = data.filename || 'בחירות.txt'
          a.click()
          URL.revokeObjectURL(url)
        }
        setPortfolios(prev => prev.filter(p => p.id !== id))
        toast('התיק נמחק')
      } else {
        toast(data.error || 'שגיאה במחיקה', 'error')
      }
    } catch { toast('שגיאה', 'error') }
    setDeleting(null)
  }

  function handleDeleteClick(id: string, title: string, selectionCount: number, quota: number) {
    setDeleteModal({ id, title, selectionCount, quota })
  }

  async function toggleDone(id: string, current: boolean) {
    setTogglingDone(id)
    try {
      const res = await fetch(`/api/dashboard/portfolio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: !current }),
      })
      if (res.ok) {
        setPortfolios(prev => prev.map(p => p.id === id ? { ...p, is_done: !current } : p))
        toast(!current ? 'התיק סומן כ"הושלם"' : 'הסימון הוסר')
      } else {
        toast('שגיאה בעדכון', 'error')
      }
    } catch { toast('שגיאה', 'error') }
    setTogglingDone(null)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-stone-800">
            שלום{photographerName ? `, ${photographerName}` : ''} 👋
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {search.trim() ? `${filtered.length} מתוך ${portfolios.length} תיקים` : `${portfolios.length} תיקים פעילים`}
          </p>
        </div>
        {portfolios.length > 0 && (
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם תיק או לקוחה..."
              className="pr-8 pl-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition w-56"
              dir="rtl"
            />
          </div>
        )}
      </div>

      {portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400">
          <FolderOpen size={40} strokeWidth={1.2} className="mb-3 opacity-30" />
          <h2 className="font-semibold text-stone-600 mb-1">אין עדיין תיקים</h2>
          <p className="text-sm mb-5">צרי תיק ראשון ושלחי ללקוחה שלך</p>
          <Link href="/dashboard/portfolio/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: color }}>
            <Plus size={15} /> צרי תיק ראשון
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
          <Search size={32} strokeWidth={1.2} className="mb-3 opacity-30" />
          <p className="font-medium text-stone-500">לא נמצאו תיקים</p>
          <p className="text-sm mt-1">נסי לחפש בשם אחר</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((portfolio, i) => (
            <div
              key={portfolio.id}
              className={`group bg-white rounded-xl border hover:shadow-md transition-all duration-200 anim-fadeUp overflow-hidden ${portfolio.is_done ? 'border-green-200 opacity-75' : 'border-stone-200'}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Link href={`/dashboard/portfolio/${portfolio.id}`} className="block">
                {/* Cover image */}
                {(() => {
                  const activeJobs = jobs.filter(j => j.portfolioId === portfolio.id && j.status === 'uploading')
                  const isUploading = activeJobs.length > 0
                  const uploadedCount = activeJobs.reduce((a, j) => a + j.done, 0)
                  const totalCount = activeJobs.reduce((a, j) => a + j.total, 0)
                  const pct = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0
                  return (
                    <div className="relative">
                      {portfolio.cover_url ? (
                        <div className="w-full h-36 relative overflow-hidden">
                          <Image
                            src={portfolio.cover_url}
                            alt={portfolio.title}
                            fill unoptimized
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                      ) : (
                        <div className="w-full h-36 flex items-center justify-center"
                          style={{ background: color + '10' }}>
                          <ImageIcon size={28} strokeWidth={1.2} style={{ color: color + '60' }} />
                        </div>
                      )}
                      {/* Upload progress bar */}
                      {isUploading && (
                        <div className="absolute bottom-0 left-0 right-0">
                          <div className="h-1.5 bg-black/30 w-full">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                            <span className="text-[10px] font-medium text-white bg-black/50 px-2 py-0.5 rounded-full">
                              מעלה {uploadedCount}/{totalCount}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="p-5">
                  {/* Color bar */}
                  <div className="h-1 w-8 rounded-full mb-3" style={{ background: color }} />

                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-semibold text-stone-800 group-hover:text-stone-600 transition truncate">
                      {portfolio.title}
                    </h2>
                    {portfolio.is_done && (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">הושלם</span>
                    )}
                    {unreadCounts[portfolio.id] > 0 && (
                      <span className="shrink-0 min-w-[18px] h-4.5 px-1 rounded-full flex items-center justify-center text-white text-[9px] font-bold bg-red-500">
                        {unreadCounts[portfolio.id]}
                      </span>
                    )}
                  </div>
                  <p className="text-stone-400 text-xs truncate mb-3" dir="ltr">{portfolio.client_email}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      <FolderOpen size={12} />
                      {portfolio.sessionCount} סשנים
                    </span>
                    <span className="flex items-center gap-1">
                      <ImageIcon size={12} />
                      {portfolio.photoCount} תמונות
                    </span>
                    <span className="mr-auto text-stone-300">מכסה {portfolio.quota}</span>
                  </div>
                </div>
              </Link>

              {/* Footer actions */}
              <div className="border-t border-stone-100 px-5 py-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleDone(portfolio.id, portfolio.is_done)}
                  disabled={togglingDone === portfolio.id}
                  title={portfolio.is_done ? 'הסר סימון "הושלם"' : 'סמן כ"הושלם"'}
                  className="flex items-center gap-1.5 text-xs transition-colors disabled:opacity-30 py-1"
                  style={{ color: portfolio.is_done ? '#16a34a' : '#a8a29e' }}
                >
                  {portfolio.is_done
                    ? <CheckCircle2 size={13} />
                    : <Circle size={13} />}
                  {togglingDone === portfolio.id ? '...' : (portfolio.is_done ? 'הושלם' : 'סמן כהושלם')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(portfolio.id, portfolio.title, portfolio.selectionCount, portfolio.quota)}
                  disabled={deleting === portfolio.id}
                  title="מחיקת תיק"
                  className="flex items-center gap-1.5 text-xs text-stone-300 hover:text-red-400 transition-colors disabled:opacity-30 py-1"
                >
                  <Trash2 size={12} />
                  {deleting === portfolio.id ? 'מוחק...' : 'מחיקה'}
                </button>
              </div>
            </div>
          ))}

          {/* Add new */}
          <Link
            href="/dashboard/portfolio/new"
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-300 transition-colors min-h-[130px] anim-fadeUp"
            style={{ animationDelay: `${portfolios.length * 50}ms` }}
          >
            <Plus size={20} className="text-stone-300 mb-1.5" />
            <span className="text-sm text-stone-400">תיק חדש</span>
          </Link>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" dir="rtl">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-stone-800 text-base">מחיקת תיק</h3>
              <button type="button" onClick={() => setDeleteModal(null)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            {deleteModal.selectionCount > 0 ? (
              <>
                <p className="text-stone-600 text-sm mb-1">
                  ללקוחה זו נבחרו <strong>{deleteModal.selectionCount}</strong> מתוך <strong>{deleteModal.quota}</strong> תמונות.
                </p>
                <p className="text-stone-500 text-sm mb-1">
                  האם למחוק את התיק &ldquo;{deleteModal.title}&rdquo;?
                </p>
                <p className="text-red-400 text-xs mb-5">פעולה זו אינה ניתנת לשחזור.</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => confirmDelete(deleteModal.id, true)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: color }}
                  >
                    <Download size={14} />
                    הורד קובץ בחירות ומחק
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(deleteModal.id, false)}
                    className="w-full py-2.5 rounded-xl text-stone-600 text-sm font-medium border border-stone-200 hover:bg-stone-50 transition-colors"
                  >
                    מחק בלי הורדה
                  </button>
                  <button type="button" onClick={() => setDeleteModal(null)}
                    className="w-full py-2 text-stone-400 text-sm hover:text-stone-600 transition-colors">
                    ביטול
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-stone-600 text-sm mb-1">
                  האם למחוק את התיק &ldquo;{deleteModal.title}&rdquo;?
                </p>
                <p className="text-red-400 text-xs mb-5">פעולה זו אינה ניתנת לשחזור.</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => confirmDelete(deleteModal.id, false)}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: color }}
                  >
                    מחק
                  </button>
                  <button type="button" onClick={() => setDeleteModal(null)}
                    className="w-full py-2 text-stone-400 text-sm hover:text-stone-600 transition-colors">
                    ביטול
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
