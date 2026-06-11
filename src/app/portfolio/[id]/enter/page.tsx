import { createAdminClient } from '@/lib/supabase/admin'
import EnterForm from './EnterForm'

const DELETION_DAYS = 45

export default async function PasswordEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: portfolio } = await admin
    .from('portfolios')
    .select('created_at')
    .eq('id', id)
    .maybeSingle()

  const daysRemaining = portfolio?.created_at
    ? DELETION_DAYS - Math.floor((Date.now() - new Date(portfolio.created_at).getTime()) / 86_400_000)
    : null

  return <EnterForm portfolioId={id} daysRemaining={daysRemaining} />
}
