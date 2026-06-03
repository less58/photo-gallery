import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await params
  const { name } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'חסר שם' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('albums').update({ name: name.trim() }).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: album } = await admin.from('albums').select('pdf_url').eq('id', id).single()

  const { error } = await admin.from('albums').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (album?.pdf_url) {
    try {
      const m = album.pdf_url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
      if (m) await cloudinary.uploader.destroy(m[1], { resource_type: 'image' })
    } catch { /* ignore */ }
  }

  return Response.json({ ok: true })
}
