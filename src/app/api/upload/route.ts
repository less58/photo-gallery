import { NextRequest } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

export const maxDuration = 60

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const folder = (formData.get('folder') as string) || 'photos'
    const extractColors = formData.get('extractColors') === 'true'

    // Image watermark
    const watermarkPublicId = formData.get('watermarkPublicId') as string | null
    const watermarkImageOpacity = parseInt((formData.get('watermarkImageOpacity') as string | null) ?? '20', 10)

    // Text watermark
    const watermarkText = formData.get('watermarkText') as string | null
    const watermarkOpacity = parseInt((formData.get('watermarkOpacity') as string | null) ?? '30', 10)
    const watermarkPosition = (formData.get('watermarkPosition') as string | null) ?? 'free'
    const watermarkFontSize = parseInt((formData.get('watermarkFontSize') as string | null) ?? '120', 10)
    const watermarkColor = (formData.get('watermarkColor') as string | null) ?? '#ffffff'
    const watermarkX = parseFloat((formData.get('watermarkX') as string | null) ?? '0.5')
    const watermarkY = parseFloat((formData.get('watermarkY') as string | null) ?? '0.85')
    const watermarkRotation = parseInt((formData.get('watermarkRotation') as string | null) ?? '0', 10)

    if (!file) return Response.json({ error: 'חסר קובץ' }, { status: 400 })
    if (!file.type.startsWith('image/')) return Response.json({ error: 'סוג קובץ לא נתמך' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'הקובץ גדול מדי (מקסימום 50MB)' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const transformation: object[] = folder !== 'watermarks'
      ? [{ width: 1920, crop: 'limit', quality: 'auto:best' }]
      : []

    if (watermarkPublicId) {
      transformation.push(
        { overlay: { public_id: watermarkPublicId.replace(/\//g, ':') }, gravity: 'center', opacity: watermarkImageOpacity, width: 0.6, height: 0.9, crop: 'fit', flags: 'relative' },
        { flags: 'layer_apply' }
      )
    } else if (watermarkText) {
      const isTiled = watermarkPosition === 'tiled'
      const colorVal = watermarkColor.startsWith('#') ? `rgb:${watermarkColor.slice(1)}` : watermarkColor

      if (isTiled) {
        transformation.push(
          {
            overlay: { font_family: 'Heebo', font_size: watermarkFontSize, font_weight: 'bold', text: watermarkText },
            color: colorVal,
            gravity: 'center',
            opacity: watermarkOpacity,
            flags: 'tiled',
          },
          { flags: 'layer_apply' }
        )
      } else {
        transformation.push(
          {
            overlay: { font_family: 'Heebo', font_size: watermarkFontSize, font_weight: 'bold', text: watermarkText },
            color: colorVal,
            gravity: 'center',
            x: watermarkX - 0.5,
            y: watermarkY - 0.5,
            opacity: watermarkOpacity,
            angle: watermarkRotation || undefined,
            flags: 'relative',
          },
          { flags: 'layer_apply' }
        )
      }
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
      ? result.secure_url.replace('/upload/', '/upload/w_600,q_auto:best/')
      : result.secure_url

    const dominantColors = result.colors?.slice(0, 6).map(([hex]) => hex) ?? []

    return Response.json({
      url: result.secure_url,
      thumbnailUrl,
      publicId: result.public_id,
      colors: dominantColors,
    })
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (err && typeof err === 'object' ? JSON.stringify(err) : String(err))
    console.error('[upload] Cloudinary error:', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
