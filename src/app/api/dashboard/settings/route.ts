import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

// Columns that might not exist yet — try removing them one by one on error
const OPTIONAL_COLUMNS = [
  'watermark_public_id', 'watermark_url',
  'watermark_type', 'watermark_text', 'watermark_opacity',
  'watermark_position', 'watermark_font_size', 'watermark_color',
  'watermark_x', 'watermark_y', 'watermark_rotation', 'watermark_image_opacity',
  'logo_public_id',
  'email_subject', 'email_body', 'email_provider',
  'gmail_address', 'gmail_app_password',
  'resend_api_key', 'sender_email', 'sender_display_name',
  'default_instructions', 'send_client_emails',
  'receive_selection_emails',
  'enable_collages',
]

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })
  const email = session.user.email!

  const body = await req.json()
  const admin = createAdminClient()

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)               update.name = body.name
  if (body.brandColor !== undefined)         update.brand_color = body.brandColor
  if (body.logoUrl !== undefined)            update.logo_url = body.logoUrl
  if (body.logoPublicId !== undefined)       update.logo_public_id = body.logoPublicId
  if (body.watermarkUrl !== undefined)       update.watermark_url = body.watermarkUrl
  if (body.watermarkPublicId !== undefined)  update.watermark_public_id = body.watermarkPublicId
  if (body.watermarkType !== undefined)         update.watermark_type = body.watermarkType
  if (body.watermarkText !== undefined)         update.watermark_text = body.watermarkText
  if (body.watermarkOpacity !== undefined)      update.watermark_opacity = body.watermarkOpacity
  if (body.watermarkPosition !== undefined)     update.watermark_position = body.watermarkPosition
  if (body.watermarkFontSize !== undefined)     update.watermark_font_size = body.watermarkFontSize
  if (body.watermarkColor !== undefined)        update.watermark_color = body.watermarkColor
  if (body.watermarkX !== undefined)            update.watermark_x = body.watermarkX
  if (body.watermarkY !== undefined)            update.watermark_y = body.watermarkY
  if (body.watermarkRotation !== undefined)     update.watermark_rotation = body.watermarkRotation
  if (body.watermarkImageOpacity !== undefined) update.watermark_image_opacity = body.watermarkImageOpacity
  if (body.defaultInstructions !== undefined) update.default_instructions = body.defaultInstructions
  if (body.sendClientEmails !== undefined)   update.send_client_emails = body.sendClientEmails
  if (body.senderEmail !== undefined)        update.sender_email = body.senderEmail
  if (body.resendApiKey !== undefined)       update.resend_api_key = body.resendApiKey
  if (body.emailSubject !== undefined)       update.email_subject = body.emailSubject
  if (body.emailBody !== undefined)          update.email_body = body.emailBody
  if (body.emailProvider !== undefined)      update.email_provider = body.emailProvider
  if (body.gmailAddress !== undefined)       update.gmail_address = body.gmailAddress
  if (body.gmailAppPassword !== undefined)   update.gmail_app_password = body.gmailAppPassword
  if (body.senderDisplayName !== undefined)       update.sender_display_name = body.senderDisplayName
  if (body.receiveSelectionEmails !== undefined)  update.receive_selection_emails = body.receiveSelectionEmails
  if (body.enableCollages !== undefined)          update.enable_collages = body.enableCollages

  // Try the full update; if a column is missing, remove it and retry
  let current = { ...update }
  const missing: string[] = []

  for (let attempt = 0; attempt <= OPTIONAL_COLUMNS.length; attempt++) {
    const { error } = await admin.from('photographers').update(current).eq('email', email)
    if (!error) {
      if (missing.length > 0) {
        return Response.json({ ok: true, missingColumns: missing })
      }
      return Response.json({ ok: true })
    }

    const isColumnError = error.code === '42703' || error.message?.toLowerCase().includes('column')
    if (!isColumnError) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Find which column is missing from the error message
    const found = OPTIONAL_COLUMNS.find(col => error.message.includes(col) && current[col] !== undefined)
    if (found) {
      missing.push(found)
      delete current[found]
    } else {
      // Can't identify which column — remove all optional ones that are in the update
      for (const col of OPTIONAL_COLUMNS) delete current[col]
      const { error: e2 } = await admin.from('photographers').update(current).eq('email', email)
      if (e2) return Response.json({ error: e2.message }, { status: 500 })
      return Response.json({ ok: true, missingColumns: OPTIONAL_COLUMNS })
    }
  }

  return Response.json({ error: 'לא ניתן לשמור' }, { status: 500 })
}
