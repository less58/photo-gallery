import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()

  const { data: photographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', user.email!)
    .maybeSingle()
  if (!photographer) return Response.json({ error: 'לא נמצאת' }, { status: 404 })

  // Snapshots (deleted portfolios)
  const { data: snapshots } = await admin
    .from('selection_snapshots')
    .select('id, portfolio_id, portfolio_title, client_email, approved_count, created_at, downloaded_at')
    .eq('photographer_id', photographer.id)

  // Active portfolios with their selections
  const { data: portfolios } = await admin
    .from('portfolios')
    .select('id, title, client_email, created_at, selections(id, status)')
    .eq('photographer_id', photographer.id)

  // Portfolios that already have a snapshot (deleted) — skip them from active list
  const snapshotPortfolioIds = new Set((snapshots || []).map(s => s.portfolio_id).filter(Boolean))

  const activeEntries = (portfolios || [])
    .filter(p => !snapshotPortfolioIds.has(p.id))
    .map(p => {
      const sels = (p.selections || []) as { status: string }[]
      return {
        id: p.id,
        source: 'portfolio' as const,
        portfolio_title: p.title,
        client_email: p.client_email,
        approved_count: sels.filter(s => s.status === 'approved').length,
        total_selections: sels.length,
        created_at: p.created_at,
        downloaded_at: null,
      }
    })

  const snapshotEntries = (snapshots || []).map(s => ({
    ...s,
    source: 'snapshot' as const,
    total_selections: s.approved_count,
  }))

  const combined = [...activeEntries, ...snapshotEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return Response.json(combined)
}
