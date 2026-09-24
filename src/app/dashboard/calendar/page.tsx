import { getSessionUser, getPhotographerByEmail } from '@/lib/auth/getPhotographer'
import CalendarView from '@/components/CalendarView'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const user = await getSessionUser()
  const photographer = user ? await getPhotographerByEmail(user.email!) : null

  return <CalendarView color={photographer?.brand_color || '#D4736A'} />
}
