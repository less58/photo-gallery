import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthLogin = pathname === '/auth/login'
  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin = pathname.startsWith('/admin')

  // Redirect away from login if already signed in
  if (isAuthLogin && user) {
    const dest = user.email === SUPER_ADMIN_EMAIL ? '/admin' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Protect dashboard — must be signed in + not super admin
  if (isDashboard && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (isDashboard && user?.email === SUPER_ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Protect admin — must be super admin
  if (isAdmin && (!user || user.email !== SUPER_ADMIN_EMAIL)) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Protect gallery — must have portfolio session cookie
  const portfolioSession = request.cookies.get('portfolio_session')?.value
  const isGallery = pathname.startsWith('/portfolio') && pathname.endsWith('/gallery')
  if (isGallery && !portfolioSession) {
    const portfolioId = pathname.split('/')[2]
    return NextResponse.redirect(new URL(`/portfolio/${portfolioId}`, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/portfolio/:path*/gallery'],
}
