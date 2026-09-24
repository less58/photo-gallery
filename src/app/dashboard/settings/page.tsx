import { getSessionUser, getPhotographerByEmail } from '@/lib/auth/getPhotographer'
import SettingsForm from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  const photographer = await getPhotographerByEmail(user!.email!)

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-stone-800 mb-6">הגדרות</h1>
      <SettingsForm photographer={photographer} />
    </div>
  )
}
