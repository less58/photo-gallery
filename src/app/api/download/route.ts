import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import type { Photo } from '@/lib/types'

export const maxDuration = 60

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('portfolio_session')?.value
  if (!raw) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  let session: { portfolioId: string; email: string } | null = null
  try { session = JSON.parse(raw) } catch { return Response.json({ error: 'שגיאה' }, { status: 401 }) }
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()

  const { data: portfolio } = await admin
    .from('portfolios')
    .select('*, photographer:photographers(*)')
    .eq('id', session.portfolioId)
    .maybeSingle()

  if (!portfolio) return Response.json({ error: 'תיק לא נמצא' }, { status: 404 })

  const ph = (portfolio.photographer ?? {}) as Record<string, unknown>
  if (!ph.allow_client_download) {
    return Response.json({ error: 'הורדה אינה מופעלת לתיק זה' }, { status: 403 })
  }

  const { data: selections } = await admin
    .from('selections')
    .select('photo_id')
    .eq('portfolio_id', session.portfolioId)
    .eq('status', 'approved')

  if (!selections || selections.length === 0) {
    return Response.json({ error: 'לא נבחרו תמונות' }, { status: 400 })
  }

  const { data: rawSessions } = await admin
    .from('sessions')
    .select('*, photos(*)')
    .eq('portfolio_id', session.portfolioId)

  const allPhotos: Photo[] = (rawSessions || []).flatMap(s => (s.photos as Photo[]) || [])
  const approvedIds = new Set(selections.map(s => s.photo_id))
  const approvedPhotos = allPhotos.filter(p => approvedIds.has(p.id))

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  await Promise.all(
    approvedPhotos.map(async (photo, i) => {
      try {
        const res = await fetch(photo.url)
        if (!res.ok) return
        const buf = await res.arrayBuffer()
        const ext = photo.url.includes('.png') ? 'png' : 'jpg'
        const filename = photo.name
          ? photo.name.replace(/[\\/:*?"<>|]/g, '_')
          : `photo-${String(i + 1).padStart(3, '0')}.${ext}`
        zip.file(filename, buf)
      } catch { /* skip failed photo */ }
    })
  )

  const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })

  return new Response(zipArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(portfolio.title)}.zip"`,
      'Content-Length': String(zipArrayBuffer.byteLength),
    },
  })
}
