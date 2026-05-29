import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-warm-white px-4 relative overflow-hidden">

      {/* Soft background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 rounded-full bg-brand-light opacity-40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-brand-light opacity-30 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm">

        {/* Logo */}
        <div className="anim-float flex flex-col items-center gap-1" style={{ animationDelay: '0s' }}>
          <div className="w-52 h-52 relative">
            <Image
              src="/logo.jpg"
              alt="Select it"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Cards */}
        <div className="w-full flex flex-col gap-4 anim-fadeUp" style={{ animationDelay: '0.15s' }}>

          {/* Photographer */}
          <Link
            href="/auth/login"
            className="group relative flex items-center gap-4 bg-white rounded-2xl px-6 py-5 shadow-sm border border-rose-100 hover:shadow-md hover:border-brand transition-all duration-200"
          >
            <span className="text-3xl">📷</span>
            <div className="flex-1">
              <p className="font-semibold text-charcoal text-base">כניסת צלמת</p>
              <p className="text-muted text-xs mt-0.5">ניהול תיקים ולקוחות</p>
            </div>
            <span className="text-brand opacity-0 group-hover:opacity-100 transition-opacity text-xl">←</span>
          </Link>

          {/* Client */}
          <Link
            href="/login"
            className="group relative flex items-center gap-4 bg-white rounded-2xl px-6 py-5 shadow-sm border border-rose-100 hover:shadow-md hover:border-brand transition-all duration-200"
          >
            <span className="text-3xl">🖼️</span>
            <div className="flex-1">
              <p className="font-semibold text-charcoal text-base">כניסת לקוחה</p>
              <p className="text-muted text-xs mt-0.5">צפייה ובחירת תמונות</p>
            </div>
            <span className="text-brand opacity-0 group-hover:opacity-100 transition-opacity text-xl">←</span>
          </Link>

        </div>

        <p className="text-muted text-xs anim-fadeUp" style={{ animationDelay: '0.3s' }}>
          את בוחרת את הרגעים שלך ♥
        </p>
      </div>
    </div>
  )
}
