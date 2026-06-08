import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()

  const pendingRaw = cookieStore.get('portfolio_session_pending')?.value
  if (!pendingRaw) {
    return NextResponse.json({ error: 'פג תוקף הגישה — יש להיכנס שוב דרך הקישור' }, { status: 401 })
  }

  let pending: { portfolioId: string; email: string }
  try {
    pending = JSON.parse(pendingRaw)
  } catch {
    return NextResponse.json({ error: 'שגיאת מערכת' }, { status: 400 })
  }

  if (pending.portfolioId !== id) {
    return NextResponse.json({ error: 'קישור לא תקין' }, { status: 403 })
  }

  const { password } = await req.json()
  if (!password) {
    return NextResponse.json({ error: 'יש להזין קוד' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: portfolio } = await admin
    .from('portfolios')
    .select('client_password')
    .eq('id', id)
    .maybeSingle()

  if (!portfolio) {
    return NextResponse.json({ error: 'גלריה לא נמצאה' }, { status: 404 })
  }

  if (!portfolio.client_password || portfolio.client_password !== password) {
    return NextResponse.json({ error: 'קוד שגוי' }, { status: 401 })
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  }

  cookieStore.set('portfolio_session', JSON.stringify({
    portfolioId: pending.portfolioId,
    email: pending.email,
  }), cookieOpts)

  cookieStore.delete('portfolio_session_pending')

  return NextResponse.json({ ok: true })
}
