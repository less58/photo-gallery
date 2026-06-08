import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const [{ data: sessions }, { data: selections }] = await Promise.all([
    admin.from('sessions')
      .select('*, photos(*)')
      .eq('portfolio_id', id)
      .order('sort_order'),
    admin.from('selections')
      .select('photo_id, status')
      .eq('portfolio_id', id),
  ])

  return Response.json({ sessions: sessions || [], selections: selections || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await params
  const updates = await req.json()

  const admin = createAdminClient()

  const { data: photographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', user.email!)
    .maybeSingle()

  if (!photographer) return Response.json({ error: 'לא נמצאת' }, { status: 403 })

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('photographer_id')
    .eq('id', id)
    .maybeSingle()

  if (!portfolio || portfolio.photographer_id !== photographer.id) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const allowed: Record<string, unknown> = {}
  if ('cover_url' in updates) allowed.cover_url = updates.cover_url
  if ('instructions' in updates) allowed.instructions = updates.instructions
  if ('is_done' in updates) allowed.is_done = updates.is_done
  if ('client_password' in updates) allowed.client_password = updates.client_password || null

  if ('quota' in updates) {
    const { count } = await admin
      .from('selections')
      .select('*', { count: 'exact', head: true })
      .eq('portfolio_id', id)
    if ((count ?? 0) > 0) {
      return Response.json({ error: 'לא ניתן לשנות מכסה לאחר שהלקוחה כבר בחרה תמונות' }, { status: 400 })
    }
    const q = Number(updates.quota)
    if (!Number.isInteger(q) || q < 1 || q > 999) {
      return Response.json({ error: 'מכסה לא תקינה' }, { status: 400 })
    }
    allowed.quota = q
  }

  const { error } = await admin.from('portfolios').update(allowed).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
