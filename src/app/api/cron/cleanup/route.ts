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

  const { data: oldPortfolios, error: portfolioError } = await admin
    .from('portfolios')
    .select('id, title, client_email, photographer_id')
    .lt('created_at', cutoff.toISOString())

  if (portfolioError) {
    console.error('Cron cleanup: portfolio query error', portfolioError)
    return Response.json({ error: portfolioError.message }, { status: 500 })
  }
  if (!oldPortfolios?.length) {
    return Response.json({ ok: true, deleted: 0, portfolios: 0 })
  }

  const portfolioIds = oldPortfolios.map(p => p.id)

  // Get sessions with their portfolio_id so we can map back
  const { data: sessions } = await admin
    .from('sessions')
    .select('id, portfolio_id')
    .in('portfolio_id', portfolioIds)

  if (!sessions?.length) {
    return Response.json({ ok: true, deleted: 0, portfolios: portfolioIds.length })
  }

  const sessionToPortfolio = Object.fromEntries(sessions.map(s => [s.id, s.portfolio_id]))
  const sessionIds = sessions.map(s => s.id)

  const { data: photos } = await admin
    .from('photos')
    .select('id, url, name, session_id')
    .in('session_id', sessionIds)

  if (!photos?.length) {
    return Response.json({ ok: true, deleted: 0, portfolios: portfolioIds.length })
  }

  // Group photos by portfolio
  const photosByPortfolio: Record<string, typeof photos> = {}
  for (const photo of photos) {
    const pid = sessionToPortfolio[(photo as { session_id: string }).session_id]
    if (!pid) continue
    if (!photosByPortfolio[pid]) photosByPortfolio[pid] = []
    photosByPortfolio[pid].push(photo)
  }

  // Save selection snapshots (only for portfolios that don't have one yet)
  for (const portfolio of oldPortfolios) {
    const { data: existing } = await admin
      .from('selection_snapshots')
      .select('id')
      .eq('portfolio_id', portfolio.id)
      .maybeSingle()
    if (existing) continue

    const { data: sels } = await admin
      .from('selections')
      .select('photo_id, status')
      .eq('portfolio_id', portfolio.id)
    if (!sels?.length) continue

    const portfolioPhotos = photosByPortfolio[portfolio.id] || []
    const snapshotItems = sels.map(sel => {
      const photo = portfolioPhotos.find(p => p.id === sel.photo_id)
      return { id: sel.photo_id, name: (photo as { name?: string })?.name || sel.photo_id, status: sel.status }
    })

    await admin.from('selection_snapshots').insert({
      photographer_id: portfolio.photographer_id,
      portfolio_id: portfolio.id,
      portfolio_title: portfolio.title,
      client_email: portfolio.client_email,
      approved_count: sels.filter(s => s.status === 'approved').length,
      selections_json: snapshotItems,
    })
  }

  const photoIds = photos.map(p => p.id)

  const { error: deleteError } = await admin
    .from('photos')
    .delete()
    .in('id', photoIds)

  if (deleteError) {
    console.error('Cron cleanup: photo delete error', deleteError)
    return Response.json({ error: deleteError.message }, { status: 500 })
  }

  // Delete from Cloudinary in batches of 100
  const publicIds = photos
    .map(p => { const m = p.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/); return m ? m[1] : null })
    .filter(Boolean) as string[]

  for (let i = 0; i < publicIds.length; i += 100) {
    try { await cloudinary.api.delete_resources(publicIds.slice(i, i + 100)) } catch (e) {
      console.error('Cron cleanup: Cloudinary batch delete error', e)
    }
  }

  console.log(`Cron cleanup: deleted ${photos.length} photos from ${portfolioIds.length} portfolios`)
  return Response.json({ ok: true, deleted: photos.length, portfolios: portfolioIds.length })
}
