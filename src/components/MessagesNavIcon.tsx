'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function MessagesNavIcon() {
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()

  const fetchUnread = useCallback(() => {
    fetch('/api/dashboard/notes/summary', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUnread(data.reduce((a, c) => a + (c.unreadCount ?? 0), 0))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [pathname, fetchUnread])

  // Re-fetch immediately when messages are marked as read elsewhere
  useEffect(() => {
    window.addEventListener('messages-read', fetchUnread)
    return () => window.removeEventListener('messages-read', fetchUnread)
  }, [fetchUnread])

  const isActive = pathname === '/dashboard/messages'

  return (
    <Link
      href="/dashboard/messages"
      className="relative p-2 rounded-lg transition-colors"
      style={isActive
        ? { color: 'var(--brand)', background: 'var(--brand-light)' }
        : { color: '#a8a29e' }}
      title="הודעות"
    >
      <MessageCircle size={17} className={isActive ? '' : 'hover:text-stone-600'} />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold px-0.5">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
