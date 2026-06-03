import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const admin = createAdminClient()

  const { data: ph } = await admin
    .from('photographers')
    .select('id')
    .eq('email', session.user.email!)
    .maybeSingle()

  if (!ph) return Response.json([], { headers: { 'Cache-Control': 'no-store' } })

  const { data: portfolios } = await admin
    .from('portfolios')
    .select('id, title, client_email, is_done, cover_url')
    .eq('photographer_id', ph.id)
    .order('created_at', { ascending: false })

  if (!portfolios?.length) return Response.json([], { headers: { 'Cache-Control': 'no-store' } })

  const portfolioIds = portfolios.map(p => p.id)

  const { data: notes } = await admin
    .from('portfolio_notes')
    .select('portfolio_id, sender, message, created_at, read_by_photographer')
    .in('portfolio_id', portfolioIds)
    .order('created_at', { ascending: false })

  const summary = portfolios
    .map(p => {
      const pNotes = (notes || []).filter(n => n.portfolio_id === p.id)
      const unreadCount = pNotes.filter(
        n => n.sender === 'client' && !n.read_by_photographer
      ).length
      const lastNote = pNotes[0]
      return {
        portfolioId: p.id,
        portfolioTitle: p.title,
        clientEmail: p.client_email,
        isDone: !!(p as { is_done?: boolean }).is_done,
        coverUrl: (p as { cover_url?: string | null }).cover_url ?? null,
        unreadCount,
        lastMessage: lastNote?.message?.slice(0, 80) ?? null,
        lastMessageAt: lastNote?.created_at ?? null,
        lastSender: lastNote?.sender ?? null,
      }
    })
    // Active portfolios always shown; completed only if they have messages
    .filter(s => !s.isDone || s.lastMessage !== null)
    .sort((a, b) => {
      // Unread first within same isDone group
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tb - ta
    })

  return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } })
}
