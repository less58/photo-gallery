import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-stone-300">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
}
