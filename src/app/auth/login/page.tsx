'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'

export default function AuthLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/photographer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'ההתחברות נכשלה')
        setLoading(false)
        return
      }

      router.push(data.redirectTo || '/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      setError('החיבור לשרת נכשל. נסי שוב בעוד רגע.')
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (oauthError) {
        setError('התחברות עם Google נכשלה')
        setLoading(false)
      }
    } catch {
      setError('התחברות עם Google נכשלה')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-warm-white px-4">
      <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full bg-brand-light opacity-40 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 anim-fadeUp">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-32 h-32 relative">
            <Image src="/logo.jpg" alt="Select it" fill className="object-contain" />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-rose-100 p-8">
          <h1 className="text-xl font-bold text-charcoal mb-1 text-center">כניסת צלמת</h1>
          <p className="text-muted text-sm text-center mb-6">הכניסי את פרטי החשבון שלך</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">מייל</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-rose-100 bg-warm-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition placeholder:text-muted text-sm"
                placeholder="your@email.com" dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">סיסמה</label>
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-rose-100 bg-warm-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition placeholder:text-muted text-sm"
                placeholder="••••••••" dir="ltr"
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'var(--brand)' }}
            >
              {loading ? 'מתחברת...' : 'כניסה'}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-rose-100 flex-1" />
              <span className="text-xs text-muted">או</span>
              <div className="h-px bg-rose-100 flex-1" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-rose-100 bg-white text-charcoal font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              כניסה עם Google
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-muted text-sm hover:text-brand transition">
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  )
}
