import { createAdminClient } from '@/lib/supabase/admin'
import AdminPanel from '@/components/AdminPanel'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createAdminClient()

  const { data: photographers } = await supabase
    .from('photographers')
    .select('id, name, email, brand_color, created_at, is_frozen, portfolios(id)')
    .neq('email', '9095362@gmail.com')
    .order('created_at', { ascending: false })

  const list = (photographers || []).map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    brand_color: p.brand_color,
    created_at: p.created_at,
    is_frozen: p.is_frozen ?? false,
    portfolioCount: Array.isArray(p.portfolios) ? p.portfolios.length : 0,
  }))

  const { data: requests, error: requestsError } = await supabase
    .from('account_requests')
    .select('id, name, email, details, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (requestsError) console.error('Admin account requests error:', requestsError.message)

  return <AdminPanel initialPhotographers={list} initialRequests={requests || []} />
}
