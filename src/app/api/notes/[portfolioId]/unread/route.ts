import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

async function getSession(portfolioId: string) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('portfolio_session')?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as { portfolioId: string; email: string }
    return s.portfolioId === portfolioId ? s : null
  } catch { return null }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params
  if (!await getSession(portfolioId)) return Response.json({ count: 0 })

  const admin = createAdminClient()
  const { count } = await admin
    .from('portfolio_notes')
    .select('*', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId)
    .eq('sender', 'photographer')
    .eq('read_by_client', false)

  return Response.json({ count: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
