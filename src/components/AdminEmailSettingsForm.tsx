'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useToast } from './Toast'
import EmailInput from './EmailInput'

const DEFAULT_APPROVAL_SUBJECT = 'ברוכה הבאה! החשבון שלך ב-SELECT IT נפתח'
const DEFAULT_APPROVAL_BODY = `שלום {name},

שמחים לבשר שחשבונך במערכת SELECT IT נפתח!

פרטי כניסה:
מייל: {email}
סיסמה: {password}

כניסה למערכת: {link}

בהצלחה!`

type AdminEmailSettings = {
  name?: string
  send_client_emails?: boolean | null
  email_provider?: string | null
  gmail_address?: string | null
  gmail_app_password?: string | null
  resend_api_key?: string | null
  sender_email?: string | null
  sender_display_name?: string | null
  email_subject?: string | null
  email_body?: string | null
}

export default function AdminEmailSettingsForm({ settings }: { settings: AdminEmailSettings }) {
  const toast = useToast()
  const [sendEmails, setSendEmails] = useState(Boolean(settings.send_client_emails))
  const [provider, setProvider] = useState<'gmail' | 'resend'>((settings.email_provider as 'gmail' | 'resend') || 'gmail')
  const [displayName, setDisplayName] = useState(settings.sender_display_name || settings.name || 'SELECT IT')
  const [gmailAddress, setGmailAddress] = useState(settings.gmail_address || '')
  const [gmailAppPassword, setGmailAppPassword] = useState(settings.gmail_app_password || '')
  const [resendKey, setResendKey] = useState(settings.resend_api_key || '')
  const [senderEmail, setSenderEmail] = useState(settings.sender_email || '')
  const [approvalSubject, setApprovalSubject] = useState(settings.email_subject || DEFAULT_APPROVAL_SUBJECT)
  const [approvalBody, setApprovalBody] = useState(settings.email_body || DEFAULT_APPROVAL_BODY)
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendClientEmails: sendEmails,
          emailProvider: provider,
          senderDisplayName: displayName,
          gmailAddress: gmailAddress || null,
          gmailAppPassword: gmailAppPassword || null,
          resendApiKey: resendKey || null,
          senderEmail: senderEmail || null,
          approvalEmailSubject: approvalSubject || null,
          approvalEmailBody: approvalBody || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'שגיאה בשמירת ההגדרות', 'error')
        return
      }
      toast('הגדרות המייל נשמרו')
    } catch {
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">

      {/* Provider settings */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative shrink-0" onClick={() => setSendEmails(v => !v)}>
            <div className="w-10 h-[22px] rounded-full transition-colors"
              style={{ background: sendEmails ? '#D4736A' : '#D6D3D1' }} />
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${sendEmails ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
          </div>
          <span className="text-sm text-stone-700">שליחת מייל לצלמת בעת יצירת חשבון ידנית</span>
        </label>

        <Field label="שם שולח">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            className={input} placeholder="SELECT IT" />
        </Field>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-stone-500 mb-2">שירות שליחה</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setProvider('gmail')}
              className="py-2.5 rounded-lg border text-sm font-medium transition"
              style={provider === 'gmail'
                ? { background: '#D4736A', color: '#fff', borderColor: '#D4736A' }
                : { borderColor: '#E7E5E4', color: '#78716C' }}>
              Gmail
            </button>
            <button type="button" onClick={() => setProvider('resend')}
              className="py-2.5 rounded-lg border text-sm font-medium transition"
              style={provider === 'resend'
                ? { background: '#D4736A', color: '#fff', borderColor: '#D4736A' }
                : { borderColor: '#E7E5E4', color: '#78716C' }}>
              Resend API
            </button>
          </div>
        </div>

        {provider === 'gmail' ? (
          <>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 leading-6">
              <strong>איך מגדירים Gmail:</strong><br />
              1. כנסי ל-myaccount.google.com<br />
              2. אבטחה ← אימות דו-שלבי ← הפעלה<br />
              3. אבטחה ← סיסמאות לאפליקציות ← Gmail ← מחשב Windows<br />
              4. העתיקי את 16 הספרות שיופיעו
            </div>
            <Field label="כתובת Gmail">
              <EmailInput value={gmailAddress} onChange={setGmailAddress}
                className={input} placeholder="system@gmail.com" />
            </Field>
            <Field label="Gmail App Password">
              <SecretInput value={gmailAppPassword} onChange={setGmailAppPassword}
                show={showSecret} setShow={setShowSecret} placeholder="xxxx xxxx xxxx xxxx" />
            </Field>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700 leading-6">
              ב-Resend צריך API Key ודומיין מאומת. אם אין דומיין מאומת, עדיף להשתמש ב-Gmail.
            </div>
            <Field label="Resend API Key">
              <SecretInput value={resendKey} onChange={setResendKey}
                show={showSecret} setShow={setShowSecret} placeholder="re_xxxxxxxxxxxxxxxx" />
            </Field>
            <Field label="מייל שולח">
              <EmailInput value={senderEmail} onChange={setSenderEmail}
                className={input} placeholder="noreply@yourdomain.com" />
            </Field>
          </>
        )}
      </div>

      {/* Approval email template */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-stone-700 mb-0.5">תבנית מייל אישור חשבון</p>
          <p className="text-xs text-stone-400 mb-3">
            ישלח לצלמת בעת אישור בקשה — ניתן לערוך לפני כל שליחה.
            משתנים: <code className="text-rose-500 text-[11px]">{'{name}'}</code>{' '}
            <code className="text-rose-500 text-[11px]">{'{email}'}</code>{' '}
            <code className="text-rose-500 text-[11px]">{'{password}'}</code>{' '}
            <code className="text-rose-500 text-[11px]">{'{link}'}</code>
          </p>
        </div>
        <Field label="נושא המייל">
          <input value={approvalSubject} onChange={e => setApprovalSubject(e.target.value)}
            className={input} dir="auto" placeholder={DEFAULT_APPROVAL_SUBJECT} />
        </Field>
        <Field label="גוף ההודעה">
          <textarea value={approvalBody} onChange={e => setApprovalBody(e.target.value)}
            className={input + ' resize-none text-xs leading-6'} rows={10} dir="auto" />
        </Field>
        <button
          type="button"
          onClick={() => { setApprovalSubject(DEFAULT_APPROVAL_SUBJECT); setApprovalBody(DEFAULT_APPROVAL_BODY) }}
          className="text-xs text-stone-400 hover:text-stone-600 underline transition"
        >
          איפוס לברירת מחדל
        </button>
      </div>

      <button type="submit" disabled={saving}
        className="w-full py-3 rounded-xl bg-[#D4736A] text-white text-sm font-semibold disabled:opacity-50">
        {saving ? 'שומר...' : 'שמירת הגדרות'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SecretInput({
  value, onChange, show, setShow, placeholder,
}: {
  value: string
  onChange: (value: string) => void
  show: boolean
  setShow: (value: boolean) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)}
        className={input + ' pl-9'} placeholder={placeholder} dir="ltr" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute top-1/2 -translate-y-1/2 left-3 text-stone-300 hover:text-stone-500">
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

const input = 'w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition text-sm placeholder:text-stone-300'
