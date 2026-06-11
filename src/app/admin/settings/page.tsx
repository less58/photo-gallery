import { createAdminClient } from '@/lib/supabase/admin'
import AdminEmailSettingsForm from '@/components/AdminEmailSettingsForm'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const admin = createAdminClient()
  let { data: settings } = await admin
    .from('photographers')
    .select('*')
    .eq('email', SUPER_ADMIN_EMAIL)
    .maybeSingle()

  if (!settings) {
    const { data } = await admin
      .from('photographers')
      .insert({
        email: SUPER_ADMIN_EMAIL,
        name: 'SELECT IT',
        brand_color: '#D4736A',
      })
      .select('*')
      .single()
    settings = data
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-stone-800 mb-2">הגדרות מייל מנהל על</h1>
      <p className="text-sm text-stone-400 mb-6">
        מכאן יישלחו בקשות פתיחת חשבון, סיסמאות ראשוניות וקישורי איפוס סיסמה לצלמות.
      </p>
      <AdminEmailSettingsForm settings={settings ?? {}} />
    </div>
  )
}
