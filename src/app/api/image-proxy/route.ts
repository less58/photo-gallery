import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decryptUrl, applyTransform } from '@/lib/imageToken'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')

  // Detect direct browser navigation (F12 "open in new tab", paste URL, etc.)
  const secFetchDest = req.headers.get('sec-fetch-dest')
  const accept = req.headers.get('accept') || ''
  const isDirectNavigation =
    secFetchDest === 'document' ||
    (!secFetchDest && accept.includes('text/html') && !accept.includes('image/'))

  if (isDirectNavigation) {
    // Redirect to portfolio password page instead of serving the image
    let portfolioId: string | null = null
    if (token) {
      try { portfolioId = decryptUrl(token).portfolioId } catch { /* ignore */ }
    }
    const dest = portfolioId ? `/portfolio/${portfolioId}/enter` : '/login'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  // Normal image load — require valid session tied to this portfolio
  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('portfolio_session')?.value
  if (!sessionRaw) return new Response('unauthorized', { status: 401 })

  let session: { portfolioId: string } | null = null
  try {
    session = JSON.parse(sessionRaw)
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  if (!token) return new Response('missing token', { status: 400 })

  let url: string
  let tokenPortfolioId: string
  try {
    const decoded = decryptUrl(token)
    url = decoded.url
    tokenPortfolioId = decoded.portfolioId
  } catch {
    return new Response('invalid token', { status: 400 })
  }

  if (!session || session.portfolioId !== tokenPortfolioId) {
    return new Response('forbidden', { status: 403 })
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
        'cache-control': 'no-store',
      },
    })
  } catch {
    return new Response('fetch failed', { status: 502 })
  }
}
