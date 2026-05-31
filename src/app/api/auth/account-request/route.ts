import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import { sendConfiguredEmail } from '@/lib/mail'

export async function POST(req: NextRequest) {
  const { email, name, details } = await req.json()

  if (!email || !name) {
    return Response.json({ error: 'חסרים מייל או שם' }, { status: 400 })
  }

  const admin = createAdminClient()
  const normalizedEmail = String(email).trim().toLowerCase()

  const { data: existingPhotographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingPhotographer) {
    return Response.json({ error: 'כבר קיים חשבון צלמת למייל הזה' }, { status: 409 })
  }

  const { error: requestError } = await admin
    .from('account_requests')
    .upsert({
      email: normalizedEmail,
      name,
      details: details || null,
      status: 'pending',
    }, { onConflict: 'email' })

  if (requestError) {
    console.error('Account request save failed:', requestError)
    return Response.json({ error: 'שמירת הבקשה נכשלה. ודאי שטבלת account_requests קיימת.' }, { status: 500 })
  }

  const { data: settings } = await admin
    .from('photographers')
    .select('*')
    .eq('email', SUPER_ADMIN_EMAIL)
    .maybeSingle()

  const sender = (settings ?? {
    name: 'SELECT IT',
    email_provider: 'gmail',
    gmail_address: null,
    gmail_app_password: null,
  }) as Record<string, unknown>

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.7">
      <h2>בקשה לפתיחת חשבון ב-SELECT IT</h2>
      <p><strong>שם:</strong> ${name}</p>
      <p><strong>מייל:</strong> <span dir="ltr">${normalizedEmail}</span></p>
      <p><strong>פרטים:</strong></p>
      <p>${details || 'לא נמסרו פרטים נוספים'}</p>
    </div>
  `
  const text = `בקשה לפתיחת חשבון ב-SELECT IT\n\nשם: ${name}\nמייל: ${normalizedEmail}\nפרטים:\n${details || 'לא נמסרו פרטים נוספים'}`

  try {
    const sent = await sendConfiguredEmail(
      sender,
      SUPER_ADMIN_EMAIL,
      `בקשה לפתיחת חשבון - ${name}`,
      html,
      text
    )

    if (!sent) {
      return Response.json({ error: 'לא הוגדר מייל שליחה למנהל העל' }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Account request email failed:', err)
    return Response.json({ error: 'שליחת הבקשה נכשלה' }, { status: 500 })
  }
}
