import { createClient } from '@/lib/supabase/server'
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

export async function POST(req: NextRequest) {
  const session = await getPortfolioSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { photoId, status } = await req.json()
  if (!photoId || !status) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const supabase = await createClient()

  const { error } = await supabase.from('selections').upsert({
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

  const { photoId } = await req.json()

  const supabase = await createClient()
  await supabase
    .from('selections')
    .delete()
    .eq('portfolio_id', session.portfolioId)
    .eq('photo_id', photoId)

  return Response.json({ ok: true })
}
