import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import { sendConfiguredEmail } from '@/lib/mail'

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/account-request/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { status, sendEmail, emailTo, emailSubject, emailBody } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin
    .from('account_requests')
    .update({ status: status || 'approved' })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let emailSent = false
  let emailError: string | null = null

  if (sendEmail && emailTo && emailSubject && emailBody) {
    const { data: adminSettings } = await admin
      .from('photographers')
      .select('*')
      .eq('email', SUPER_ADMIN_EMAIL)
      .maybeSingle()

    if (adminSettings) {
      try {
        const escaped = emailBody
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const paragraphs = escaped.split('\n').map((line: string) =>
          `<p style="margin:4px 0">${line || '&nbsp;'}</p>`
        ).join('')
        const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.7">${paragraphs}</div>`
        emailSent = await sendConfiguredEmail(
          adminSettings as Record<string, unknown>,
          emailTo,
          emailSubject,
          html,
          emailBody
        )
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'שגיאה לא ידועה'
      }
    } else {
      emailError = 'הגדרות מייל לא נמצאו'
    }
  }

  return Response.json({ ok: true, emailSent, emailError })
}
