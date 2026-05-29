'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="p-2 rounded-xl text-stone-400 hover:text-red-400 hover:bg-red-50 transition-colors"
      title="יציאה"
    >
      <LogOut size={18} />
    </button>
  )
}
