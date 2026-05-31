import Image from 'next/image'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F7F5F4' }}>
      <nav className="bg-white border-b border-stone-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              <Image src="/logo.jpg" alt="Select it" fill className="object-contain" />
            </div>
            <span className="text-sm font-semibold text-stone-700 tracking-wide uppercase">
              System Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-stone-500 hover:text-stone-800 transition">צלמות</Link>
            <Link href="/admin/settings" className="text-sm text-stone-500 hover:text-stone-800 transition">הגדרות מייל</Link>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        {children}
      </main>
    </div>
  )
}
