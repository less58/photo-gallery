import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PortfolioList from '@/components/PortfolioList'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const { data: photographer } = await admin
    .from('photographers')
    .select('id, name, brand_color')
    .eq('email', user!.email!)
    .maybeSingle()

  const { data: portfolios } = photographer
    ? await admin
        .from('portfolios')
        .select('id, title, client_email, quota, cover_url, is_done, created_at, sessions(id, photos(id)), selections(id)')
        .eq('photographer_id', photographer.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const color = photographer?.brand_color || '#D4736A'

  const enriched = (portfolios || []).map(p => {
    const r = p as Record<string, unknown>
    const sessions = Array.isArray(p.sessions) ? p.sessions : []
    const photoCount = sessions.reduce((acc: number, s: { photos: unknown[] }) =>
      acc + (Array.isArray(s.photos) ? s.photos.length : 0), 0)
    const selectionsArr = Array.isArray(r.selections) ? r.selections as unknown[] : []
    return {
      id: p.id,
      title: p.title,
      client_email: p.client_email,
      quota: p.quota,
      cover_url: r.cover_url as string | null ?? null,
      is_done: (r.is_done as boolean) ?? false,
      sessionCount: sessions.length,
      photoCount,
      selectionCount: selectionsArr.length,
    }
  })

  return <PortfolioList portfolios={enriched} color={color} photographerName={photographer?.name || ''} />
}
