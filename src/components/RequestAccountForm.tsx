'use client'

import { useState } from 'react'
import EmailInput from './EmailInput'

export default function RequestAccountForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const res = await fetch('/api/auth/account-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, details }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'לא ניתן לשלוח בקשה כרגע')
        return
      }
      setSent(true)
      setMessage('הבקשה נשלחה למנהל המערכת')
      setTimeout(() => {
        window.location.href = '/auth/login'
      }, 1600)
    } catch {
      setError('שגיאה בשליחת הבקשה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-right">
      <div>
        <label className={label}>מייל</label>
        <EmailInput
          required
          disabled={sent}
          value={email}
          onChange={setEmail}
          className={input}
        />
      </div>
      <div>
        <label className={label}>שם מלא</label>
        <input
          required
          disabled={sent}
          value={name}
          onChange={e => setName(e.target.value)}
          className={input}
          placeholder="שם הצלמת"
        />
      </div>
      <div>
        <label className={label}>כמה מילים עלייך</label>
        <textarea
          disabled={sent}
          value={details}
          onChange={e => setDetails(e.target.value)}
          className={input + ' resize-none'}
          rows={3}
          placeholder="למשל שם העסק, טלפון, או כל פרט שיעזור לזהות אותך"
        />
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      {message && <p className="text-green-600 text-sm text-center">{message}</p>}

      <button
        type="submit"
        disabled={loading || sent}
        className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--brand)' }}
      >
        {sent ? 'הבקשה נשלחה' : loading ? 'שולחת...' : 'הגשת בקשה לפתיחת חשבון'}
      </button>
    </form>
  )
}

const label = 'block text-sm font-medium text-stone-700 mb-1.5'
const input = 'w-full px-3 py-2.5 rounded-lg border border-rose-100 bg-warm-white focus:outline-none focus:ring-2 focus:ring-brand text-sm'
