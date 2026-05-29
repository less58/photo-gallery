import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return Response.json({ error: 'חסרים פרטים' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  })
  if (authErr) return Response.json({ error: authErr.message }, { status: 500 })

  const { data: photographer, error: phErr } = await supabase
    .from('photographers')
    .insert({ email: email.toLowerCase(), name, brand_color: '#D4736A' })
    .select()
    .single()

  if (phErr) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return Response.json({ error: phErr.message }, { status: 500 })
  }

  return Response.json(photographer)
}
