'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, FolderOpen, ImageIcon, Plus } from 'lucide-react'
import { useToast } from './Toast'

type Portfolio = {
  id: string
  title: string
  client_email: string
  quota: number
  sessionCount: number
  photoCount: number
  cover_url: string | null
}

export default function PortfolioList({
  portfolios: initial, color, photographerName,
}: {
  portfolios: Portfolio[]
  color: string
  photographerName: string
}) {
  const toast = useToast()
  const [portfolios, setPortfolios] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function deletePortfolio(id: string, title: string) {
    if (!confirm(`למחוק את התיק "${title}"? לא ניתן לשחזר.`)) return
    setDeleting(id)
    try {
      const res = await fetch('/api/dashboard/portfolio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setPortfolios(prev => prev.filter(p => p.id !== id))
        toast('התיק נמחק')
      } else {
        toast('שגיאה במחיקה', 'error')
      }
    } catch { toast('שגיאה', 'error') }
    setDeleting(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-stone-800">
            שלום{photographerName ? `, ${photographerName}` : ''} 👋
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">{portfolios.length} תיקים פעילים</p>
        </div>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio, i) => (
            <div
              key={portfolio.id}
              className="group bg-white rounded-xl border border-stone-200 hover:shadow-md transition-all duration-200 anim-fadeUp overflow-hidden"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Link href={`/dashboard/portfolio/${portfolio.id}`} className="block">
                {/* Cover image */}
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

                <div className="p-5">
                  {/* Color bar */}
                  <div className="h-1 w-8 rounded-full mb-3" style={{ background: color }} />

                  <h2 className="font-semibold text-stone-800 group-hover:text-stone-600 transition truncate mb-0.5">
                    {portfolio.title}
                  </h2>
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

              {/* Delete button */}
              <div className="border-t border-stone-100 px-5 py-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => deletePortfolio(portfolio.id, portfolio.title)}
                  disabled={deleting === portfolio.id}
                  className="flex items-center gap-1.5 text-xs text-stone-300 hover:text-red-400 transition-colors disabled:opacity-30 py-1"
                >
                  <Trash2 size={12} />
                  {deleting === portfolio.id ? 'מוחק...' : 'מחיקת תיק'}
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
    </div>
  )
}
