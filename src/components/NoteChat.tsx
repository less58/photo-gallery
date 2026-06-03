'use client'

import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'

type Note = {
  id: string
  sender: 'photographer' | 'client'
  message: string
  created_at: string
}

type Props = {
  fetchUrl: string
  postUrl: string
  mySender: 'photographer' | 'client'
  brandColor: string
}

export default function NoteChat({ fetchUrl, postUrl, mySender, brandColor }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true

    function fetchNotes(isFirstLoad = false) {
      fetch(fetchUrl)
        .then(r => r.json())
        .then(data => {
          if (!alive || !Array.isArray(data)) return
          setNotes(prev => {
            const lastPrev = prev[prev.length - 1]?.id
            const lastNew = data[data.length - 1]?.id
            // Only update state if there are actually new messages
            if (!isFirstLoad && prev.length === data.length && lastPrev === lastNew) return prev
            return data as Note[]
          })
        })
        .finally(() => { if (alive && isFirstLoad) setLoading(false) })
    }

    fetchNotes(true)
    const interval = setInterval(() => fetchNotes(false), 8000)

    return () => { alive = false; clearInterval(interval) }
  }, [fetchUrl])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.id) { setNotes(prev => [...prev, data as Note]); setMessage('') }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div className="overflow-y-auto px-4 py-3 space-y-2.5" style={{ minHeight: 220, maxHeight: 400 }}>
        {loading && <p className="text-center text-stone-400 text-xs py-6">טוענת...</p>}
        {!loading && notes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-stone-400 text-sm">אין הודעות עדיין</p>
            <p className="text-stone-300 text-xs mt-1">שלחי הודעה ראשונה 👇</p>
          </div>
        )}
        {notes.map(note => {
          const isMe = note.sender === mySender
          return (
            <div key={note.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[78%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm"
                style={isMe
                  ? { background: brandColor, color: '#fff', borderBottomRightRadius: 4 }
                  : { background: '#F3F4F6', color: '#374151', borderBottomLeftRadius: 4 }
                }
              >
                <p className="whitespace-pre-wrap break-words">{note.message}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/60 text-left' : 'text-stone-400 text-right'}`} dir="ltr">
                  {new Date(note.created_at).toLocaleString('he-IL', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="border-t border-stone-100 p-3 flex gap-2 items-center">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="כתבי הודעה..."
          className="flex-1 px-3 py-2 rounded-full border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-200 transition"
          disabled={sending}
          dir="auto"
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
          style={{ background: brandColor }}
        >
          <Send size={15} className="text-white" style={{ transform: 'scaleX(-1)' }} />
        </button>
      </form>
    </div>
  )
}
