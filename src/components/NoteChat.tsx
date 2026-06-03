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
  onSend?: () => void
}

export default function NoteChat({ fetchUrl, postUrl, mySender, brandColor, onSend }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch + poll
  useEffect(() => {
    let alive = true

    function fetchNotes(isFirstLoad = false) {
      fetch(fetchUrl, { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (!alive || !Array.isArray(data)) return
          setNotes(prev => {
            const lastPrev = prev[prev.length - 1]?.id
            const lastNew = (data as Note[])[data.length - 1]?.id
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

  // Mark as read when either side opens the chat
  useEffect(() => {
    fetch(fetchUrl, { method: 'PATCH' }).catch(() => {})
  }, [fetchUrl])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes])

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  async function handleSend() {
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        setNotes(prev => [...prev, data as Note])
        setMessage('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        onSend?.()
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ minHeight: 160 }}>
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
      <form
        onSubmit={e => { e.preventDefault(); void handleSend() }}
        className="border-t border-stone-100 p-3 flex gap-2 items-end"
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={e => { setMessage(e.target.value); autoResize() }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
          }}
          placeholder="כתבי הודעה... (Enter לשליחה)"
          className="flex-1 px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 transition resize-none overflow-hidden leading-relaxed"
          style={{
            color: '#1c1917',
            WebkitTextFillColor: '#1c1917',
            minHeight: '36px',
            maxHeight: '120px',
          }}
          rows={1}
          disabled={sending}
          dir="auto"
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40 mb-0.5"
          style={{ background: brandColor }}
        >
          <Send size={15} className="text-white" style={{ transform: 'scaleX(-1)' }} />
        </button>
      </form>
    </div>
  )
}
