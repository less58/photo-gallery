import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default async function PortfolioCoverPage(props: PageProps<'/portfolio/[id]'>) {
  const { id } = await props.params

  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('portfolio_session')?.value
  if (!sessionRaw) redirect('/login')

  const session = JSON.parse(sessionRaw) as { portfolioId: string }
  if (session.portfolioId !== id) redirect('/login')

  const admin = createAdminClient()

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('*, photographer:photographers(name, logo_url, brand_color)')
    .eq('id', id)
    .single()

  if (!portfolio) notFound()

  const photographer = portfolio.photographer as {
    name: string; logo_url: string | null; brand_color: string
  }

  const color = photographer.brand_color || '#C97B73'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      {/* Soft color glow background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 60%, ${color}40, transparent 70%)` }} />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-md w-full">
        {/* Logo */}
        {photographer.logo_url ? (
          <div className="w-36 h-36 relative">
            <Image src={photographer.logo_url} alt={photographer.name} fill unoptimized className="object-contain" />
          </div>
        ) : (
          <div className="text-2xl font-bold" style={{ color }}>{photographer.name}</div>
        )}

        {/* Cover image */}
        {portfolio.cover_url && (
          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
            <Image src={portfolio.cover_url} alt={portfolio.title} width={600} height={450}
              unoptimized className="w-full h-full object-cover" priority />
          </div>
        )}

        <div>
          <h1 className="text-3xl font-bold text-white mb-3">{portfolio.title}</h1>
          {portfolio.instructions && (
            <div className="rounded-xl p-4 text-sm leading-relaxed text-white/60"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {portfolio.instructions}
            </div>
          )}
        </div>

        <Link
          href={`/portfolio/${id}/gallery`}
          className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all active:scale-[0.98] shadow-xl"
          style={{ background: color }}
        >
          להתחלת הבחירה ✨
        </Link>
      </div>
    </div>
  )
}
