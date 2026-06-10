import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()

  const { password } = await req.json()
  if (!password) {
    return NextResponse.json({ error: 'יש להזין קוד' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: portfolio } = await admin
    .from('portfolios')
    .select('client_password, client_email')
    .eq('id', id)
    .maybeSingle()

  if (!portfolio) {
    return NextResponse.json({ error: 'גלריה לא נמצאה' }, { status: 404 })
  }

  if (!portfolio.client_password || portfolio.client_password !== password) {
    return NextResponse.json({ error: 'קוד שגוי' }, { status: 401 })
  }

  // Prefer email from the pending session (set by email link), fall back to DB
  let email = portfolio.client_email || ''
  const pendingRaw = cookieStore.get('portfolio_session_pending')?.value
  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw) as { portfolioId: string; email: string }
      if (pending.portfolioId === id) email = pending.email || email
    } catch { /* use DB email */ }
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  }

  cookieStore.set('portfolio_session', JSON.stringify({ portfolioId: id, email }), cookieOpts)
  cookieStore.delete('portfolio_session_pending')

  return NextResponse.json({ ok: true })
}
