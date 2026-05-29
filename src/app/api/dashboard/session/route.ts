import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { portfolioId, name, description } = await req.json()
  if (!portfolioId || !name) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('sessions')
    .select('sort_order')
    .eq('portfolio_id', portfolioId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('sessions')
    .insert({ portfolio_id: portfolioId, name, description: description || null, sort_order: (existing?.sort_order ?? -1) + 1 })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
