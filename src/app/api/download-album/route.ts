import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const albumId = req.nextUrl.searchParams.get('id')
  if (!albumId) return Response.json({ error: 'חסר ID' }, { status: 400 })

  const admin = createAdminClient()
  const { data: album } = await admin
    .from('albums')
    .select('name, image_urls, portfolio:portfolios(title)')
    .eq('id', albumId)
    .single()

  if (!album?.image_urls?.length) {
    return Response.json({ error: 'אלבום לא נמצא' }, { status: 404 })
  }

  const clientName = (album.portfolio as { title?: string } | null)?.title ?? ''
  const folderName = clientName ? `אלבום - ${clientName}` : album.name

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = zip.folder(folderName) ?? zip

  await Promise.all(
    album.image_urls.map(async (url: string, i: number) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const buffer = await res.arrayBuffer()
        const ext = res.headers.get('content-type')?.split('/')[1]?.split('+')[0] || 'jpg'
        folder.file(`${String(i + 1).padStart(3, '0')}.${ext}`, buffer)
      } catch { /* skip failed images */ }
    })
  )

  const { PassThrough, Readable } = await import('stream')
  const pt = new PassThrough()
  zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }).pipe(pt)
  const webStream = Readable.toWeb(pt) as ReadableStream<Uint8Array>

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(folderName)}.zip`,
    },
  })
}
