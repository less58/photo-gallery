import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewPortfolioForm from '@/components/NewPortfolioForm'

export default async function NewPortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: photographer } = await supabase
    .from('photographers')
    .select('default_instructions, is_frozen')
    .eq('email', user!.email!)
    .single()

  if ((photographer as { is_frozen?: boolean } | null)?.is_frozen) {
    redirect('/dashboard')
  }

  const defaultInstructions = (photographer as { default_instructions?: string } | null)
    ?.default_instructions || ''

  return <NewPortfolioForm defaultInstructions={defaultInstructions} />
}
