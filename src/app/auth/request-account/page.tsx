import Link from 'next/link'

export default async function RequestAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  const requestedEmail = email || 'המייל הזה'

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-rose-100 p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-charcoal mb-3">החשבון עדיין לא פתוח</h1>
        <p className="text-muted text-sm leading-7">
          כדי להתחבר למערכת SELECT IT צריך שמנהל העל יפתח חשבון עבור
          <span className="block mt-1 font-mono text-charcoal" dir="ltr">{requestedEmail}</span>
        </p>
        <p className="text-muted text-sm leading-7 mt-4">
          פני למנהל המערכת ובקשי לפתוח חשבון למייל הזה.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex mt-6 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: 'var(--brand)' }}
        >
          חזרה להתחברות
        </Link>
      </div>
    </div>
  )
}
