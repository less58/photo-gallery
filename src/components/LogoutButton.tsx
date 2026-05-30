'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/auth/login')
    setTimeout(() => window.location.assign('/auth/login'), 50)
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
