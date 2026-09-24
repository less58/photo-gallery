import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendConfiguredEmail } from '@/lib/mail'
import { hebrewFullLabel } from '@/lib/hebrewDate'

const DEFAULT_TIME = '09:00'

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Bound the query to a sensible window instead of scanning the whole table.
  // Reminders go up to a month before the event, so the window must reach that far.
  const from = toISODate(new Date(now.getTime() - 24 * 3600 * 1000))
  const to = toISODate(new Date(now.getTime() + 32 * 24 * 3600 * 1000))

  const { data: candidates, error } = await admin
    .from('calendar_events')
    .select('*')
    .not('reminder_minutes_before', 'is', null)
    .eq('reminder_sent', false)
    .gte('event_date', from)
    .lte('event_date', to)

  if (error) {
    console.error('Calendar reminders cron: query error', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!candidates?.length) return Response.json({ ok: true, sent: 0 })

  const due = candidates.filter(ev => {
    const eventDateTime = new Date(`${ev.event_date}T${ev.event_time || DEFAULT_TIME}:00`)
    const triggerAt = new Date(eventDateTime.getTime() - ev.reminder_minutes_before * 60 * 1000)
    return triggerAt <= now
  })
  if (!due.length) return Response.json({ ok: true, sent: 0 })

  const photographerIds = [...new Set(due.map(ev => ev.photographer_id))]
  const { data: photographers } = await admin
    .from('photographers')
    .select('*')
    .in('id', photographerIds)
  const photographerById = new Map((photographers || []).map(p => [p.id, p]))

  let sent = 0
  for (const ev of due) {
    const ph = photographerById.get(ev.photographer_id)
    if (!ph?.email) {
      await admin.from('calendar_events').update({ reminder_sent: true }).eq('id', ev.id)
      continue
    }

    const eventDate = new Date(`${ev.event_date}T00:00:00`)
    const gregorianLabel = eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const timeLabel = ev.event_time ? ` בשעה ${ev.event_time}` : ''
    const subject = `תזכורת: ${ev.title}`
    const text = `תזכורת ליומן שלך\n\n${ev.title}\n${gregorianLabel}${timeLabel}\n${hebrewFullLabel(eventDate)}${ev.notes ? `\n\n${ev.notes}` : ''}`
    const html = `
      <div dir="rtl" style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px;">
        <h2 style="color: ${String(ph.brand_color || '#C97B73')}">תזכורת ליומן שלך</h2>
        <p style="font-size: 16px; font-weight: 600;">${ev.title}</p>
        <p style="color: #57534e;">${gregorianLabel}${timeLabel}</p>
        <p style="color: #a8a29e; font-size: 13px;">${hebrewFullLabel(eventDate)}</p>
        ${ev.notes ? `<p style="margin-top: 16px; white-space: pre-wrap;">${ev.notes}</p>` : ''}
      </div>
    `

    try {
      await sendConfiguredEmail(ph, ph.email, subject, html, text)
      sent++
    } catch (e) {
      console.error('Calendar reminders cron: send error for event', ev.id, e)
    }
    await admin.from('calendar_events').update({ reminder_sent: true }).eq('id', ev.id)
  }

  return Response.json({ ok: true, sent, checked: due.length })
}
