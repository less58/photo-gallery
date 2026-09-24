import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Reads the session from cookies without a round trip to Supabase's auth
// server. Safe to use in Server Components under /dashboard and /admin
// because proxy.ts already validates the session (via auth.getUser()) for
// every request that reaches those routes.
export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
})

// cache() dedupes this within a single request, so layout + page can both
// call it without issuing duplicate queries.
export const getPhotographerByEmail = cache(async (email: string) => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('photographers')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  return data
})
