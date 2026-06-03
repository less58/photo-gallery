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

  let { data, error } = await admin
    .from('photos')
    .insert({ session_id: sessionId, url, thumbnail_url: thumbnailUrl || null, name: name || null, sort_order: sortOrder })
    .select()
    .single()

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
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

  const body = await req.json()
  // Support both single { photoId } and batch { photoIds: string[] }
  const photoIds: string[] = body.photoIds
    ? body.photoIds
    : body.photoId
      ? [body.photoId]
      : []

  if (photoIds.length === 0) return Response.json({ error: 'חסר photoId' }, { status: 400 })

  const admin = createAdminClient()

  const { data: photos } = await admin
    .from('photos')
    .select('id, url')
    .in('id', photoIds)

  if (!photos?.length) return Response.json({ error: 'תמונות לא נמצאו' }, { status: 404 })

  // Filter out photos with client selections
  const { data: selections } = await admin
    .from('selections')
    .select('photo_id')
    .in('photo_id', photoIds)

  const selectedSet = new Set(selections?.map(s => s.photo_id) ?? [])
  const deletable = photos.filter(p => !selectedSet.has(p.id))
  const skipped = photos.length - deletable.length

  if (deletable.length === 0) {
    return Response.json({
      error: 'כל התמונות שנבחרו נבחרו ע"י הלקוחה ולא ניתן למחוק אותן',
      skipped,
    }, { status: 409 })
  }

  const deletableIds = deletable.map(p => p.id)
  const { error } = await admin.from('photos').delete().in('id', deletableIds)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Batch delete from Cloudinary
  try {
    const publicIds = deletable.map(p => {
      const m = p.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
      return m ? m[1] : null
    }).filter(Boolean) as string[]

    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds)
    }
  } catch { /* ignore cloudinary errors */ }

  return Response.json({ ok: true, deleted: deletable.length, deletedIds: deletableIds, skipped })
}
