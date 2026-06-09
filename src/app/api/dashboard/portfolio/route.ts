import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { buildEmailHtml, buildEmailText } from '@/lib/emailTemplate'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

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

  const { clientEmail, title, instructions, quota, coverUrl, clientPassword } = await req.json()
  if (!clientEmail || !title) {
    return Response.json({ error: 'חסרים פרטים' }, { status: 400 })
  }
  if (!clientPassword?.trim()) {
    return Response.json({ error: 'יש להגדיר קוד גישה ללקוחה' }, { status: 400 })
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

  // password_hash kept for DB constraint only — auth is via magic_token
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 4)

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
      client_password: clientPassword.trim(),
    })
    .select('id').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ id: portfolio.id, emailSent: false })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const body = await req.json()
  const { id, includeReport = false } = body as { id: string; includeReport?: boolean }
  const admin = createAdminClient()

  // Verify portfolio belongs to this photographer
  const { data: portfolio } = await admin
    .from('portfolios')
    .select('id, title, client_email, photographer:photographers(id)')
    .eq('id', id)
    .maybeSingle()
  if (!portfolio) return Response.json({ error: 'תיק לא נמצא' }, { status: 404 })
  const ph = portfolio.photographer as unknown as { id: string }

  // Get sessions + photos for Cloudinary cleanup
  const { data: sessions } = await admin
    .from('sessions')
    .select('id, photos(id, url, name)')
    .eq('portfolio_id', id)

  const allPhotos = (sessions || []).flatMap(s => (s.photos as { id: string; url: string; name?: string }[]) || [])

  // Get selections for snapshot
  const { data: selections } = await admin
    .from('selections')
    .select('photo_id, status')
    .eq('portfolio_id', id)

  let csv: string | null = null

  if (selections && selections.length > 0) {
    const snapshotItems = selections.map(sel => {
      const photo = allPhotos.find(p => p.id === sel.photo_id)
      return { id: sel.photo_id, name: photo?.name || sel.photo_id, status: sel.status }
    })
    const approvedCount = selections.filter(s => s.status === 'approved').length

    await admin.from('selection_snapshots').insert({
      photographer_id: ph.id,
      portfolio_id: id,
      portfolio_title: portfolio.title,
      client_email: portfolio.client_email,
      approved_count: approvedCount,
      selections_json: snapshotItems,
    })

    if (includeReport) {
      const statusLabel = (s: string) => s === 'approved' ? 'מאושרת' : s === 'maybe' ? 'ממתינה' : 'נדחתה'
      const rows = snapshotItems.map((item, i) => `${i + 1},"${item.name}",${statusLabel(item.status)}`)
      csv = ['מספר,שם תמונה,סטטוס', ...rows].join('\n')
    }
  }

  // Delete from Cloudinary
  const publicIds = allPhotos
    .map(p => { const m = p.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/); return m ? m[1] : null })
    .filter(Boolean) as string[]
  for (let i = 0; i < publicIds.length; i += 100) {
    try { await cloudinary.api.delete_resources(publicIds.slice(i, i + 100)) } catch { /* ignore */ }
  }

  const { error } = await admin.from('portfolios').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    ok: true,
    ...(csv ? { csv, filename: `${portfolio.title}_בחירות.csv` } : {}),
  })
}
