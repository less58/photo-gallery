import { NextRequest } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

export const maxDuration = 60

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/tiff',
])
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const folder = (formData.get('folder') as string) || 'photos'
  const watermarkPublicId = formData.get('watermarkPublicId') as string | null
  const extractColors = formData.get('extractColors') === 'true'

  if (!file) return Response.json({ error: 'חסר קובץ' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) return Response.json({ error: 'סוג קובץ לא נתמך' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'הקובץ גדול מדי (מקסימום 50MB)' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const transformation: object[] = folder !== 'watermarks'
    ? [{ width: 1200, crop: 'limit', quality: 'auto:good' }]
    : []

  if (watermarkPublicId) {
    transformation.push(
      { overlay: { public_id: watermarkPublicId.replace(/\//g, ':') }, gravity: 'center', opacity: 20, width: 0.6, flags: 'relative' },
      { flags: 'layer_apply' }
    )
  }

  const uploadOptions: Record<string, unknown> = {
    folder,
    resource_type: 'image',
    colors: extractColors,
  }
  if (transformation.length) uploadOptions.transformation = transformation

  const result = await new Promise<{ secure_url: string; public_id: string; colors?: [string, number][] }>(
    (resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string; public_id: string; colors?: [string, number][] })
        }
      ).end(buffer)
    }
  )

  const thumbnailUrl = folder !== 'watermarks' && folder !== 'logos'
    ? result.secure_url.replace('/upload/', '/upload/w_400,q_auto:good/')
    : result.secure_url

  const dominantColors = result.colors?.slice(0, 6).map(([hex]) => hex) ?? []

  return Response.json({
    url: result.secure_url,
    thumbnailUrl,
    publicId: result.public_id,
    colors: dominantColors,
  })
}
