import Link from 'next/link'
import RequestAccountForm from '@/components/RequestAccountForm'

export default async function RequestAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; pending?: string }>
}) {
  const { email, pending } = await searchParams
  const requestedEmail = email || 'המייל הזה'
  const isPending = pending === 'true'

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-rose-100 p-8 text-center shadow-sm">

        {isPending ? (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏳</span>
            </div>
            <h1 className="text-xl font-bold text-charcoal mb-3">הבקשה ממתינה לאישור</h1>
            <p className="text-muted text-sm leading-7">
              שלחת כבר בקשה לפתיחת חשבון עבור
              <span className="block mt-1 font-mono text-charcoal text-xs" dir="ltr">{requestedEmail}</span>
            </p>
            <p className="text-muted text-sm leading-7 mt-3">
              המנהל טרם אישר את הבקשה. יש להמתין בסבלנות — תקבלי מייל כשהחשבון יפתח.
            </p>
            <div className="mt-6 p-3 rounded-xl bg-amber-50 text-amber-700 text-xs leading-6">
              אם עברו יותר מ-48 שעות ולא קיבלת תשובה, צרי קשר ישירות עם מנהל המערכת.
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-charcoal mb-3">החשבון עדיין לא פתוח</h1>
            <p className="text-muted text-sm leading-7">
              כדי להתחבר למערכת SELECT IT צריך שמנהל העל יפתח חשבון עבור
              <span className="block mt-1 font-mono text-charcoal" dir="ltr">{requestedEmail}</span>
            </p>
            <p className="text-muted text-sm leading-7 mt-4">
              מלאי בקשה קצרה והיא תישלח למנהל המערכת.
            </p>
            <RequestAccountForm initialEmail={requestedEmail} />
          </>
        )}

        <Link
          href="/auth/login"
          className="inline-flex mt-5 text-muted text-sm hover:text-brand transition"
        >
          חזרה להתחברות
        </Link>
      </div>
    </div>
  )
}
