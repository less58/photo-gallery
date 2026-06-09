'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Home, MessageCircle, Archive, Settings, Plus, LogOut, Snowflake } from 'lucide-react'

type Props = {
  brand: string
  isFrozen: boolean
  name: string
  logoUrl: string | null
}

export default function SidebarNav({ brand, isFrozen, name, logoUrl }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(() => {
    fetch('/api/dashboard/notes/summary', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data))
          setUnread(data.reduce((a: number, c: { unreadCount?: number }) => a + (c.unreadCount ?? 0), 0))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [pathname, fetchUnread])

  useEffect(() => {
    window.addEventListener('messages-read', fetchUnread)
    return () => window.removeEventListener('messages-read', fetchUnread)
  }, [fetchUnread])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/auth/login')
    setTimeout(() => window.location.assign('/auth/login'), 50)
  }

  function NavItem({ href, label, icon, exact = false, badge = 0 }: {
    href: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: number
  }) {
    const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
    return (
      <Link
        href={href}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
        style={active
          ? { background: brand + '18', color: brand, fontWeight: 600 }
          : { color: '#78716c' }
        }
      >
        <span className="relative shrink-0">
          {icon}
          {badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-bold px-0.5">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    )
  }

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-56 bg-white border-l border-stone-200 flex flex-col z-40" dir="rtl">
      {/* Brand */}
      <div className="p-5 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          {logoUrl && (
            <div className="w-8 h-8 relative shrink-0">
              <Image src={logoUrl} alt={name} fill unoptimized className="object-contain" />
            </div>
          )}
          <span className="font-bold text-stone-800 text-sm truncate">{name || 'select it'}</span>
        </div>
      </div>

      {/* Frozen banner */}
      {isFrozen && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-blue-600 text-xs">
          <Snowflake size={12} className="shrink-0" />
          <span>החשבון מוקפא</span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <NavItem href="/dashboard" label="בית — תיקים" icon={<Home size={16} />} exact />
        <NavItem href="/dashboard/messages" label="צאט" icon={<MessageCircle size={16} />} badge={unread} />
        <NavItem href="/dashboard/archive" label="קבצי תמונות נבחרות" icon={<Archive size={16} />} />
        <NavItem href="/dashboard/settings" label="הגדרות" icon={<Settings size={16} />} />

        {!isFrozen && (
          <div className="pt-2">
            <Link
              href="/dashboard/portfolio/new"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: brand }}
            >
              <Plus size={16} className="shrink-0" />
              <span>תיק חדש</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-stone-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-400 hover:text-red-400 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut size={16} className="shrink-0" />
          <span>יציאה</span>
        </button>
      </div>
    </aside>
  )
}
