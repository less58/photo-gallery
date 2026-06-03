'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageCircle, ArrowRight } from 'lucide-react'
import NoteChat from '@/components/NoteChat'

type Conversation = {
  portfolioId: string
  portfolioTitle: string
  clientEmail: string
  unreadCount: number
  lastMessage: string | null
  lastMessageAt: string | null
  lastSender: 'photographer' | 'client' | null
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  const fetchSummary = useCallback(() => {
    fetch('/api/dashboard/notes/summary', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setConversations(data as Conversation[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(fetchSummary, 30000)
    return () => clearInterval(interval)
  }, [fetchSummary])

  function selectConversation(portfolioId: string) {
    setSelectedId(portfolioId)
    setShowSidebar(false)
    // Optimistically clear unread badge
    setConversations(prev =>
      prev.map(c => c.portfolioId === portfolioId ? { ...c, unreadCount: 0 } : c)
    )
  }

  const selected = conversations.find(c => c.portfolioId === selectedId)

  return (
    <div
      className="flex -mx-6 -my-8 overflow-hidden"
      style={{ height: 'calc(100vh - 68px)' }}
    >
      {/* ── Sidebar ── */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 shrink-0 border-r border-stone-200 bg-white`}>
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-800 text-base">הודעות</h2>
          <p className="text-xs text-stone-400 mt-0.5">התכתבות עם לקוחות</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-center text-stone-400 text-xs py-10">טוענת...</p>
          )}
          {!loading && conversations.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle size={32} strokeWidth={1.2} className="mx-auto mb-2 text-stone-200" />
              <p className="text-stone-400 text-sm">אין שיחות עדיין</p>
              <p className="text-stone-300 text-xs mt-1">לקוחות יכולות לשלוח הודעות מהגלריה</p>
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.portfolioId}
              type="button"
              onClick={() => selectConversation(conv.portfolioId)}
              className={`w-full text-right px-4 py-3 border-b border-stone-50 transition-colors ${
                selectedId === conv.portfolioId
                  ? 'bg-stone-100'
                  : 'hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-stone-800 text-sm truncate">
                  {conv.portfolioTitle}
                </span>
                {conv.unreadCount > 0 && (
                  <span
                    className="shrink-0 min-w-[20px] h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1"
                    style={{ background: 'var(--brand)' }}
                  >
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              <p className="text-stone-400 text-[11px] truncate">{conv.clientEmail}</p>
              {conv.lastMessage && (
                <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 && conv.lastSender === 'client' ? 'font-medium text-stone-700' : 'text-stone-400'}`}>
                  {conv.lastSender === 'photographer' ? '↩ ' : ''}{conv.lastMessage}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-white`}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-300 gap-3">
            <MessageCircle size={48} strokeWidth={1} />
            <p className="text-sm">בחרי שיחה מהרשימה</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-stone-100 bg-stone-50 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSidebar(true)}
                className="md:hidden p-1 rounded-lg text-stone-400 hover:text-stone-600 transition"
              >
                <ArrowRight size={18} />
              </button>
              <div>
                <p className="font-semibold text-stone-800 text-sm">{selected?.portfolioTitle}</p>
                <p className="text-xs text-stone-400" dir="ltr">{selected?.clientEmail}</p>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-hidden">
              <NoteChat
                key={selectedId}
                fetchUrl={`/api/dashboard/portfolio/${selectedId}/notes`}
                postUrl={`/api/dashboard/portfolio/${selectedId}/notes`}
                mySender="photographer"
                brandColor="var(--brand)"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
