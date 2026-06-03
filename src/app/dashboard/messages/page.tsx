'use client'

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, ArrowRight, ChevronDown, ChevronUp, Search, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import NoteChat from '@/components/NoteChat'

type Conversation = {
  portfolioId: string
  portfolioTitle: string
  clientEmail: string
  isDone: boolean
  coverUrl: string | null
  unreadCount: number
  lastMessage: string | null
  lastMessageAt: string | null
  lastSender: 'photographer' | 'client' | null
}

function formatMsgTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (msgDay === todayStart) return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  if (msgDay === yesterdayStart) return 'אתמול'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
}

function Avatar({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  const letter = title.trim()[0] ?? '?'
  const thumb = coverUrl?.includes('cloudinary.com')
    ? coverUrl.replace('/upload/', '/upload/w_80,h_80,c_fill,q_auto/')
    : coverUrl

  return (
    <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-stone-500 text-sm font-semibold select-none">{letter}</span>
      )}
    </div>
  )
}

function ConvItem({
  conv,
  isSelected,
  onClick,
}: {
  conv: Conversation
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right px-4 py-3 border-b border-stone-50 transition-colors ${
        isSelected ? 'bg-stone-100' : 'hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar coverUrl={conv.coverUrl} title={conv.portfolioTitle} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-stone-800 text-sm truncate">
              {conv.portfolioTitle}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {formatMsgTime(conv.lastMessageAt) && (
                <span className="text-stone-400 text-[10px]">{formatMsgTime(conv.lastMessageAt)}</span>
              )}
              {conv.unreadCount > 0 && (
                <span
                  className="min-w-[20px] h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1"
                  style={{ background: 'var(--brand)' }}
                >
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </div>
          <p className="text-stone-400 text-[11px] truncate">{conv.clientEmail}</p>
          {conv.lastMessage ? (
            <p className={`text-xs truncate mt-0.5 ${
              conv.unreadCount > 0 && conv.lastSender === 'client'
                ? 'font-medium text-stone-700'
                : 'text-stone-400'
            }`}>
              {conv.lastSender === 'photographer' ? '↩ ' : ''}{conv.lastMessage}
            </p>
          ) : (
            <p className="text-stone-300 text-xs mt-0.5 italic">אין הודעות עדיין</p>
          )}
        </div>
      </div>
    </button>
  )
}

function MessagesPageInner() {
  const searchParams = useSearchParams()
  const portfolioParam = searchParams.get('portfolio')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [search, setSearch] = useState('')
  const autoSelectedRef = useRef(false)

  const fetchSummary = useCallback((silent = false) => {
    fetch('/api/dashboard/notes/summary', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setConversations(data as Conversation[])
      })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false) })
  }, [])

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(() => fetchSummary(true), 30000)
    return () => clearInterval(interval)
  }, [fetchSummary])

  // Auto-select portfolio from URL param (e.g. coming from portfolio notes tab)
  useEffect(() => {
    if (!portfolioParam || autoSelectedRef.current || loading) return
    const match = conversations.find(c => c.portfolioId === portfolioParam)
    if (!match) return
    autoSelectedRef.current = true
    setSelectedId(portfolioParam)
    setShowSidebar(false)
    setConversations(prev =>
      prev.map(c => c.portfolioId === portfolioParam ? { ...c, unreadCount: 0 } : c)
    )
  }, [portfolioParam, conversations, loading])

  function selectConversation(portfolioId: string) {
    setSelectedId(portfolioId)
    setShowSidebar(false)
    setConversations(prev =>
      prev.map(c => c.portfolioId === portfolioId ? { ...c, unreadCount: 0 } : c)
    )
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(c =>
      c.portfolioTitle.toLowerCase().includes(q) ||
      c.clientEmail.toLowerCase().includes(q)
    )
  }, [conversations, search])

  const active = filtered.filter(c => !c.isDone)
  const completed = filtered.filter(c => c.isDone)
  const selected = conversations.find(c => c.portfolioId === selectedId)

  return (
    <div
      className="flex -mx-6 -my-8 overflow-hidden"
      style={{ height: 'calc(100vh - 68px)' }}
    >
      {/* ── Sidebar ── */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 shrink-0 border-r border-stone-200 bg-white`}>
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-800 text-base">הודעות</h2>
          <p className="text-xs text-stone-400 mt-0.5">התכתבות עם לקוחות פעילות</p>
          <div className="relative mt-3">
            <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ניתן לחפש לקוח לפי שם תיק או מייל"
              className="w-full pr-8 pl-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-200 transition placeholder:text-stone-300"
              dir="rtl"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-center text-stone-400 text-xs py-10">טוענת...</p>}

          {!loading && active.length === 0 && !search && (
            <div className="text-center py-10">
              <MessageCircle size={30} strokeWidth={1.2} className="mx-auto mb-2 text-stone-200" />
              <p className="text-stone-400 text-sm">אין תיקים פעילים</p>
            </div>
          )}

          {!loading && active.length === 0 && search && (
            <p className="text-center text-stone-400 text-xs py-8">לא נמצאו תוצאות</p>
          )}

          {active.map(conv => (
            <ConvItem
              key={conv.portfolioId}
              conv={conv}
              isSelected={selectedId === conv.portfolioId}
              onClick={() => selectConversation(conv.portfolioId)}
            />
          ))}

          {/* Completed portfolios toggle */}
          {completed.length > 0 && (
            <div className="border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowCompleted(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <span>תיקים שהושלמו ({completed.length})</span>
                {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showCompleted && completed.map(conv => (
                <ConvItem
                  key={conv.portfolioId}
                  conv={conv}
                  isSelected={selectedId === conv.portfolioId}
                  onClick={() => selectConversation(conv.portfolioId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-white`}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-300 gap-3">
            <MessageCircle size={48} strokeWidth={1} />
            <p className="text-sm">בחרי לקוחה מהרשימה</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-stone-100 bg-stone-50 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSidebar(true)}
                className="md:hidden p-1 rounded-lg text-stone-400 hover:text-stone-600 transition"
              >
                <ArrowRight size={18} />
              </button>
              {selected && (
                <Avatar coverUrl={selected.coverUrl} title={selected.portfolioTitle} />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800 text-sm truncate">{selected?.portfolioTitle}</p>
                <p className="text-xs text-stone-400 truncate" dir="ltr">{selected?.clientEmail}</p>
              </div>
              {selected?.isDone && (
                <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">הושלם</span>
              )}
              <Link
                href={`/dashboard/portfolio/${selectedId}`}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 text-xs font-medium hover:border-stone-300 hover:text-stone-700 transition-colors"
              >
                <FolderOpen size={13} />
                מעבר לתיק
              </Link>
            </div>

            <div className="flex-1 overflow-hidden">
              <NoteChat
                key={selectedId}
                fetchUrl={`/api/dashboard/portfolio/${selectedId}/notes`}
                postUrl={`/api/dashboard/portfolio/${selectedId}/notes`}
                mySender="photographer"
                brandColor="var(--brand)"
                onSend={() => fetchSummary(true)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesPageInner />
    </Suspense>
  )
}
