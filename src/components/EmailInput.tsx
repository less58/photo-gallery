'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getClientHistory } from '@/lib/clientHistory'

const EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'walla.co.il', 'bezeqint.net', 'netvision.net.il', 'icloud.com',
]

type Props = {
  value: string
  onChange: (email: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  id?: string
  disabled?: boolean
}

type Suggestion = { email: string; fromHistory: boolean }

export default function EmailInput({ value, onChange, placeholder, required, className, id, disabled }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<{ email: string }[]>([])

  useEffect(() => { setHistory(getClientHistory()) }, [])

  const buildSuggestions = useCallback((v: string) => {
    const lower = v.toLowerCase()
    const sug: Suggestion[] = []

    // History matches
    if (lower.length >= 1) {
      history
        .filter(r => r.email.startsWith(lower) && r.email !== lower)
        .slice(0, 4)
        .forEach(r => sug.push({ email: r.email, fromHistory: true }))
    }

    // Domain completions after @
    const atIdx = v.indexOf('@')
    if (atIdx > 0) {
      const afterAt = v.slice(atIdx + 1).toLowerCase()
      const prefix = v.slice(0, atIdx + 1)
      EMAIL_DOMAINS
        .filter(d => d.startsWith(afterAt) && d !== afterAt)
        .forEach(d => {
          const full = prefix + d
          if (!sug.some(s => s.email === full)) {
            sug.push({ email: full, fromHistory: false })
          }
        })
    }

    setSuggestions(sug)
    setActiveIdx(0)
  }, [history])

  useEffect(() => { buildSuggestions(value) }, [value, buildSuggestions])

  function pick(s: Suggestion) {
    onChange(s.email)
    setSuggestions([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return
    if (e.key === 'Tab' || e.key === 'ArrowLeft') {
      e.preventDefault()
      pick(suggestions[activeIdx] ?? suggestions[0])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

  const inlineSuggestion = suggestions.find(s => !s.fromHistory && s.email.startsWith(value))?.email ?? ''

  return (
    <div className="relative">
      <input
        ref={inputRef} id={id} type="email" required={required} disabled={disabled}
        value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setSuggestions([]), 180)}
        placeholder={placeholder} dir="ltr" autoComplete="off"
        className={className}
      />

      {value.includes('@') && inlineSuggestion && inlineSuggestion !== value && (
        <div
          className={(className || '') + ' absolute inset-0 z-10 pointer-events-none text-sm flex items-center overflow-hidden bg-transparent border-transparent'}
          dir="ltr"
          aria-hidden="true"
        >
          <span className="text-transparent whitespace-pre">{value}</span>
          <span className="text-stone-300 whitespace-pre">{inlineSuggestion.slice(value.length)}</span>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-xl overflow-hidden text-sm"
          style={{ maxHeight: 220, overflowY: 'auto' }}>
          {suggestions.map((s, i) => {
            const matchLen = value.length
            return (
              <li
                key={s.email}
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                style={i === activeIdx ? { background: 'var(--brand-light)' } : {}}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => { e.preventDefault(); pick(s) }}
              >
                <span className="flex-1 font-mono text-xs" dir="ltr">
                  <strong>{s.email.slice(0, matchLen)}</strong>
                  <span className="text-stone-400">{s.email.slice(matchLen)}</span>
                </span>
                {s.fromHistory && (
                  <span className="text-[10px] text-stone-400 shrink-0">שימוש קודם</span>
                )}
                {i === activeIdx && (
                  <span className="text-[10px] text-stone-300 font-mono bg-stone-100 px-1 rounded">TAB</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
