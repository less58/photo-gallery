import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  // Build full update object
  const update: Record<string, unknown> = {}
  if (body.name !== undefined)               update.name = body.name
  if (body.brandColor !== undefined)         update.brand_color = body.brandColor
  if (body.logoUrl !== undefined)            update.logo_url = body.logoUrl
  if (body.logoPublicId !== undefined)       update.logo_public_id = body.logoPublicId
  if (body.watermarkUrl !== undefined)       update.watermark_url = body.watermarkUrl
  if (body.watermarkPublicId !== undefined)  update.watermark_public_id = body.watermarkPublicId
  if (body.defaultInstructions !== undefined) update.default_instructions = body.defaultInstructions
  if (body.sendClientEmails !== undefined)   update.send_client_emails = body.sendClientEmails
  if (body.senderEmail !== undefined)        update.sender_email = body.senderEmail
  if (body.resendApiKey !== undefined)       update.resend_api_key = body.resendApiKey
  if (body.emailSubject !== undefined)       update.email_subject = body.emailSubject
  if (body.emailBody !== undefined)          update.email_body = body.emailBody
  if (body.emailProvider !== undefined)        update.email_provider = body.emailProvider
  if (body.gmailAddress !== undefined)         update.gmail_address = body.gmailAddress
  if (body.gmailAppPassword !== undefined)     update.gmail_app_password = body.gmailAppPassword
  if (body.senderDisplayName !== undefined)    update.sender_display_name = body.senderDisplayName

  const { error } = await admin.from('photographers').update(update).eq('email', user.email!)

  if (error) {
    // If optional columns don't exist, retry without them
    if (error.code === '42703' || error.message?.includes('column')) {
      const withoutOptional = { ...update }
      delete withoutOptional.email_subject
      delete withoutOptional.email_body
      const { error: e2 } = await admin.from('photographers').update(withoutOptional).eq('email', user.email!)
      if (e2) return Response.json({ error: e2.message }, { status: 500 })
      return Response.json({ ok: true, warning: 'הרץ SQL להוסיף email_subject/email_body' })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
