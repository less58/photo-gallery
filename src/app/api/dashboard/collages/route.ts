import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const portfolioId = req.nextUrl.searchParams.get('portfolioId')
  if (!portfolioId) return Response.json({ error: 'חסר portfolioId' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('collages')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ collages: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const body = await req.json()
  const { portfolioId, name, cells, border_enabled, border_color, border_width } = body
  if (!portfolioId) return Response.json({ error: 'חסר portfolioId' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('collages')
    .insert({
      portfolio_id: portfolioId,
      name: name || 'קולאג׳',
      cells: cells || [],
      border_enabled: border_enabled ?? false,
      border_color: border_color || '#ffffff',
      border_width: border_width ?? 4,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
