import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
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

  const { data: snapshot } = await admin
    .from('selection_snapshots')
    .select('*')
    .eq('id', id)
    .eq('photographer_id', photographer.id)
    .maybeSingle()
  if (!snapshot) return Response.json({ error: 'לא נמצא' }, { status: 404 })

  // Mark as downloaded
  await admin
    .from('selection_snapshots')
    .update({ downloaded_at: new Date().toISOString() })
    .eq('id', id)

  type SelectionItem = { name: string; status: string }
  const items = (snapshot.selections_json as SelectionItem[]) || []
  const statusLabel = (s: string) => s === 'approved' ? 'מאושרת' : s === 'maybe' ? 'ממתינה' : 'נדחתה'
  const rows = items.map((item, i) => `${i + 1},"${item.name}",${statusLabel(item.status)}`)
  const csv = '﻿' + ['מספר,שם תמונה,סטטוס', ...rows].join('\n')

  const filename = `${snapshot.portfolio_title}_בחירות.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
