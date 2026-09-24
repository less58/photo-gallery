import { getSessionUser, getPhotographerByEmail } from '@/lib/auth/getPhotographer'
import { redirect } from 'next/navigation'
import SidebarNav from '@/components/SidebarNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const photographer = await getPhotographerByEmail(user.email!)

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
    <div className="min-h-screen flex" style={{ ...brandVars, background: '#F5F4F2' }} dir="rtl">
      <SidebarNav
        brand={brand}
        isFrozen={isFrozen}
        name={photographer?.name || ''}
        logoUrl={photographer?.logo_url || null}
      />

      {/* Main content — offset to the right of sidebar (sidebar is on the right, content on the left) */}
      <main className="flex-1 mr-56 px-6 py-8 min-h-screen" dir="rtl">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
