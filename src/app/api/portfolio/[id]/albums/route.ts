import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('portfolio_session')?.value
  if (!sessionRaw) return Response.json({ error: 'לא מורשה' }, { status: 401 })

  let parsed: { portfolioId: string } | null = null
  try { parsed = JSON.parse(sessionRaw) } catch { return Response.json({ error: 'לא מורשה' }, { status: 401 }) }
  if (!parsed || parsed.portfolioId !== id) return Response.json({ error: 'לא מורשה' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('albums')
    .select('*')
    .eq('portfolio_id', id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ albums: data || [] })
}
