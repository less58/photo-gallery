import { createClient } from '@/lib/supabase/server'
import { v2 as cloudinary } from 'cloudinary'
import { NextRequest } from 'next/server'

export const maxDuration = 120

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const folder = (formData.get('folder') as string) || 'albums'

  if (!file) return Response.json({ error: 'חסר קובץ' }, { status: 400 })
  if (file.type !== 'application/pdf') return Response.json({ error: 'יש להעלות קובץ PDF בלבד' }, { status: 400 })

  const MAX_SIZE = 150 * 1024 * 1024  // 150MB
  if (file.size > MAX_SIZE) return Response.json({ error: 'הקובץ גדול מדי (מקסימום 150MB)' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const result = await new Promise<{ secure_url: string; public_id: string; pages?: number }>(
    (resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string; public_id: string; pages?: number })
        }
      ).end(buffer)
    }
  )

  return Response.json({
    url: result.secure_url,
    publicId: result.public_id,
    pageCount: result.pages ?? 0,
  })
}
