import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ portfolioId: string }> }

async function getSession(portfolioId: string) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('portfolio_session')?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as { portfolioId: string; email: string }
    return s.portfolioId === portfolioId ? s : null
  } catch { return null }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { portfolioId } = await params
  if (!await getSession(portfolioId)) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('portfolio_notes')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { portfolioId } = await params
  if (!await getSession(portfolioId)) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { message } = await req.json()
  if (!message?.trim()) return Response.json({ error: 'הודעה ריקה' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('portfolio_notes')
    .insert({ portfolio_id: portfolioId, sender: 'client', message: message.trim(), read_by_client: true })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(_req: NextRequest, { params }: Params) {
  const { portfolioId } = await params
  if (!await getSession(portfolioId)) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()
  await admin
    .from('portfolio_notes')
    .update({ read_by_client: true })
    .eq('portfolio_id', portfolioId)
    .eq('sender', 'photographer')
    .eq('read_by_client', false)

  return Response.json({ ok: true })
}
