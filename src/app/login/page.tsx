import Image from 'next/image'
import Link from 'next/link'

export default function ClientLoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#FAFAF9' }}>
      <div className="w-full max-w-sm text-center anim-fadeUp">
        <div className="flex justify-center mb-8">
          <div className="w-28 h-28 relative">
            <Image src="/logo.jpg" alt="Select it" fill className="object-contain" unoptimized />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-stone-800 mb-2">יש להיכנס דרך המייל</h1>
          <p className="text-stone-500 text-sm leading-relaxed">
            הצלמת שלך שלחה לך מייל עם קישור ישיר לתיק.
            <br />
            לחצי על הכפתור במייל כדי להיכנס.
          </p>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-stone-400 text-sm hover:text-stone-600 transition">
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  )
}
