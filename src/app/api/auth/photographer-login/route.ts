import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password,
    })

    if (error || !data.user) {
      console.error('Photographer login failed:', error)
      return Response.json({ error: 'מייל או סיסמה שגויים' }, { status: 401 })
    }

    return Response.json({
      redirectTo: data.user.email === SUPER_ADMIN_EMAIL ? '/admin' : '/dashboard',
    })
  } catch (err) {
    console.error('Photographer login unexpected error:', err)
    return Response.json({ error: 'החיבור ל-Supabase נכשל' }, { status: 500 })
  }
}
