import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const INACTIVE_MSG = '⚠️ לקוחה ניסתה להיכנס לגלריה אך קוד הגישה לא הוגדר עדיין'

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const admin = createAdminClient()

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('id, client_password')
    .eq('id', id)
    .single()

  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (portfolio.client_password) return NextResponse.json({ skipped: true })

  // Deduplicate: skip if same notification sent in last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await admin
    .from('portfolio_notes')
    .select('id')
    .eq('portfolio_id', id)
    .eq('message', INACTIVE_MSG)
    .gte('created_at', twoHoursAgo)
    .limit(1)

  if (recent && recent.length > 0) return NextResponse.json({ skipped: true })

  const { error } = await admin
    .from('portfolio_notes')
    .insert({ portfolio_id: id, sender: 'client', message: INACTIVE_MSG, read_by_client: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
