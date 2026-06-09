import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import GalleryClient from '@/components/GalleryClient'
import type { Photo, Collage, Album } from '@/lib/types'
import { encryptUrl } from '@/lib/imageToken'

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

  const { data: collagesData } = await admin
    .from('collages')
    .select('*')
    .eq('portfolio_id', id)
    .order('created_at', { ascending: false })

  const { data: albumsData } = await admin
    .from('albums')
    .select('*')
    .eq('portfolio_id', id)
    .order('created_at', { ascending: false })

  const ph = (portfolio.photographer ?? {}) as Record<string, unknown>

  function proxy(url: string | null | undefined): string | null {
    if (!url) return null
    return `/api/image-proxy?t=${encryptUrl(url)}`
  }

  function proxyPhoto(photo: Photo): Photo {
    return {
      ...photo,
      url: proxy(photo.url) ?? photo.url,
      thumbnail_url: photo.thumbnail_url ? proxy(photo.thumbnail_url) : null,
    }
  }

  const allSessions = (rawSessions || []).map(s => ({
    ...s,
    photos: ((s.photos as Photo[]) || [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(proxyPhoto),
  }))

  const allPhotos: Photo[] = allSessions.flatMap(s => s.photos || [])

  const proxiedAlbums = ((albumsData || []) as Album[]).map(album => ({
    ...album,
    image_urls: album.image_urls?.map(u => proxy(u) ?? u) ?? null,
    pdf_url: proxy(album.pdf_url),
  }))

  const proxiedCollages = ((collagesData || []) as Collage[]).map(collage => ({
    ...collage,
    cells: collage.cells.map(cell => ({
      ...cell,
      photo_url: cell.photo_url ? proxy(cell.photo_url) : null,
    })),
  }))

  return (
    <GalleryClient
      sessions={allSessions}
      allPhotos={allPhotos}
      initialSelections={selections || []}
      quota={portfolio.quota ?? 30}
      color={String(ph.brand_color || '#C97B73')}
      portfolioId={id}
      portfolioTitle={portfolio.title ?? ''}
      coverUrl={proxy(portfolio.cover_url as string)}
      instructions={portfolio.instructions ?? null}
      photographerName={String(ph.name || '')}
      logoUrl={proxy(ph.logo_url as string)}
      showSendButton={ph.receive_selection_emails !== false}
      isDone={(portfolio.is_done as boolean) ?? false}
      collages={proxiedCollages}
      albums={proxiedAlbums}
      allowAlbumDownload={(ph.allow_album_download as boolean) === true}
    />
  )
}
