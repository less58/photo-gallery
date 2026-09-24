import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

const CATEGORIES = ['shoot', 'delivery', 'meeting', 'personal', 'other']

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === '42P01') {
    return 'טבלת היומן עדיין לא נוצרה ב-Supabase — צריך להריץ את הקובץ supabase-calendar-migration.sql ב-SQL editor של Supabase.'
  }
  return error.message
}

async function requirePhotographerId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: photographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', user.email!)
    .maybeSingle()

  return photographer?.id ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const photographerId = await requirePhotographerId()
  if (!photographerId) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed: Record<string, unknown> = {}
  if ('eventDate' in body) allowed.event_date = String(body.eventDate)
  if ('eventTime' in body) allowed.event_time = body.eventTime ? String(body.eventTime) : null
  if ('title' in body) {
    const t = String(body.title).trim()
    if (!t) return Response.json({ error: 'כותרת לא יכולה להיות ריקה' }, { status: 400 })
    allowed.title = t
  }
  if ('notes' in body) allowed.notes = body.notes ? String(body.notes).trim() || null : null
  if ('category' in body) allowed.category = CATEGORIES.includes(body.category) ? body.category : 'other'
  allowed.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('calendar_events')
    .update(allowed)
    .eq('id', id)
    .eq('photographer_id', photographerId)
    .select()
    .maybeSingle()

  if (error) return Response.json({ error: friendlyDbError(error) }, { status: 500 })
  if (!data) return Response.json({ error: 'אירוע לא נמצא' }, { status: 404 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const photographerId = await requirePhotographerId()
  if (!photographerId) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('photographer_id', photographerId)

  if (error) return Response.json({ error: friendlyDbError(error) }, { status: 500 })
  return Response.json({ ok: true })
}
