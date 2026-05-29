import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import GalleryClient from '@/components/GalleryClient'
import type { Photo } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function GalleryPage(props: PageProps<'/portfolio/[id]/gallery'>) {
  const { id } = await props.params

  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('portfolio_session')?.value
  if (!sessionRaw) redirect('/login')

  let parsed: { portfolioId: string } | null = null
  try { parsed = JSON.parse(sessionRaw) } catch { redirect('/login') }
  if (!parsed || parsed.portfolioId !== id) redirect('/login')

  const admin = createAdminClient()

  // Use * to handle any column set without breaking
  const { data: portfolio, error: pErr } = await admin
    .from('portfolios')
    .select('*, photographer:photographers(*)')
    .eq('id', id)
    .maybeSingle()

  if (pErr) { console.error('Gallery portfolio error:', pErr); notFound() }
  if (!portfolio) notFound()

  const { data: rawSessions } = await admin
    .from('sessions')
    .select('*, photos(*)')
    .eq('portfolio_id', id)
    .order('sort_order')

  const { data: selections } = await admin
    .from('selections')
    .select('*')
    .eq('portfolio_id', id)

  const ph = (portfolio.photographer ?? {}) as Record<string, unknown>

  const allSessions = (rawSessions || []).map(s => ({
    ...s,
    photos: ((s.photos as Photo[]) || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }))

  const allPhotos: Photo[] = allSessions.flatMap(s => s.photos || [])

  return (
    <GalleryClient
      sessions={allSessions}
      allPhotos={allPhotos}
      initialSelections={selections || []}
      quota={portfolio.quota ?? 30}
      color={String(ph.brand_color || '#C97B73')}
      portfolioId={id}
      portfolioTitle={portfolio.title ?? ''}
      coverUrl={(portfolio.cover_url as string) ?? null}
      instructions={portfolio.instructions ?? null}
      photographerName={String(ph.name || '')}
      logoUrl={(ph.logo_url as string) ?? null}
    />
  )
}
