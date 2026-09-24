import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

const CATEGORIES = ['shoot', 'delivery', 'meeting', 'personal', 'other']

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === '42P01') {
    return 'טבלת היומן עדיין לא נוצרה ב-Supabase — צריך להריץ את הקובץ supabase-calendar-migration.sql ב-SQL editor של Supabase לפני שאפשר להוסיף אירועים.'
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

export async function GET(req: NextRequest) {
  const photographerId = await requirePhotographerId()
  if (!photographerId) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return Response.json({ error: 'חסר טווח תאריכים' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('calendar_events')
    .select('*')
    .eq('photographer_id', photographerId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date')
    .order('event_time', { nullsFirst: false })

  if (error) return Response.json({ error: friendlyDbError(error) }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const photographerId = await requirePhotographerId()
  if (!photographerId) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const body = await req.json()
  const eventDate = String(body.eventDate || '')
  const title = String(body.title || '').trim()
  const category = CATEGORIES.includes(body.category) ? body.category : 'other'
  const eventTime = body.eventTime ? String(body.eventTime) : null
  const notes = body.notes ? String(body.notes).trim() || null : null

  if (!eventDate || !title) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('calendar_events')
    .insert({ photographer_id: photographerId, event_date: eventDate, event_time: eventTime, title, notes, category })
    .select()
    .single()

  if (error) return Response.json({ error: friendlyDbError(error) }, { status: 500 })
  return Response.json(data)
}
