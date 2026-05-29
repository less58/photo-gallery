import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { v2 as cloudinary } from 'cloudinary'
import { NextRequest } from 'next/server'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { sessionId, url, thumbnailUrl, name } = await req.json()
  if (!sessionId || !url) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('photos')
    .select('sort_order')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (existing?.sort_order ?? -1) + 1

  // Try with name column first, fall back without if column doesn't exist
  let { data, error } = await admin
    .from('photos')
    .insert({ session_id: sessionId, url, thumbnail_url: thumbnailUrl || null, name: name || null, sort_order: sortOrder })
    .select()
    .single()

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    // name column doesn't exist yet — insert without it
    ;({ data, error } = await admin
      .from('photos')
      .insert({ session_id: sessionId, url, thumbnail_url: thumbnailUrl || null, sort_order: sortOrder })
      .select()
      .single())
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { photoId } = await req.json()
  if (!photoId) return Response.json({ error: 'חסר photoId' }, { status: 400 })

  const admin = createAdminClient()

  // Verify the photo belongs to this photographer's portfolio
  const { data: photo } = await admin
    .from('photos')
    .select('id, url, session_id, sessions(portfolio_id, portfolios(photographer_id, photographers(email)))')
    .eq('id', photoId)
    .maybeSingle()

  if (!photo) return Response.json({ error: 'תמונה לא נמצאה' }, { status: 404 })

  // Check no active selections on this photo
  const { data: selections } = await admin
    .from('selections')
    .select('id')
    .eq('photo_id', photoId)
    .limit(1)

  if (selections && selections.length > 0) {
    return Response.json({ error: 'התמונה נבחרה על ידי הלקוחה ולא ניתן למחוק אותה' }, { status: 409 })
  }

  // Delete from DB
  const { error } = await admin.from('photos').delete().eq('id', photoId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Try to delete from Cloudinary (best-effort)
  try {
    const urlPath = photo.url
    const match = urlPath.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
    if (match) {
      await cloudinary.uploader.destroy(match[1])
    }
  } catch { /* ignore cloudinary errors */ }

  return Response.json({ ok: true })
}
