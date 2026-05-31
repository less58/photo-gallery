import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { buildEmailHtml, buildEmailText } from '@/lib/emailTemplate'
import { sendConfiguredEmail } from '@/lib/mail'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { portfolioId } = await req.json()
  if (!portfolioId) return Response.json({ error: 'חסר מזהה תיק' }, { status: 400 })

  const admin = createAdminClient()

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('id, title, client_email, magic_token, photographer:photographers(*)')
    .eq('id', portfolioId)
    .single()

  if (!portfolio) return Response.json({ error: 'תיק לא נמצא' }, { status: 404 })

  const ph = portfolio.photographer as unknown as Record<string, unknown>

  if (String(ph.email) !== user.email) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  if (!ph.send_client_emails) {
    return Response.json({ error: 'שליחת מיילים אינה מופעלת בהגדרות' }, { status: 400 })
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
    const magicLink = `${siteUrl}/enter/${portfolio.magic_token}`
    const subject = ((ph.email_subject as string) || 'התמונות שלך מוכנות לבחירה 📷')
      .replace('{portfolio_name}', portfolio.title)

    const emailData = {
      photographerName: String(ph.name || ''),
      clientEmail: portfolio.client_email,
      portfolioTitle: portfolio.title,
      magicLink,
      siteUrl,
      bodyTemplate: (ph.email_body as string) || '',
      logoUrl: (ph.logo_url as string) || null,
      brandColor: (ph.brand_color as string) || '#C97B73',
    }

    const html = buildEmailHtml(emailData)
    const text = buildEmailText(emailData)

    await sendConfiguredEmail(ph, portfolio.client_email, subject, html, text)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('Send email error:', e)
    return Response.json({ error: 'שגיאה בשליחת המייל' }, { status: 500 })
  }
}
