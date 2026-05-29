import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
})

export const metadata: Metadata = {
  title: 'Select it — בחירת תמונות',
  description: 'את בוחרת את הרגעים שלך',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen font-sans antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
