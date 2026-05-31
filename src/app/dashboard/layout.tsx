import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { Settings, Home, Plus, Snowflake } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: photographer } = await supabase
    .from('photographers')
    .select('id, brand_color, logo_url, name, is_frozen')
    .eq('email', user.email!)
    .maybeSingle()

  if (!photographer) {
    redirect(`/auth/request-account?email=${encodeURIComponent(user.email!)}`)
  }

  const isFrozen = photographer?.is_frozen ?? false
  const brand = photographer?.brand_color || '#D4736A'
  const brandVars = {
    '--brand': brand,
    '--brand-dark': brand,
    '--brand-light': brand + '18',
  } as React.CSSProperties

  return (
    <div className="min-h-screen flex flex-col" style={{ ...brandVars, background: '#F5F4F2' }}>
      <nav className="bg-white border-b border-stone-200 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 relative">
              <Image
                src={photographer?.logo_url || '/logo.jpg'}
                alt="Select it"
                fill
                className="object-contain"
                sizes="32px"
                unoptimized
              />
            </div>
            <span className="font-bold text-stone-800 text-sm">{photographer?.name || 'select it'}</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <Link href="/dashboard"
              className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              title="תיקים">
              <Home size={17} />
            </Link>
            {!isFrozen && (
              <Link href="/dashboard/portfolio/new"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: brand }}>
                <Plus size={15} /> תיק חדש
              </Link>
            )}
            <Link href="/dashboard/settings"
              className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              title="הגדרות">
              <Settings size={17} />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {isFrozen && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 text-center">
          <p className="text-blue-700 text-sm flex items-center justify-center gap-2">
            <Snowflake size={14} />
            החשבון שלך מוקפא. ניתן לצפות בתיקים הקיימים ולהוריד דוחות, אך לא ניתן ליצור תיקים חדשים או להעלות תמונות.
            <Snowflake size={14} />
          </p>
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  )
}
