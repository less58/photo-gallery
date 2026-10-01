'use client'

import { usePathname } from 'next/navigation'

// Most dashboard pages are capped in width; the calendar uses the full area
const FULL_WIDTH_PATHS = ['/dashboard/calendar']

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullWidth = FULL_WIDTH_PATHS.some(p => pathname?.startsWith(p))
  return <div className={fullWidth ? 'w-full' : 'max-w-5xl mx-auto'}>{children}</div>
}
