'use client'

import { useState, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function PasswordEntryPage() {
  const params = useParams()
  const id = params.id as string

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/portfolio/${id}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        // Full page load so the session cookie is read fresh by the server
        window.location.replace(`/portfolio/${id}`)
      } else {
        const data = await res.json()
        setError(data.error || 'קוד שגוי')
        setLoading(false)
      }
    } catch {
      setError('שגיאת חיבור')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0A0A0A' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-6">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
            <Lock size={26} className="text-white/70" />
          </div>

          <div className="text-center">
            <h1 className="text-white font-bold text-xl mb-1">כניסה לגלריה</h1>
            <p className="text-white/50 text-sm">יש להזין את קוד הגישה שקיבלת מהצלמת</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="קוד גישה"
              dir="ltr"
              autoFocus
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-center text-lg tracking-widest focus:outline-none focus:border-white/50 transition"
            />

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: '#C97B73' }}
            >
              {loading ? 'בודקת...' : 'כניסה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
