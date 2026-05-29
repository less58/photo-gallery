import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, ctx: RouteContext<'/api/admin/photographer/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { error } = await supabase.from('photographers').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
