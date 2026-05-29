import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { buildEmailHtml, buildEmailText } from '@/lib/emailTemplate'
import type { Photo } from '@/lib/types'

async function sendEmail(
  ph: Record<string, unknown>,
  to: string,
  subject: string,
  html: string,
  text: string
) {
  const provider = (ph.email_provider as string) || 'gmail'
  const displayName = String(ph.sender_display_name || ph.name || 'select it')

  if (provider === 'gmail' && ph.gmail_address && ph.gmail_app_password) {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: ph.gmail_address as string, pass: ph.gmail_app_password as string },
    })
    await transporter.sendMail({ from: `"${displayName}" <${ph.gmail_address as string}>`, to, subject, html, text })
    return true
  }

  if (provider === 'resend' && ph.resend_api_key) {
    const { Resend } = await import('resend')
    const resend = new Resend(ph.resend_api_key as string)
    const rawSender = (ph.sender_email as string) || ''
    const isFreeEmail = /gmail\.|hotmail\.|yahoo\.|outlook\.|walla\./i.test(rawSender)
    const address = !rawSender || isFreeEmail ? 'onboarding@resend.dev' : rawSender
    const { error } = await resend.emails.send({
      from: `"${displayName}" <${address}>`,
      to, subject, html, text,
    })
    if (error) throw new Error(error.message)
    return true
  }

  return false
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('portfolio_session')?.value
  if (!raw) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  let session: { portfolioId: string; email: string } | null = null
  try { session = JSON.parse(raw) } catch { return Response.json({ error: 'שגיאה' }, { status: 401 }) }
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('*, photographer:photographers(*)')
    .eq('id', session.portfolioId)
    .maybeSingle()

  if (!portfolio) return Response.json({ error: 'תיק לא נמצא' }, { status: 404 })

  const { data: selections } = await admin
    .from('selections')
    .select('photo_id, status')
    .eq('portfolio_id', session.portfolioId)

  const { data: rawSessions } = await admin
    .from('sessions')
    .select('*, photos(*)')
    .eq('portfolio_id', session.portfolioId)

  const allPhotos: Photo[] = (rawSessions || []).flatMap(s => (s.photos as Photo[]) || [])
  const approved = (selections || [])
    .filter(s => s.status === 'approved')
    .map(s => allPhotos.find(p => p.id === s.photo_id))
    .filter((p): p is Photo => !!p)

  const ph = (portfolio.photographer ?? {}) as Record<string, unknown>
  const photographerEmail = String(ph.email || '')

  const photoLines = approved.map((p, i) => `${i + 1}. ${p.name || p.id}`).join('\n')
  const subject = `בחירת תמונות — ${portfolio.title}`
  const bodyText = `שלום,\n\nהלקוחה ${session.email} סיימה לבחור תמונות מהתיק "${portfolio.title}".\n\nנבחרו ${approved.length} תמונות מתוך ${portfolio.quota}:\n\n${photoLines}\n\nבברכה,\nמערכת select it`

  const bodyHtml = `
    <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: ${String(ph.brand_color || '#C97B73')}">בחירת תמונות — ${portfolio.title}</h2>
      <p>הלקוחה <strong>${session.email}</strong> סיימה לבחור תמונות.</p>
      <p>נבחרו <strong>${approved.length}</strong> תמונות מתוך ${portfolio.quota}:</p>
      <ol style="line-height: 2">
        ${approved.map(p => `<li>${p.name || p.id}</li>`).join('')}
      </ol>
    </div>
  `

  let emailSent = false
  if (photographerEmail) {
    try {
      emailSent = await sendEmail(ph, photographerEmail, subject, bodyHtml, bodyText)
    } catch (e) {
      console.error('Report email error:', e)
    }
  }

  return Response.json({ ok: true, emailSent, count: approved.length })
}
