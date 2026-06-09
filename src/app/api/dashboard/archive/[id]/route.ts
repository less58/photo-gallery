import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

function buildTxt(title: string, email: string, items: { name: string; status: string }[]) {
  const approved = items.filter(i => i.status === 'approved')
  const maybe = items.filter(i => i.status === 'maybe')
  const date = new Date().toLocaleDateString('he-IL')

  const lines: string[] = [
    `גלריה: ${title}`,
    `לקוחה: ${email}`,
    `תאריך הורדה: ${date}`,
    '',
  ]

  if (approved.length > 0) {
    lines.push(`תמונות מאושרות (${approved.length}):`)
    approved.forEach((item, i) => lines.push(`  ${i + 1}. ${item.name}`))
    lines.push('')
  }

  if (maybe.length > 0) {
    lines.push(`תמונות בהמתנה (${maybe.length}):`)
    maybe.forEach((item, i) => lines.push(`  ${i + 1}. ${item.name}`))
    lines.push('')
  }

  if (approved.length === 0 && maybe.length === 0) {
    lines.push('אין בחירות שמורות.')
  }

  return lines.join('\n')
}

function txtResponse(txt: string, filename: string) {
  return new Response(txt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const source = req.nextUrl.searchParams.get('source') ?? 'snapshot'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()

  const { data: photographer } = await admin
    .from('photographers')
    .select('id')
    .eq('email', user.email!)
    .maybeSingle()
  if (!photographer) return Response.json({ error: 'לא נמצאת' }, { status: 404 })

  if (source === 'portfolio') {
    // Active portfolio — fetch live selections
    const { data: portfolio } = await admin
      .from('portfolios')
      .select('id, title, client_email, photographer_id')
      .eq('id', id)
      .eq('photographer_id', photographer.id)
      .maybeSingle()
    if (!portfolio) return Response.json({ error: 'לא נמצא' }, { status: 404 })

    const { data: sessions } = await admin
      .from('sessions')
      .select('id, photos(id, name)')
      .eq('portfolio_id', id)

    const allPhotos = (sessions || []).flatMap(s => (s.photos as { id: string; name?: string }[]) || [])

    const { data: sels } = await admin
      .from('selections')
      .select('photo_id, status')
      .eq('portfolio_id', id)

    const items = (sels || []).map(sel => {
      const photo = allPhotos.find(p => p.id === sel.photo_id)
      return { name: photo?.name || sel.photo_id, status: sel.status }
    })

    const txt = buildTxt(portfolio.title, portfolio.client_email, items)
    return txtResponse(txt, `${portfolio.title}_בחירות.txt`)
  }

  // Snapshot (deleted portfolio)
  const { data: snapshot } = await admin
    .from('selection_snapshots')
    .select('*')
    .eq('id', id)
    .eq('photographer_id', photographer.id)
    .maybeSingle()
  if (!snapshot) return Response.json({ error: 'לא נמצא' }, { status: 404 })

  await admin
    .from('selection_snapshots')
    .update({ downloaded_at: new Date().toISOString() })
    .eq('id', id)

  type Item = { name: string; status: string }
  const items = (snapshot.selections_json as Item[]) || []
  const txt = buildTxt(snapshot.portfolio_title, snapshot.client_email, items)
  return txtResponse(txt, `${snapshot.portfolio_title}_בחירות.txt`)
}
