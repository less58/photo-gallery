import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('missing url', { status: 400 })

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return new Response('upstream error', { status: upstream.status })
    const buf = await upstream.arrayBuffer()
    const ct = upstream.headers.get('content-type') || 'image/jpeg'
    return new Response(buf, {
      headers: {
        'content-type': ct,
        'cache-control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return new Response('fetch failed', { status: 502 })
  }
}
