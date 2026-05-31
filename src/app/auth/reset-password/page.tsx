'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('לא ניתן לעדכן את הסיסמה. פתחי שוב את הקישור מהמייל.')
      return
    }

    setMessage('הסיסמה עודכנה בהצלחה')
    setTimeout(() => router.push('/auth/login'), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl border border-rose-100 p-8 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-charcoal text-center">איפוס סיסמה</h1>
        <p className="text-muted text-sm text-center">בחרי סיסמה חדשה לחשבון שלך</p>
        <input
          required
          minLength={6}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-rose-100 bg-warm-white focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="לפחות 6 תווים"
          dir="ltr"
        />
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {message && <p className="text-green-600 text-sm text-center">{message}</p>}
        <button
          type="submit"
          disabled={loading || password.length < 6}
          className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          {loading ? 'שומרת...' : 'שמירת סיסמה חדשה'}
        </button>
      </form>
    </div>
  )
}
