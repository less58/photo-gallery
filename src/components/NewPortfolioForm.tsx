'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ImageIcon, Upload } from 'lucide-react'
import EmailInput from './EmailInput'
import { useToast } from './Toast'
import { saveClientToHistory } from '@/lib/clientHistory'

export default function NewPortfolioForm({ defaultInstructions }: { defaultInstructions: string }) {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState({
    clientEmail: '',
    title: '',
    instructions: defaultInstructions,
    quota: 30,
    clientPassword: '',
  })
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)

  function update(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleCoverSelect(file: File) {
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function resizeCover(file: File): Promise<File> {
    const MAX_DIM = 1200
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      if (bitmap.width <= MAX_DIM && bitmap.height <= MAX_DIM) { bitmap.close(); return file }
      const ratio = Math.min(MAX_DIM / bitmap.width, MAX_DIM / bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * ratio)
      canvas.height = Math.round(bitmap.height * ratio)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) return file
      return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    } catch { return file }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      let coverUrl: string | null = null

      if (coverFile) {
        const resized = await resizeCover(coverFile)
        const fd = new FormData()
        fd.append('file', resized)
        fd.append('folder', 'covers/new')
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (upRes.ok) {
          const { url } = await upRes.json()
          coverUrl = url || null
        } else {
          toast('שגיאה בהעלאת תמונת הכיסוי — ממשיכה ביצירת התיק', 'error')
        }
      }

      const pw = form.clientPassword.trim()
      if (!pw) {
        toast('יש להגדיר קוד גישה ללקוחה', 'error')
        setLoading(false)
        return
      }
      if (pw.length < 6 || pw.length > 10) {
        toast('הקוד חייב להיות בין 6 ל-10 תווים', 'error')
        setLoading(false)
        return
      }
      if (!/^[a-zA-Z0-9]+$/.test(pw)) {
        toast('ניתן להשתמש רק באותיות אנגלית ומספרים', 'error')
        setLoading(false)
        return
      }

      const res = await fetch('/api/dashboard/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, coverUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'שגיאה ביצירת התיק', 'error')
        return
      }
      saveClientToHistory(form.clientEmail)
      if (data.emailSent) {
        toast('התיק נוצר ומייל עם קישור נשלח ללקוחה ✓')
      } else {
        toast('התיק נוצר בהצלחה — מייל לא נשלח')
      }
      router.push(`/dashboard/portfolio/${data.id}`)
    } catch {
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white border border-stone-200 rounded-xl p-6 anim-fadeUp">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="font-semibold text-stone-800 mb-4">פרטי התיק</h2>

          <div>
            <label className={lbl}>כתובת מייל של הלקוחה</label>
            <EmailInput
              value={form.clientEmail}
              onChange={v => update('clientEmail', v)}
              className={inp} placeholder="client@email.com" required
            />
          </div>

          <div>
            <label className={lbl}>שם התיק</label>
            <input required value={form.title} onChange={e => update('title', e.target.value)}
              className={inp} placeholder="למשל: צילומי לידה — ניניטה" />
          </div>

          <div>
            <label className={lbl}>
              קוד גישה ללקוחה
              <span className="text-red-400 mr-1">*</span>
            </label>
            <input
              required
              value={form.clientPassword}
              onChange={e => update('clientPassword', e.target.value)}
              className={inp}
              placeholder="לדוגמה: noa2024"
              autoComplete="off"
            />
            <p className="text-xs text-stone-400 mt-1">6–10 תווים, אותיות אנגלית ומספרים בלבד.</p>
          </div>

          <div>
            <label className={lbl}>מכסת תמונות</label>
            <div className="flex items-center gap-3 mt-1">
              <input type="range" min={1} max={300} value={form.quota}
                onChange={e => update('quota', parseInt(e.target.value))}
                className="flex-1" style={{ accentColor: 'var(--brand)' }} />
              <input
                type="number" min={1} max={300} value={form.quota}
                onChange={e => {
                  const v = Math.min(300, Math.max(1, parseInt(e.target.value) || 1))
                  update('quota', v)
                }}
                className="w-16 px-2 py-1.5 rounded-lg border border-stone-200 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
          </div>

          <div>
            <label className={lbl}>
              הוראות ללקוחה
              {defaultInstructions && <span className="text-stone-400 font-normal text-xs mr-1"> — ברירת מחדל מהגדרות</span>}
            </label>
            <textarea value={form.instructions} onChange={e => update('instructions', e.target.value)}
              className={inp + ' resize-none'} rows={3}
              placeholder="למשל: אנא בחרי עד 30 תמונות שהכי אהבת 💕" />
          </div>

          {/* Cover image */}
          <div>
            <label className={lbl}>תמונת כיסוי (אופציונלי)</label>
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-stone-200 hover:border-stone-300 transition-colors overflow-hidden"
            >
              {coverPreview ? (
                <div className="relative w-full h-40">
                  <Image src={coverPreview} alt="" fill unoptimized className="object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-medium">לחצי לשינוי</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-stone-400 gap-2">
                  <ImageIcon size={24} strokeWidth={1.2} className="opacity-50" />
                  <span className="text-sm">לחצי להוספת תמונת כיסוי</span>
                </div>
              )}
            </button>
            <input
              ref={coverRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { handleCoverSelect(f); e.target.value = '' } }}
            />
          </div>

          <button type="submit" disabled={loading}
            className={btn} style={{ background: 'var(--brand)' }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Upload size={14} className="animate-bounce" />
                {coverFile ? 'מעלה ויוצרת...' : 'יוצרת...'}
              </span>
            ) : 'צרי תיק'}
          </button>
        </form>
      </div>
    </div>
  )
}

const lbl = 'block text-sm font-medium text-stone-700 mb-1.5'
const inp = 'w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition text-sm placeholder:text-stone-300'
const btn = 'w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50'
