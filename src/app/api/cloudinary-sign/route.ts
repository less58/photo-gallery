import { NextRequest } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const body = await req.json()
  const folder = String(body?.folder ?? '')
  if (!folder.startsWith('portfolios/')) {
    return Response.json({ error: 'תיקייה לא חוקית' }, { status: 400 })
  }

  const portfolioId = folder.split('/')[1]
  const admin = createAdminClient()

  const { data: photographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!photographer) return Response.json({ error: 'צלמת לא נמצאה' }, { status: 403 })

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('id')
    .eq('id', portfolioId)
    .eq('photographer_id', photographer.id)
    .single()

  if (!portfolio) return Response.json({ error: 'תיק לא נמצא' }, { status: 404 })

  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign: Record<string, string | number> = { folder, timestamp }
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!)

  return Response.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
  })
}
