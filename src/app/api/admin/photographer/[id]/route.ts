import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function PATCH(req: Request, ctx: RouteContext<'/api/admin/photographer/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) return Response.json({ error: 'אין הרשאה' }, { status: 403 })

  const { is_frozen } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin.from('photographers').update({ is_frozen }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/admin/photographer/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { error } = await supabase.from('photographers').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
