import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { UploadProvider } from '@/context/UploadContext'
import UploadProgressPanel from '@/components/UploadProgressPanel'

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
        <UploadProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
          <UploadProgressPanel />
        </UploadProvider>
      </body>
    </html>
  )
}
