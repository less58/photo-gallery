'use client'

import { useState } from 'react'

type Photographer = {
  id: string
  name: string
  email: string
  brand_color: string
  created_at: string
  portfolioCount: number
}

export default function AdminPhotographerList({ photographers: initial }: { photographers: Photographer[] }) {
  const [list, setList] = useState(initial)
  const [removing, setRemoving] = useState<string | null>(null)

  async function remove(id: string) {
    if (!confirm('להסיר את הצלמת ואת כל התיקים שלה?')) return
    setRemoving(id)
    await fetch(`/api/admin/photographer/${id}`, { method: 'DELETE' })
    setList(l => l.filter(p => p.id !== id))
    setRemoving(null)
  }

  if (list.length === 0) {
    return (
      <div className="text-center py-20 text-muted">
        <p className="text-4xl mb-3">📷</p>
        <p>אין עדיין צלמות במערכת</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.map((p, i) => (
        <div
          key={p.id}
          className="bg-white rounded-2xl border border-rose-100 p-5 anim-fadeUp"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: p.brand_color || '#D4736A' }}
            >
              {p.name?.[0] || '?'}
            </div>
            <button
              onClick={() => remove(p.id)}
              disabled={removing === p.id}
              className="text-xs text-muted hover:text-red-500 transition disabled:opacity-40"
            >
              {removing === p.id ? '...' : 'הסרה'}
            </button>
          </div>

          <h3 className="font-semibold text-charcoal">{p.name}</h3>
          <p className="text-muted text-xs mt-0.5" dir="ltr">{p.email}</p>

          <div className="mt-3 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: p.brand_color + '20', color: p.brand_color }}
            >
              📁 {p.portfolioCount} תיקים
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
