import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ph } = await admin
    .from('photographers')
    .select('id')
    .eq('email', session.user.email!)
    .maybeSingle()

  if (!ph) return Response.json({ templates: [] })

  const { data } = await admin
    .from('collage_templates')
    .select('*')
    .eq('photographer_id', ph.id)
    .order('created_at', { ascending: false })

  return Response.json({ templates: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ph } = await admin
    .from('photographers')
    .select('id')
    .eq('email', session.user.email!)
    .maybeSingle()

  if (!ph) return Response.json({ error: 'צלמת לא נמצאה' }, { status: 404 })

  const { name, cells } = await req.json()
  if (!name || !cells) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const { data, error } = await admin
    .from('collage_templates')
    .insert({ photographer_id: ph.id, name, cells })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
