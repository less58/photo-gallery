'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download, CheckCircle2, Clock, Archive, Search } from 'lucide-react'

type ArchiveEntry = {
  id: string
  source: 'snapshot' | 'portfolio'
  portfolio_title: string
  client_email: string
  approved_count: number
  created_at: string
  downloaded_at: string | null
}

export default function ArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'deleted'>('all')

  useEffect(() => {
    fetch('/api/dashboard/archive', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = entries
    if (filter === 'active') result = result.filter(e => e.source === 'portfolio')
    else if (filter === 'deleted') result = result.filter(e => e.source === 'snapshot')
    if (!search.trim()) return result
    const q = search.trim().toLowerCase()
    return result.filter(e =>
      e.portfolio_title.toLowerCase().includes(q) ||
      e.client_email.toLowerCase().includes(q)
    )
  }, [entries, search, filter])

  async function downloadReport(entry: ArchiveEntry) {
    setDownloading(entry.id)
    try {
      const url = entry.source === 'portfolio'
        ? `/api/dashboard/archive/${entry.id}?source=portfolio`
        : `/api/dashboard/archive/${entry.id}`

      const res = await fetch(url)
      if (!res.ok) return

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `selections_${entry.portfolio_title}.txt`
      a.click()
      URL.revokeObjectURL(blobUrl)

      if (entry.source === 'snapshot') {
        setEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, downloaded_at: new Date().toISOString() } : e
        ))
      }
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Archive size={22} className="text-stone-400" />
        <div>
          <h1 className="text-xl font-bold text-stone-800">ארכיון בחירות</h1>
          <p className="text-stone-400 text-sm mt-0.5">בחירות תמונות של כלל הלקוחות</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
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
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {([['all', 'הכל'], ['active', 'פעילים'], ['deleted', 'נמחקו']] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filter === val
                  ? 'bg-white text-stone-700 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm">טוענת...</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
          <Archive size={36} strokeWidth={1.2} className="mb-3 opacity-30" />
          <p className="font-medium text-stone-500">אין עדיין לקוחות</p>
          <p className="text-sm mt-1">כשתיצרי תיקים ולקוחות יבחרו תמונות, הן יופיעו כאן</p>
        </div>
      )}

      {!loading && entries.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-stone-400 text-sm">לא נמצאו תוצאות לחיפוש</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-stone-100 text-xs text-stone-400 font-medium">
                <th className="text-right px-5 py-3">שם תיק</th>
                <th className="text-right px-4 py-3">לקוחה</th>
                <th className="text-right px-4 py-3">תמונות נבחרו</th>
                <th className="text-right px-4 py-3">תאריך</th>
                <th className="text-right px-4 py-3">סטטוס</th>
                <th className="text-right px-4 py-3">הורדה</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={entry.id}
                  className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3.5 font-medium text-stone-700">{entry.portfolio_title}</td>
                  <td className="px-4 py-3.5 text-stone-400 text-xs" dir="ltr">{entry.client_email}</td>
                  <td className="px-4 py-3.5 text-stone-600">{entry.approved_count}</td>
                  <td className="px-4 py-3.5 text-stone-400 text-xs">
                    {new Date(entry.created_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.source === 'portfolio'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {entry.source === 'portfolio' ? 'פעיל' : 'נמחק'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => downloadReport(entry)}
                      disabled={downloading === entry.id}
                      className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                      style={{
                        color: (entry.source === 'snapshot' && entry.downloaded_at)
                          ? '#16a34a'
                          : '#78716c'
                      }}
                    >
                      {downloading === entry.id
                        ? <><Clock size={13} /> מוריד...</>
                        : (entry.source === 'snapshot' && entry.downloaded_at)
                          ? <><CheckCircle2 size={13} /> הורד</>
                          : <><Download size={13} /> הורד TXT</>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
