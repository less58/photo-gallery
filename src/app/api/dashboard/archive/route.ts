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

  const { data: snapshots } = await admin
    .from('selection_snapshots')
    .select('id, portfolio_title, client_email, approved_count, created_at, downloaded_at')
    .eq('photographer_id', photographer.id)
    .order('created_at', { ascending: false })

  return Response.json(snapshots || [])
}
