import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import { sendConfiguredEmail } from '@/lib/mail'

async function findAuthUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) return null
    const user = data.users.find(u => u.email?.toLowerCase() === email)
    if (user) return user.id
    if (data.users.length < 100) return null
  }
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return Response.json({ error: 'חסרים פרטים' }, { status: 400 })
  }

  const admin = createAdminClient()

  const normalizedEmail = email.toLowerCase().trim()

  const { data: existingPhotographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingPhotographer) {
    return Response.json({ error: 'כבר קיימת צלמת עם המייל הזה' }, { status: 409 })
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  })

  const userAlreadyExists =
    authErr?.message?.toLowerCase().includes('already') ||
    authErr?.message?.toLowerCase().includes('registered') ||
    authErr?.status === 422

  if (userAlreadyExists) {
    const existingUserId = await findAuthUserIdByEmail(admin, normalizedEmail)
    if (existingUserId) {
      const { error: updateAuthErr } = await admin.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      })
      if (updateAuthErr) {
        return Response.json({ error: updateAuthErr.message }, { status: 500 })
      }
    }
  }

  if (authErr && !userAlreadyExists) {
    return Response.json({ error: authErr.message }, { status: 500 })
  }

  const { data: photographer, error: phErr } = await supabase
    .from('photographers')
    .insert({ email: normalizedEmail, name, brand_color: '#D4736A' })
    .select()
    .single()

  if (phErr) {
    if (authUser?.user?.id) await admin.auth.admin.deleteUser(authUser.user.id)
    return Response.json({ error: phErr.message }, { status: 500 })
  }

  let emailSent = false
  const { data: adminSettings } = await admin
    .from('photographers')
    .select('*')
    .eq('email', SUPER_ADMIN_EMAIL)
    .maybeSingle()

  if (adminSettings?.send_client_emails) {
    try {
      const siteUrl = req.nextUrl.origin
      const html = `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.7">
          <h2>נוצר עבורך חשבון ב-SELECT IT</h2>
          <p>שלום ${name},</p>
          <p>מנהל המערכת פתח עבורך חשבון.</p>
          <p><strong>מייל:</strong> <span dir="ltr">${normalizedEmail}</span></p>
          <p><strong>סיסמה:</strong> <span dir="ltr">${password}</span></p>
          <p style="text-align:center;margin:28px 0">
            <a href="${siteUrl}/auth/login" style="display:inline-block;background:#D4736A;color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold">
              כניסה למערכת
            </a>
          </p>
        </div>
      `
      const text = `נוצר עבורך חשבון ב-SELECT IT\n\nמייל: ${normalizedEmail}\nסיסמה: ${password}\nכניסה: ${siteUrl}/auth/login`
      emailSent = await sendConfiguredEmail(
        adminSettings as Record<string, unknown>,
        normalizedEmail,
        'נוצר עבורך חשבון ב-SELECT IT',
        html,
        text
      )
    } catch (e) {
      console.error('Photographer welcome email failed:', e)
    }
  }

  return Response.json({
    ...photographer,
    reusedExistingAuthUser: userAlreadyExists,
    emailSent,
  })
}
