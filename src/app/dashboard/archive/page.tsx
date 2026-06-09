'use client'

import { useState, useEffect } from 'react'
import { Download, CheckCircle2, Clock, Archive } from 'lucide-react'

type Snapshot = {
  id: string
  portfolio_title: string
  client_email: string
  approved_count: number
  created_at: string
  downloaded_at: string | null
}

export default function ArchivePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/archive', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSnapshots(data) })
      .finally(() => setLoading(false))
  }, [])

  async function downloadReport(snapshot: Snapshot) {
    setDownloading(snapshot.id)
    try {
      const res = await fetch(`/api/dashboard/archive/${snapshot.id}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${snapshot.portfolio_title}_בחירות.csv`
      a.click()
      URL.revokeObjectURL(url)
      setSnapshots(prev => prev.map(s =>
        s.id === snapshot.id ? { ...s, downloaded_at: new Date().toISOString() } : s
      ))
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
          <p className="text-stone-400 text-sm mt-0.5">בחירות תמונות של לקוחות מתיקים שנמחקו</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm">טוענת...</div>
      )}

      {!loading && snapshots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
          <Archive size={36} strokeWidth={1.2} className="mb-3 opacity-30" />
          <p className="font-medium text-stone-500">אין בחירות בארכיון עדיין</p>
          <p className="text-sm mt-1">כשתמחקי תיק שיש בו בחירות, הן ישמרו כאן</p>
        </div>
      )}

      {!loading && snapshots.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-stone-100 text-xs text-stone-400 font-medium">
                <th className="text-right px-5 py-3">שם תיק</th>
                <th className="text-right px-4 py-3">לקוחה</th>
                <th className="text-right px-4 py-3">תמונות נבחרו</th>
                <th className="text-right px-4 py-3">תאריך מחיקה</th>
                <th className="text-right px-4 py-3">הורדה</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s, i) => (
                <tr key={s.id} className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${i === snapshots.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3.5 font-medium text-stone-700">{s.portfolio_title}</td>
                  <td className="px-4 py-3.5 text-stone-400 text-xs" dir="ltr">{s.client_email}</td>
                  <td className="px-4 py-3.5 text-stone-600">{s.approved_count}</td>
                  <td className="px-4 py-3.5 text-stone-400 text-xs">
                    {new Date(s.created_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => downloadReport(s)}
                      disabled={downloading === s.id}
                      className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                      style={{ color: s.downloaded_at ? '#16a34a' : '#78716c' }}
                    >
                      {s.downloaded_at
                        ? <><CheckCircle2 size={13} /> הורד</>
                        : downloading === s.id
                          ? <><Clock size={13} /> מוריד...</>
                          : <><Download size={13} /> הורד CSV</>
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
