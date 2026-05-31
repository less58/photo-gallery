import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/account-request/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { status } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin
    .from('account_requests')
    .update({ status: status || 'approved' })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
