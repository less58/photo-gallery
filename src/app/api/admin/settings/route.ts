import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  const update = {
    name: 'SELECT IT',
    brand_color: '#D4736A',
    send_client_emails: Boolean(body.sendClientEmails),
    email_provider: body.emailProvider || 'gmail',
    sender_display_name: body.senderDisplayName || 'SELECT IT',
    gmail_address: body.gmailAddress || null,
    gmail_app_password: body.gmailAppPassword || null,
    resend_api_key: body.resendApiKey || null,
    sender_email: body.senderEmail || null,
  }

  const { data: existing } = await admin
    .from('photographers')
    .select('id')
    .eq('email', SUPER_ADMIN_EMAIL)
    .maybeSingle()

  const { error } = existing
    ? await admin.from('photographers').update(update).eq('email', SUPER_ADMIN_EMAIL)
    : await admin.from('photographers').insert({ ...update, email: SUPER_ADMIN_EMAIL })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
