import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const portfolioId = req.nextUrl.searchParams.get('portfolioId')
  if (!portfolioId) return Response.json({ error: 'חסר portfolioId' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('albums')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ albums: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return Response.json({ error: 'לא מחוברת' }, { status: 401 })

  const { portfolioId, name, pdfUrl, pageCount, imageUrls } = await req.json()
  if (!portfolioId || (!pdfUrl && !imageUrls?.length)) return Response.json({ error: 'חסרים פרטים' }, { status: 400 })

  const insert: Record<string, unknown> = {
    portfolio_id: portfolioId,
    name: name || 'אלבום',
    page_count: pageCount || imageUrls?.length || 0,
  }
  if (pdfUrl) insert.pdf_url = pdfUrl
  if (imageUrls?.length) insert.image_urls = imageUrls

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('albums')
    .insert(insert)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
