import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return Response.json({ error: 'חסרים פרטים' }, { status: 400 })
  }

  // Diagnose env vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return Response.json({ error: 'NEXT_PUBLIC_SUPABASE_URL חסר — הפעל מחדש את השרת' }, { status: 500 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY חסר — הוסף ל-.env.local והפעל מחדש' }, { status: 500 })
  }

  try {
    const admin = createAdminClient()

    const { data: portfolio, error } = await admin
      .from('portfolios')
      .select('id, password_hash')
      .eq('client_email', email.toLowerCase().trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Login DB error:', error)
      return Response.json({ error: `שגיאת DB: ${error.message}` }, { status: 500 })
    }

    if (!portfolio) {
      return Response.json({ error: 'לא נמצא תיק עם מייל זה' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, portfolio.password_hash)
    if (!valid) {
      return Response.json({ error: 'סיסמה שגויה' }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set('portfolio_session', JSON.stringify({
      portfolioId: portfolio.id,
      email: email.toLowerCase().trim(),
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    return Response.json({ portfolioId: portfolio.id })
  } catch (e) {
    console.error('Login unexpected error:', e)
    return Response.json({ error: `שגיאה לא צפויה: ${String(e)}` }, { status: 500 })
  }
}
