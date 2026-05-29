'use client'

import { useState } from 'react'
import { Plus, Trash2, Camera, FolderOpen, X } from 'lucide-react'

type Photographer = {
  id: string
  name: string
  email: string
  brand_color: string
  created_at: string
  portfolioCount: number
}

export default function AdminPanel({ initialPhotographers }: { initialPhotographers: Photographer[] }) {
  const [list, setList] = useState(initialPhotographers)
  const [showModal, setShowModal] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function remove(id: string, name: string) {
    if (!confirm(`להסיר את ${name} ואת כל התיקים שלה?`)) return
    setRemoving(id)
    await fetch(`/api/admin/photographer/${id}`, { method: 'DELETE' })
    setList(l => l.filter(p => p.id !== id))
    setRemoving(null)
  }

  async function addPhotographer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/admin/photographer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error); setSaving(false); return }
    setList(prev => [{ ...data, portfolioCount: 0 }, ...prev])
    setForm({ name: '', email: '', password: '' })
    setShowModal(false)
    setSaving(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">צלמות במערכת</h1>
          <p className="text-stone-400 text-sm mt-0.5">{list.length} צלמות רשומות</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--brand)' }}
        >
          <Plus size={16} />
          הוספת צלמת
        </button>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400">
          <Camera size={40} strokeWidth={1.5} className="mb-3 opacity-40" />
          <p className="font-medium">אין עדיין צלמות</p>
          <p className="text-sm mt-1">הוסיפי את הראשונה</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
          {list.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors anim-fadeUp"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: p.brand_color || 'var(--brand)' }}
              >
                {p.name?.[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800 text-sm">{p.name}</p>
                <p className="text-stone-400 text-xs mt-0.5 dir-ltr truncate" dir="ltr">{p.email}</p>
              </div>

              <div className="flex items-center gap-1.5 text-stone-400 text-xs shrink-0">
                <FolderOpen size={14} />
                <span>{p.portfolioCount} תיקים</span>
              </div>

              <button
                onClick={() => remove(p.id, p.name)}
                disabled={removing === p.id}
                className="p-2 rounded-lg text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30"
                title="הסרה"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Photographer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl anim-pop">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
              <h2 className="font-bold text-stone-800">הוספת צלמת חדשה</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addPhotographer} className="p-6 space-y-4">
              <div>
                <label className={lbl}>שם מלא</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inp} placeholder="שם הצלמת" />
              </div>
              <div>
                <label className={lbl}>כתובת מייל</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={inp} placeholder="photographer@email.com" dir="ltr" />
              </div>
              <div>
                <label className={lbl}>סיסמה ראשונית</label>
                <input required type="text" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={inp} placeholder="לפחות 6 תווים" dir="ltr" />
              </div>

              {formError && <p className="text-red-500 text-sm">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-500 text-sm font-medium hover:bg-stone-50 transition">
                  ביטול
                </button>
                <button type="submit" disabled={saving}
                  className="flex-[2] py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'var(--brand)' }}>
                  {saving ? 'יוצרת...' : 'צרי חשבון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = 'block text-sm font-medium text-stone-600 mb-1'
const inp = 'w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition text-sm placeholder:text-stone-300'
