import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { buildEmailHtml, buildEmailText } from '@/lib/emailTemplate'

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
    await transporter.sendMail({
      from: `"${displayName}" <${ph.gmail_address as string}>`,
      to, subject, html, text,
    })
    return true
  }

  if (provider === 'resend' && ph.resend_api_key) {
    const { Resend } = await import('resend')
    const resend = new Resend(ph.resend_api_key as string)
    const rawSender = (ph.sender_email as string) || ''
    const isFreeEmail = /gmail\.|hotmail\.|yahoo\.|outlook\.|walla\./i.test(rawSender)
    const address = !rawSender || isFreeEmail ? 'onboarding@resend.dev' : rawSender
    const from = `"${displayName}" <${address}>`
    const { error } = await resend.emails.send({ from, to, subject, html, text })
    if (error) throw new Error(error.message)
    return true
  }

  return false
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { clientEmail, title, instructions, quota, coverUrl } = await req.json()
  if (!clientEmail || !title) {
    return Response.json({ error: 'חסרים פרטים' }, { status: 400 })
  }

  const admin = createAdminClient()

  let { data: photographer } = await admin
    .from('photographers').select('*').eq('email', user.email!).maybeSingle()

  if (!photographer) {
    const { data: newPh, error: phErr } = await admin
      .from('photographers')
      .insert({ email: user.email!, name: user.email!.split('@')[0], brand_color: '#C97B73' })
      .select('*').single()
    if (phErr) return Response.json({ error: phErr.message }, { status: 500 })
    photographer = newPh
  }

  const ph = photographer as Record<string, unknown>
  const magicToken = crypto.randomUUID()

  // Keep password_hash for DB constraint — not used for auth anymore
  const internalPassword = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(internalPassword, 10)

  const { data: portfolio, error } = await admin
    .from('portfolios')
    .insert({
      photographer_id: ph.id,
      client_email: clientEmail.toLowerCase().trim(),
      title,
      instructions: instructions || null,
      quota: quota || 30,
      password_hash: passwordHash,
      magic_token: magicToken,
      cover_url: coverUrl || null,
    })
    .select('id').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let emailSent = false
  if (ph.send_client_emails) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
      const magicLink = `${siteUrl}/enter/${magicToken}`
      const subject = ((ph.email_subject as string) || 'התמונות שלך מוכנות לבחירה 📷')
        .replace('{portfolio_name}', title)

      const emailData = {
        photographerName: String(ph.name || ''),
        clientEmail: clientEmail.toLowerCase().trim(),
        portfolioTitle: title,
        magicLink,
        siteUrl,
        bodyTemplate: (ph.email_body as string) || '',
        logoUrl: (ph.logo_url as string) || null,
        brandColor: (ph.brand_color as string) || '#C97B73',
      }

      const html = buildEmailHtml(emailData)
      const text = buildEmailText(emailData)

      emailSent = await sendEmail(ph, clientEmail.toLowerCase().trim(), subject, html, text)
    } catch (e) {
      console.error('Email error:', e)
    }
  }

  return Response.json({ id: portfolio.id, emailSent })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin.from('portfolios').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
