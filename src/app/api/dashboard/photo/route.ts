import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { sessionId, url, thumbnailUrl, name } = await req.json()
  if (!sessionId || !url) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('photos')
    .select('sort_order')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (existing?.sort_order ?? -1) + 1

  // Try with name column first, fall back without if column doesn't exist
  let { data, error } = await admin
    .from('photos')
    .insert({ session_id: sessionId, url, thumbnail_url: thumbnailUrl || null, name: name || null, sort_order: sortOrder })
    .select()
    .single()

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    // name column doesn't exist yet — insert without it
    ;({ data, error } = await admin
      .from('photos')
      .insert({ session_id: sessionId, url, thumbnail_url: thumbnailUrl || null, sort_order: sortOrder })
      .select()
      .single())
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
