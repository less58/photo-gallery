import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return Response.json({ error: 'חסרים מייל או סיסמה' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return Response.json({ error: 'חסרים משתני Supabase ב-Vercel' }, { status: 500 })
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase()
    const admin = createAdminClient()

    if (normalizedEmail !== SUPER_ADMIN_EMAIL) {
      const { data: existingPhotographer } = await admin
        .from('photographers')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (!existingPhotographer) {
        return Response.json({
          redirectTo: `/auth/request-account?email=${encodeURIComponent(normalizedEmail)}`,
        })
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error || !data.user) {
      console.error('Photographer login failed:', error)
      return Response.json({ error: 'מייל או סיסמה שגויים' }, { status: 401 })
    }

    if (data.user.email === SUPER_ADMIN_EMAIL) {
      return Response.json({ redirectTo: '/admin' })
    }

    const { data: photographer } = await admin
      .from('photographers')
      .select('id')
      .eq('email', data.user.email!)
      .maybeSingle()

    if (!photographer) {
      return Response.json({
        redirectTo: `/auth/request-account?email=${encodeURIComponent(data.user.email!)}`,
      })
    }

    return Response.json({ redirectTo: '/dashboard' })
  } catch (err) {
    console.error('Photographer login unexpected error:', err)
    return Response.json({ error: 'החיבור ל-Supabase נכשל' }, { status: 500 })
  }
}
