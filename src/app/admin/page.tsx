import { createClient } from '@/lib/supabase/server'
import AdminPanel from '@/components/AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: photographers } = await supabase
    .from('photographers')
    .select('id, name, email, brand_color, created_at, portfolios(id)')
    .order('created_at', { ascending: false })

  const list = (photographers || []).map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    brand_color: p.brand_color,
    created_at: p.created_at,
    portfolioCount: Array.isArray(p.portfolios) ? p.portfolios.length : 0,
  }))

  return <AdminPanel initialPhotographers={list} />
}
