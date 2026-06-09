import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const DAYS_UNTIL_DELETION = 45

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DAYS_UNTIL_DELETION)

  // Find portfolios older than 45 days
  const { data: oldPortfolios, error: portfolioError } = await admin
    .from('portfolios')
    .select('id')
    .lt('created_at', cutoff.toISOString())

  if (portfolioError) {
    console.error('Cron cleanup: portfolio query error', portfolioError)
    return Response.json({ error: portfolioError.message }, { status: 500 })
  }

  if (!oldPortfolios?.length) {
    return Response.json({ ok: true, deleted: 0, portfolios: 0 })
  }

  const portfolioIds = oldPortfolios.map(p => p.id)

  // Get sessions for those portfolios
  const { data: sessions } = await admin
    .from('sessions')
    .select('id')
    .in('portfolio_id', portfolioIds)

  if (!sessions?.length) {
    return Response.json({ ok: true, deleted: 0, portfolios: portfolioIds.length })
  }

  const sessionIds = sessions.map(s => s.id)

  // Get all photos
  const { data: photos } = await admin
    .from('photos')
    .select('id, url')
    .in('session_id', sessionIds)

  if (!photos?.length) {
    return Response.json({ ok: true, deleted: 0, portfolios: portfolioIds.length })
  }

  const photoIds = photos.map(p => p.id)

  // Delete photo records from DB (selections will cascade-delete if FK is set)
  const { error: deleteError } = await admin
    .from('photos')
    .delete()
    .in('id', photoIds)

  if (deleteError) {
    console.error('Cron cleanup: photo delete error', deleteError)
    return Response.json({ error: deleteError.message }, { status: 500 })
  }

  // Extract Cloudinary public IDs and delete in batches of 100
  const publicIds = photos
    .map(p => {
      const m = p.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
      return m ? m[1] : null
    })
    .filter(Boolean) as string[]

  for (let i = 0; i < publicIds.length; i += 100) {
    try {
      await cloudinary.api.delete_resources(publicIds.slice(i, i + 100))
    } catch (e) {
      console.error('Cron cleanup: Cloudinary batch delete error', e)
    }
  }

  console.log(`Cron cleanup: deleted ${photos.length} photos from ${portfolioIds.length} portfolios`)
  return Response.json({ ok: true, deleted: photos.length, portfolios: portfolioIds.length })
}
