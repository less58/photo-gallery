import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { decryptUrl, applyTransform } from '@/lib/imageToken'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('portfolio_session')?.value
  if (!sessionRaw) return new Response('unauthorized', { status: 401 })

  const token = req.nextUrl.searchParams.get('t')
  if (!token) return new Response('missing token', { status: 400 })

  let url: string
  try {
    url = decryptUrl(token)
  } catch {
    return new Response('invalid token', { status: 400 })
  }

  const tr = req.nextUrl.searchParams.get('tr')
  if (tr) url = applyTransform(url, tr)

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return new Response('upstream error', { status: upstream.status })
    const buf = await upstream.arrayBuffer()
    const ct = upstream.headers.get('content-type') || 'image/jpeg'
    return new Response(buf, {
      headers: {
        'content-type': ct,
        'cache-control': 'private, max-age=86400',
      },
    })
  } catch {
    return new Response('fetch failed', { status: 502 })
  }
}
