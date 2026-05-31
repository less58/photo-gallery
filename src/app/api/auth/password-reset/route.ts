import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import { sendConfiguredEmail } from '@/lib/mail'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return Response.json({ error: 'חסר מייל' }, { status: 400 })

  const normalizedEmail = String(email).trim().toLowerCase()
  const admin = createAdminClient()

  const { data: photographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (!photographer) {
    return Response.json({ error: 'המייל לא רשום במערכת' }, { status: 404 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
  const redirectTo = `${siteUrl}/auth/callback?next=/auth/reset-password`

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: { redirectTo },
  })

  if (linkError || !linkData.properties?.action_link) {
    console.error('Password reset link error:', linkError)
    return Response.json({ error: 'לא ניתן ליצור קישור איפוס' }, { status: 500 })
  }

  const { data: settings } = await admin
    .from('photographers')
    .select('*')
    .eq('email', SUPER_ADMIN_EMAIL)
    .maybeSingle()

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.7">
      <h2>איפוס סיסמה ל-SELECT IT</h2>
      <p>לחצי על הכפתור כדי לקבוע סיסמה חדשה.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${linkData.properties.action_link}" style="display:inline-block;background:#D4736A;color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold">
          איפוס סיסמה
        </a>
      </p>
      <p style="font-size:12px;color:#78716c">אם לא ביקשת איפוס סיסמה, אפשר להתעלם מהמייל.</p>
    </div>
  `
  const text = `איפוס סיסמה ל-SELECT IT\n\nלחצי על הקישור כדי לקבוע סיסמה חדשה:\n${linkData.properties.action_link}`

  try {
    const sent = await sendConfiguredEmail(
      (settings ?? { name: 'SELECT IT' }) as Record<string, unknown>,
      normalizedEmail,
      'איפוס סיסמה ל-SELECT IT',
      html,
      text
    )
    if (!sent) return Response.json({ error: 'לא הוגדר מייל שליחה למנהל העל' }, { status: 500 })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('Password reset email failed:', err)
    return Response.json({ error: 'שליחת מייל האיפוס נכשלה' }, { status: 500 })
  }
}
