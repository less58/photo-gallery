import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: portfolioId } = await params

  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('portfolio_session')?.value
  if (!sessionRaw) return Response.json({ error: 'לא מורשה' }, { status: 401 })

  let parsed: { portfolioId: string } | null = null
  try { parsed = JSON.parse(sessionRaw) } catch { return Response.json({ error: 'לא מורשה' }, { status: 401 }) }
  if (!parsed || parsed.portfolioId !== portfolioId) return Response.json({ error: 'לא מורשה' }, { status: 401 })

  const { albumId, spreadIndex, note } = await req.json()
  if (!albumId || spreadIndex === undefined) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const admin = createAdminClient()

  // Verify album belongs to this portfolio
  const { data: album, error: fetchErr } = await admin
    .from('albums')
    .select('id, spread_notes')
    .eq('id', albumId)
    .eq('portfolio_id', portfolioId)
    .single()

  if (fetchErr || !album) return Response.json({ error: 'אלבום לא נמצא' }, { status: 404 })

  const currentNotes: Record<string, string> = (album.spread_notes as Record<string, string>) ?? {}
  const key = String(spreadIndex)

  if (note?.trim()) {
    currentNotes[key] = note.trim()
  } else {
    delete currentNotes[key]
  }

  const { error: updateErr } = await admin
    .from('albums')
    .update({ spread_notes: Object.keys(currentNotes).length > 0 ? currentNotes : null })
    .eq('id', albumId)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
  return Response.json({ ok: true })
}
