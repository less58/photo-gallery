import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const admin = createAdminClient()
  const { data: portfolio } = await admin
    .from('portfolios')
    .select('id, client_email, client_password')
    .eq('magic_token', token)
    .maybeSingle()

  if (!portfolio) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const cookieStore = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  }

  if (!portfolio.client_password) {
    return NextResponse.redirect(new URL(`/portfolio/${portfolio.id}/inactive`, req.url))
  }

  cookieStore.set('portfolio_session_pending', JSON.stringify({
    portfolioId: portfolio.id,
    email: portfolio.client_email,
  }), cookieOpts)

  return NextResponse.redirect(new URL(`/portfolio/${portfolio.id}/enter`, req.url))
}
