import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PortfolioTabs from '@/components/PortfolioTabs'

export const dynamic = 'force-dynamic'

export default async function PortfolioDetailPage(props: PageProps<'/dashboard/portfolio/[id]'>) {
  const { id } = await props.params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .select('*, photographer:photographers(*)')
    .eq('id', id)
    .single()

  if (error || !portfolio) notFound()

  // Generate magic_token for older portfolios that don't have one yet
  if (!portfolio.magic_token) {
    const token = crypto.randomUUID()
    await admin.from('portfolios').update({ magic_token: token }).eq('id', id)
    portfolio.magic_token = token
  }

  const { data: sessions, error: sessErr } = await admin
    .from('sessions')
    .select('*, photos(*)')
    .eq('portfolio_id', id)
    .order('sort_order')

  if (sessErr) console.error('[portfolio page] sessions error:', sessErr.message)

  const { data: selections } = await admin
    .from('selections')
    .select('photo_id, status')
    .eq('portfolio_id', id)

  const photographer = portfolio.photographer as Record<string, unknown>

  return (
    <PortfolioTabs
      portfolio={portfolio}
      sessions={sessions || []}
      selections={selections || []}
      photographer={{
        id: String(photographer.id ?? ''),
        name: String(photographer.name ?? ''),
        logo_url: (photographer.logo_url as string) ?? null,
        brand_color: String(photographer.brand_color ?? '#D4736A'),
        watermark_url: (photographer.watermark_url as string) ?? null,
        watermark_public_id: (photographer.watermark_public_id as string) ?? null,
      }}
    />
  )
}
