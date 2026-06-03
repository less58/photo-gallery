import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

async function getPortfolioSession() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('portfolio_session')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as { portfolioId: string; email: string }
  } catch {
    return null
  }
}

async function checkNotDone(portfolioId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('portfolios')
    .select('is_done')
    .eq('id', portfolioId)
    .single()
  return !(data?.is_done)
}

export async function POST(req: NextRequest) {
  const session = await getPortfolioSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  if (!await checkNotDone(session.portfolioId)) {
    return Response.json({ error: 'התיק הושלם — לא ניתן לשנות בחירות' }, { status: 403 })
  }

  const { photoId, status } = await req.json()
  if (!photoId || !status) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('selections').upsert({
    portfolio_id: session.portfolioId,
    photo_id: photoId,
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'portfolio_id,photo_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getPortfolioSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  if (!await checkNotDone(session.portfolioId)) {
    return Response.json({ error: 'התיק הושלם — לא ניתן לשנות בחירות' }, { status: 403 })
  }

  const { photoId } = await req.json()
  const admin = createAdminClient()
  await admin
    .from('selections')
    .delete()
    .eq('portfolio_id', session.portfolioId)
    .eq('photo_id', photoId)

  return Response.json({ ok: true })
}
