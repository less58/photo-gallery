'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import EmailInput from './EmailInput'
import { useToast } from './Toast'

type Photographer = {
  id: string; name: string; email: string
  brand_color: string; logo_url: string | null; logo_public_id: string | null
  watermark_url: string | null; watermark_public_id: string | null
  default_instructions: string | null
  send_client_emails: boolean
  email_provider: string | null
  gmail_address: string | null; gmail_app_password: string | null
  sender_email: string | null; resend_api_key: string | null
  email_subject: string | null; email_body: string | null
  sender_display_name: string | null
  receive_selection_emails: boolean | null
  allow_client_download: boolean | null
}

export default function SettingsForm({ photographer: ph }: { photographer: Photographer }) {
  const toast = useToast()
  const router = useRouter()

  const [name, setName] = useState(ph.name)
  const [logoUrl, setLogoUrl] = useState(ph.logo_url)
  const [logoColors, setLogoColors] = useState<string[]>([])
  const [brandColor, setBrandColor] = useState(ph.brand_color || '#D4736A')
  const [watermarkUrl, setWatermarkUrl] = useState(ph.watermark_url)
  const [watermarkPublicId, setWatermarkPublicId] = useState(ph.watermark_public_id)
  const [defaultInstructions, setDefaultInstructions] = useState(ph.default_instructions || '')
  const [senderDisplayName, setSenderDisplayName] = useState(ph.sender_display_name || ph.name || '')
  const [sendEmails, setSendEmails] = useState(ph.send_client_emails || false)
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'resend'>((ph.email_provider as 'gmail' | 'resend') || 'gmail')
  const [gmailAddress, setGmailAddress] = useState(ph.gmail_address || '')
  const [gmailAppPassword, setGmailAppPassword] = useState(ph.gmail_app_password || '')
  const [resendKey, setResendKey] = useState(ph.resend_api_key || '')
  const [senderEmail, setSenderEmail] = useState(ph.sender_email || '')
  const [emailSubject, setEmailSubject] = useState(ph.email_subject || 'התמונות שלך מוכנות לבחירה 📷')
  const [emailBody, setEmailBody] = useState(ph.email_body || 'שלום,\n\nהתמונות שלך מוכנות לבחירה!\n\nבברכה,\n{photographer_name}')
  const [receiveSelectionEmails, setReceiveSelectionEmails] = useState(ph.receive_selection_emails !== false)
  const [allowClientDownload, setAllowClientDownload] = useState(ph.allow_client_download === true)
  const [showKey, setShowKey] = useState(false)
  const [showGmailPass, setShowGmailPass] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWatermark, setUploadingWatermark] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const logoRef = useRef<HTMLInputElement>(null)
  const watermarkRef = useRef<HTMLInputElement>(null)

  async function uploadLogo(file: File) {
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'logos')
      fd.append('extractColors', 'true')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('שגיאה בהעלאה')
      const data = await res.json()
      setLogoUrl(data.url)
      if (data.colors?.length) { setLogoColors(data.colors); setBrandColor(data.colors[0]) }
      await fetch('/api/dashboard/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: data.url, logoPublicId: data.publicId, brandColor: data.colors?.[0] || brandColor }),
      })
      toast('הלוגו הועלה בהצלחה')
    } catch {
      toast('שגיאה בהעלאת הלוגו', 'error')
    }
    setUploadingLogo(false)
  }

  async function uploadWatermark(file: File) {
    setUploadingWatermark(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'watermarks')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('העלאה נכשלה')
      const data = await res.json()
      if (!data.url) throw new Error('לא התקבל URL')
      setWatermarkUrl(data.url)
      setWatermarkPublicId(data.publicId)
      const patch = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watermarkUrl: data.url, watermarkPublicId: data.publicId }),
      })
      if (!patch.ok) {
        const err = await patch.json().catch(() => ({}))
        throw new Error(err.error || 'שגיאה בשמירה')
      }
      toast('סימן המים הועלה ונשמר בהצלחה ✓')
    } catch (e) {
      toast(`שגיאה בסימן המים: ${(e as Error).message}`, 'error')
    }
    setUploadingWatermark(false)
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, brandColor,
        logoUrl: logoUrl || null,
        watermarkUrl: watermarkUrl || null,
        watermarkPublicId: watermarkPublicId || null,
        defaultInstructions: defaultInstructions || null,
        sendClientEmails: sendEmails,
        senderDisplayName: senderDisplayName || ph.name,
        emailProvider,
        gmailAddress: gmailAddress || null,
        gmailAppPassword: gmailAppPassword || null,
        resendApiKey: resendKey || null,
        senderEmail: senderEmail || null,
        emailSubject, emailBody,
        receiveSelectionEmails,
        allowClientDownload,
      }),
    })
    setSaving(false)
    const result = await res.json()
    if (res.ok) {
      if (result.missingColumns?.length) {
        toast('חלק מהשדות נשמרו — עמודות חסרות בDB. הרץ את ה-SQL למטה.', 'info')
      } else {
        toast('ההגדרות נשמרו ✓')
      }
      router.refresh()
    } else {
      toast(`שגיאה בשמירה: ${result.error}`, 'error')
    }
  }

  async function changePassword() {
    if (newPassword.length < 6) return
    setChangingPw(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPw(false)
    if (error) toast('שגיאה בשינוי הסיסמה', 'error')
    else { setNewPassword(''); toast('הסיסמה עודכנה בהצלחה') }
  }

  return (
    <form onSubmit={saveAll} className="space-y-4">

      {/* ── Identity ── */}
      <Section title="פרטי זהות">
        <Field label="שם תצוגה">
          <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="שמך" />
        </Field>
        <Field label="כתובת מייל">
          <div className={inp + ' bg-stone-50 text-stone-400 cursor-default'} dir="ltr">{ph.email}</div>
        </Field>
      </Section>

      {/* ── Password ── */}
      <Section title="שינוי סיסמה">
        <Field label="סיסמה חדשה" hint="לפחות 6 תווים">
          <div className="flex gap-2">
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className={inp + ' flex-1'} placeholder="••••••" dir="ltr" />
            <button type="button" onClick={changePassword} disabled={changingPw || newPassword.length < 6}
              className={btn + ' px-5 py-0 disabled:opacity-30'} style={{ background: 'var(--brand)' }}>
              {changingPw ? '...' : 'עדכן'}
            </button>
          </div>
          {newPassword.length > 0 && newPassword.length < 6 && (
            <p className="text-xs text-amber-500 mt-1">עוד {6 - newPassword.length} תווים לפחות</p>
          )}
        </Field>
      </Section>

      {/* ── Branding ── */}
      <Section title="מיתוג">
        <Field label="לוגו">
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border border-stone-100 bg-stone-50 relative overflow-hidden">
                <Image src={logoUrl} alt="לוגו" fill className="object-contain p-2" unoptimized />
              </div>
              <button type="button" onClick={() => logoRef.current?.click()}
                className="text-xs text-stone-400 hover:text-rose-500 transition underline">
                החלפה
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-dashed border-stone-200 text-stone-400 hover:border-rose-300 hover:text-rose-400 transition text-sm">
              <Upload size={15} />
              {uploadingLogo ? 'מעלה...' : 'העלי לוגו (PNG / JPG)'}
            </button>
          )}
          <input ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </Field>

        <Field label="צבע מותג">
          {logoColors.length > 0 && (
            <p className="text-[11px] text-stone-400 mb-2">הופק מהלוגו — לחצי לבחירה</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {logoColors.map(c => (
              <button key={c} type="button" onClick={() => setBrandColor(c)}
                className="w-7 h-7 rounded border-2 transition-all"
                style={{ background: c, borderColor: brandColor === c ? '#1c1917' : 'transparent' }} />
            ))}
            <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-2 py-1 bg-white">
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
              <span className="text-xs font-mono text-stone-500" dir="ltr">{brandColor}</span>
            </div>
          </div>
        </Field>
      </Section>

      {/* ── Watermark ── */}
      <Section title="סימן מים">
        <p className="text-xs text-stone-400 -mt-2 mb-3">PNG עם רקע שקוף — יוחל על כל תמונה שתעלי ללקוחות</p>
        {watermarkUrl ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-stone-100 relative"
              style={{ backgroundImage: 'repeating-conic-gradient(#e7e5e4 0% 25%, white 0% 50%)', backgroundSize: '12px 12px' }}>
              <Image src={watermarkUrl} alt="watermark" fill className="object-contain p-2" unoptimized />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-600">סימן מים פעיל</p>
              <button type="button" onClick={() => watermarkRef.current?.click()}
                className="text-xs text-stone-400 hover:text-rose-500 transition underline mt-1">
                החלפה
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => watermarkRef.current?.click()} disabled={uploadingWatermark}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-dashed border-stone-200 text-stone-400 hover:border-rose-300 hover:text-rose-400 transition text-sm">
            <Upload size={15} />
            {uploadingWatermark ? 'מעלה...' : 'העלי PNG שקוף'}
          </button>
        )}
        <input ref={watermarkRef} type="file" accept="image/png" className="hidden"
          onChange={e => e.target.files?.[0] && uploadWatermark(e.target.files[0])} />
      </Section>

      {/* ── Default Instructions ── */}
      <Section title="הוראות ברירת מחדל">
        <p className="text-xs text-stone-400 -mt-2 mb-3">יופיעו אוטומטית בכל תיק חדש — ניתן לשנות לכל תיק בנפרד</p>
        <textarea value={defaultInstructions} onChange={e => setDefaultInstructions(e.target.value)}
          className={inp + ' resize-none'} rows={3}
          placeholder="למשל: אנא בחרי עד 30 תמונות שהכי אהבת 💕" />
      </Section>

      {/* ── Email Notifications ── */}
      <Section title="שליחת מיילים ללקוחות">

        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative shrink-0" onClick={() => setSendEmails(v => !v)}>
            <div className="w-10 h-[22px] rounded-full transition-colors"
              style={{ background: sendEmails ? 'var(--brand)' : '#D6D3D1' }} />
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${sendEmails ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
          </div>
          <span className="text-sm text-stone-700">שלח מייל עם סיסמה ללקוחה בעת יצירת תיק</span>
        </label>

        {sendEmails && (
          <div className="space-y-5 pt-4 border-t border-stone-100">

            {/* Sender display name */}
            <Field label='שם שולח (יוצג ללקוחה)' hint='למשל: "סטודיו ניניטה"'>
              <input value={senderDisplayName} onChange={e => setSenderDisplayName(e.target.value)}
                className={inp} placeholder={ph.name || 'שם הצלמת'} />
              <p className="text-[11px] text-stone-400 mt-1">
                הלקוחה תראה: <span className="font-medium text-stone-600">"{senderDisplayName || ph.name}" &lt;email&gt;</span>
              </p>
            </Field>

            {/* Provider selector */}
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">שירות שליחה</p>
              <div className="grid grid-cols-2 gap-2">
                {(['gmail', 'resend'] as const).map(p => (
                  <button key={p} type="button" onClick={() => setEmailProvider(p)}
                    className="py-2.5 rounded-lg border text-sm font-medium transition-all"
                    style={emailProvider === p
                      ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                      : { borderColor: '#E7E5E4', color: '#78716C' }}>
                    {p === 'gmail' ? '📧 Gmail (מומלץ)' : '⚡ Resend'}
                  </button>
                ))}
              </div>
            </div>

            {/* Gmail setup */}
            {emailProvider === 'gmail' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 leading-5 border border-blue-100">
                  <strong>איך מגדירים Gmail:</strong><br />
                  1. כנסי ל-<strong>myaccount.google.com</strong><br />
                  2. אבטחה ← אימות דו-שלבי ← הפעלה<br />
                  3. אבטחה ← סיסמאות לאפליקציות ← Gmail ← מחשב Windows<br />
                  4. העתיקי את 16 הספרות שיופיעו
                </div>
                <Field label="כתובת Gmail שלך">
                  <EmailInput value={gmailAddress} onChange={setGmailAddress}
                    className={inp} placeholder="yourname@gmail.com" />
                </Field>
                <Field label="App Password (16 תווים)">
                  <div className="relative">
                    <input type={showGmailPass ? 'text' : 'password'}
                      value={gmailAppPassword} onChange={e => setGmailAppPassword(e.target.value)}
                      className={inp + ' pl-9'} placeholder="xxxx xxxx xxxx xxxx" dir="ltr" />
                    <button type="button" onClick={() => setShowGmailPass(v => !v)}
                      className="absolute top-1/2 -translate-y-1/2 left-3 text-stone-300 hover:text-stone-500">
                      {showGmailPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              </div>
            )}

            {/* Resend setup */}
            {emailProvider === 'resend' && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700 leading-5 border border-amber-100">
                  <strong>הערה:</strong> Resend דורש domain מאומת לשליחה. ללא domain — ניתן לשלוח רק לאימייל שלך עצמך.
                </div>
                <Field label="Resend API Key">
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} value={resendKey}
                      onChange={e => setResendKey(e.target.value)}
                      className={inp + ' pl-9'} placeholder="re_xxxxxxxxxxxxxxxx" dir="ltr" />
                    <button type="button" onClick={() => setShowKey(v => !v)}
                      className="absolute top-1/2 -translate-y-1/2 left-3 text-stone-300 hover:text-stone-500">
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
                <Field label="מייל שולח (מ-domain מאומת)">
                  <EmailInput value={senderEmail} onChange={setSenderEmail}
                    className={inp} placeholder="noreply@yourdomain.com" />
                </Field>
              </div>
            )}

            {/* Email template */}
            <div className="pt-3 border-t border-stone-100 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">נוסח המייל</p>
              <Field label="כותרת" hint="{portfolio_name}">
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className={inp} placeholder="התמונות שלך מוכנות לבחירה 📷" />
              </Field>
              <Field label="גוף ההודעה" hint="{photographer_name} · {client_email}">
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  className={inp + ' resize-none text-xs leading-6'} rows={4} />
                <p className="text-[11px] text-stone-400 mt-1">הסיסמה והקישור נוספים אוטומטית בסוף</p>
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* ── Client experience ── */}
      <Section title="חווית לקוחה">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative shrink-0" onClick={() => setReceiveSelectionEmails(v => !v)}>
            <div className="w-10 h-[22px] rounded-full transition-colors"
              style={{ background: receiveSelectionEmails ? 'var(--brand)' : '#D6D3D1' }} />
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${receiveSelectionEmails ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
          </div>
          <div>
            <span className="text-sm text-stone-700">הצגת כפתור "שלח לצלמת" ללקוחה</span>
            <p className="text-xs text-stone-400 mt-0.5">כשמופעל, הלקוחה תוכל לשלוח לך הודעה עם רשימת התמונות שבחרה</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative shrink-0" onClick={() => setAllowClientDownload(v => !v)}>
            <div className="w-10 h-[22px] rounded-full transition-colors"
              style={{ background: allowClientDownload ? 'var(--brand)' : '#D6D3D1' }} />
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${allowClientDownload ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
          </div>
          <div>
            <span className="text-sm text-stone-700">אפשרי ללקוחה להוריד את התמונות שבחרה</span>
            <p className="text-xs text-stone-400 mt-0.5">ירד קובץ ZIP עם כל התמונות הנבחרות (כולל סימן מים)</p>
          </div>
        </label>
      </Section>

      {/* ── Save ── */}
      <button type="submit" disabled={saving}
        className={btn + ' w-full py-3 mt-2'} style={{ background: 'var(--brand)' }}>
        {saving ? 'שומר...' : 'שמור שינויים'}
      </button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-100 bg-stone-50">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">
        {label}
        {hint && <span className="text-stone-400 font-normal text-xs mr-1.5 font-mono">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition text-sm placeholder:text-stone-300'
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer'
