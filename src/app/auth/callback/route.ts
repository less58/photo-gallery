import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    if (next === '/dashboard') {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email === SUPER_ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/admin', requestUrl.origin))
      }

      if (user?.email) {
        const admin = createAdminClient()
        const { data: photographer } = await admin
          .from('photographers')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()

        if (!photographer) {
          return NextResponse.redirect(
            new URL(`/auth/request-account?email=${encodeURIComponent(user.email)}`, requestUrl.origin)
          )
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
