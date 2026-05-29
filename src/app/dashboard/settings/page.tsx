import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: photographer } = await admin
    .from('photographers')
    .select('*')
    .eq('email', user!.email!)
    .maybeSingle()

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-stone-800 mb-6">הגדרות</h1>
      <SettingsForm photographer={photographer} />
    </div>
  )
}
