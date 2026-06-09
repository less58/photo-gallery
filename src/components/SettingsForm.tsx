'use client'

import { useState, useRef, useEffect } from 'react'
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
  watermark_type: string | null; watermark_text: string | null
  watermark_opacity: number | null; watermark_position: string | null
  watermark_font_size: number | null; watermark_color: string | null
  watermark_x: number | null; watermark_y: number | null
  watermark_rotation: number | null; watermark_image_opacity: number | null
  default_instructions: string | null
  send_client_emails: boolean
  email_provider: string | null
  gmail_address: string | null; gmail_app_password: string | null
  sender_email: string | null; resend_api_key: string | null
  email_subject: string | null; email_body: string | null
  email_album_subject?: string | null; email_album_body?: string | null
  sender_display_name: string | null
  receive_selection_emails: boolean | null
  enable_collages: boolean | null
  allow_album_download: boolean | null
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
  const [watermarkType, setWatermarkType] = useState<'image' | 'text'>((ph.watermark_type as 'image' | 'text') ?? 'image')
  const [watermarkText, setWatermarkText] = useState(ph.watermark_text ?? '')
  const [watermarkOpacity, setWatermarkOpacity] = useState(ph.watermark_opacity ?? 30)
  const [watermarkPosition, setWatermarkPosition] = useState(ph.watermark_position ?? 'free')
  const [watermarkFontSize, setWatermarkFontSize] = useState(ph.watermark_font_size ?? 120)
  const [watermarkColor, setWatermarkColor] = useState(ph.watermark_color ?? '#ffffff')
  const [watermarkX, setWatermarkX] = useState(ph.watermark_x ?? 0.5)
  const [watermarkY, setWatermarkY] = useState(ph.watermark_y ?? 0.85)
  const [watermarkRotation, setWatermarkRotation] = useState(ph.watermark_rotation ?? 0)
  const [watermarkImageOpacity, setWatermarkImageOpacity] = useState(ph.watermark_image_opacity ?? 20)
  const [wmInteraction, setWmInteraction] = useState<'drag' | 'resize' | 'rotate' | null>(null)
  const [defaultInstructions, setDefaultInstructions] = useState(ph.default_instructions || '')
  const [senderDisplayName, setSenderDisplayName] = useState(ph.sender_display_name || ph.name || '')
  const [sendEmails, setSendEmails] = useState(ph.send_client_emails || false)
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'resend'>((ph.email_provider as 'gmail' | 'resend') || 'gmail')
  const [gmailAddress, setGmailAddress] = useState(ph.gmail_address || '')
  const [gmailAppPassword, setGmailAppPassword] = useState(ph.gmail_app_password || '')
  const [resendKey, setResendKey] = useState(ph.resend_api_key || '')
  const [senderEmail, setSenderEmail] = useState(ph.sender_email || '')
  const [emailSubject, setEmailSubject] = useState(ph.email_subject || 'הגלריה שלך מוכנה! הגיע הזמן לבחור את התמונות המנצחות')
  const [emailBody, setEmailBody] = useState(ph.email_body || 'היי,\n\nאיזה כיף להיזכר ברגעים המשותפים שלנו! הגלריה עם כל התמונות מהצילומים שלנו מוכנה עבורך בקישור המצורף: [לינק לאתר].\nכדי להיכנס, השתמשי בקוד האישי שלך: [הקוד].\n\nאיך הכי נוח לבחור?\nיצרתי עבורך מערכת בחירה חכמה שתעזור לך להחליט בקלות:\n\nהשוואה: אם את מתלבטת בין שתי תמונות דומות, השתמשי באופציית ה"השוואה" כדי לראות אותן זו לצד זו ולבחור את הטובה ביותר.\n\nסימון "V": לתמונות שאת בטוחה שאת רוצה באלבום.\n\nסימון "?" : לתמונות שאת מתלבטת לגביהן. נוכל לעבור עליהן יחד בהמשך.\n\nסימון "X": לתמונות שפחות אהבת, כדי שנוכל להסיר אותן מהסינון הסופי.\n\nכמה דגשים קטנים:\n\nכמות: זכרי לבחור [כמות] תמונות, בהתאם לחבילה שבחרנו.\n\nשאלות: אם יש לך תמונה שאת מתלבטת לגביה, או שתרצי שאעזור לך להחליט – אני כאן לכל שאלה (שימי לב שיש צאט בתוך המערכת)\n\nובסיום – אל תשכחי לשלוח לי את הרשימה הסופית דרך האתר אך בכל זאת אני תמיד רואה את הבחירות שלך גם ללא השליחה\n\nאם משהו לא ברור או שאת זקוקה לעזרה טכנית בהתמצאות בגלריה, אני זמינה כאן לכל שאלה.\n\nמחכה לראות את הבחירות המדויקות שלך!\n\nבאהבה,\n{photographer_name}')
  const [emailAlbumSubject, setEmailAlbumSubject] = useState(ph.email_album_subject || 'האלבום שלך מוכן לצפייה 📸')
  const [emailAlbumBody, setEmailAlbumBody] = useState(ph.email_album_body || 'שלום,\n\nהאלבום שלך מוכן! ניתן לצפות בו דרך הקישור שלמטה.\n\nבברכה,\n{photographer_name}')
  const [settingsTab, setSettingsTab] = useState<'design' | 'email' | 'general'>('design')
  const [receiveSelectionEmails, setReceiveSelectionEmails] = useState(ph.receive_selection_emails !== false)
  const [enableCollages, setEnableCollages] = useState(ph.enable_collages !== false)
  const [allowAlbumDownload, setAllowAlbumDownload] = useState(ph.allow_album_download === true)
  const [showKey, setShowKey] = useState(false)
  const [showGmailPass, setShowGmailPass] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWatermark, setUploadingWatermark] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const logoRef = useRef<HTMLInputElement>(null)
  const watermarkRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const wmStartRef = useRef<{ clientX: number; clientY: number; x: number; y: number; size: number } | null>(null)

  const FONT_SCALE = 4 // Cloudinary px → preview px

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

  // ── Watermark drag / resize / rotate ──
  useEffect(() => {
    if (!wmInteraction) return
    function onMove(e: MouseEvent) {
      const ref = wmStartRef.current
      if (!ref || !previewRef.current) return
      const rect = previewRef.current.getBoundingClientRect()
      if (wmInteraction === 'drag') {
        setWatermarkX(Math.max(0.05, Math.min(0.95, ref.x + (e.clientX - ref.clientX) / rect.width)))
        setWatermarkY(Math.max(0.05, Math.min(0.95, ref.y + (e.clientY - ref.clientY) / rect.height)))
      }
      if (wmInteraction === 'resize') {
        const textX = ref.x * rect.width + rect.left
        const textY = ref.y * rect.height + rect.top
        const d0 = Math.hypot(ref.clientX - textX, ref.clientY - textY)
        const d1 = Math.hypot(e.clientX - textX, e.clientY - textY)
        if (d0 > 2) setWatermarkFontSize(Math.max(20, Math.min(600, Math.round(ref.size * d1 / d0))))
      }
      if (wmInteraction === 'rotate') {
        const textX = ref.x * rect.width + rect.left
        const textY = ref.y * rect.height + rect.top
        const angle = Math.atan2(e.clientY - textY, e.clientX - textX) * 180 / Math.PI + 90
        setWatermarkRotation(Math.round(angle))
      }
    }
    function onUp() { setWmInteraction(null); wmStartRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [wmInteraction])

  function startWmDrag(e: React.MouseEvent) {
    if (watermarkPosition === 'tiled') return
    e.preventDefault()
    wmStartRef.current = { clientX: e.clientX, clientY: e.clientY, x: watermarkX, y: watermarkY, size: watermarkFontSize }
    setWmInteraction('drag')
  }
  function startWmResize(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    wmStartRef.current = { clientX: e.clientX, clientY: e.clientY, x: watermarkX, y: watermarkY, size: watermarkFontSize }
    setWmInteraction('resize')
  }
  function startWmRotate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    wmStartRef.current = { clientX: e.clientX, clientY: e.clientY, x: watermarkX, y: watermarkY, size: watermarkFontSize }
    setWmInteraction('rotate')
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
        watermarkType,
        watermarkText: watermarkText || null,
        watermarkOpacity,
        watermarkPosition,
        watermarkFontSize,
        watermarkColor,
        watermarkX,
        watermarkY,
        watermarkRotation,
        watermarkImageOpacity,
        defaultInstructions: defaultInstructions || null,
        sendClientEmails: sendEmails,
        senderDisplayName: senderDisplayName || ph.name,
        emailProvider,
        gmailAddress: gmailAddress || null,
        gmailAppPassword: gmailAppPassword || null,
        resendApiKey: resendKey || null,
        senderEmail: senderEmail || null,
        emailSubject, emailBody,
        emailAlbumSubject, emailAlbumBody,
        receiveSelectionEmails,
        enableCollages,
        allowAlbumDownload,
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

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f5f5f4' }}>
        {([['design', 'עיצוב'], ['email', 'מיילים'], ['general', 'כללי']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSettingsTab(key)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={settingsTab === key
              ? { background: 'var(--brand)', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
              : { color: '#78716C' }}
          >
            {label}
          </button>
        ))}
      </div>

      {settingsTab === 'design' && <>

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
        <p className="text-xs text-stone-400 -mt-2 mb-3">יוחל אוטומטית על כל תמונה שתעלי ללקוחות</p>

        {/* Type tabs */}
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg mb-3 w-fit">
          {([['image', '🖼 תמונה PNG'], ['text', 'Aa טקסט']] as const).map(([t, label]) => (
            <button key={t} type="button" onClick={() => setWatermarkType(t)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={watermarkType === t
                ? { background: '#fff', color: 'var(--brand)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                : { color: '#78716c' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Live preview box ── */}
        <div
          ref={previewRef}
          className="relative rounded-xl overflow-hidden mb-4 select-none"
          style={{
            aspectRatio: '3/2',
            background: 'linear-gradient(160deg, #4b5563 0%, #1f2937 55%, #374151 100%)',
            cursor: wmInteraction === 'drag' ? 'grabbing' : 'default',
          }}
        >
          {/* Rule-of-thirds grid overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '33.33% 33.33%' }} />

          {/* Image watermark preview */}
          {watermarkType === 'image' && watermarkUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={watermarkUrl} alt="" style={{ width: '60%', opacity: watermarkImageOpacity / 100, objectFit: 'contain' }} />
            </div>
          )}

          {/* Text watermark – free position (draggable) */}
          {watermarkType === 'text' && watermarkText && watermarkPosition !== 'tiled' && (
            <div
              className="absolute"
              style={{
                left: `${watermarkX * 100}%`,
                top: `${watermarkY * 100}%`,
                transform: `translate(-50%,-50%) rotate(${watermarkRotation}deg)`,
                fontSize: `${watermarkFontSize / FONT_SCALE}px`,
                color: watermarkColor,
                opacity: watermarkOpacity / 100,
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 5px rgba(0,0,0,0.9)',
                cursor: 'grab',
                userSelect: 'none',
              }}
              onMouseDown={startWmDrag}
            >
              {watermarkText}

              {/* Rotate handle – top center */}
              <div
                className="absolute flex flex-col items-center"
                style={{ left: '50%', top: -26, transform: 'translateX(-50%)', cursor: 'grab' }}
                onMouseDown={startWmRotate}
              >
                <div className="w-px h-3 bg-white/50" />
                <div className="w-3.5 h-3.5 rounded-full bg-white/90 border-2 border-blue-400 shadow" />
              </div>

              {/* Resize handle – bottom right */}
              <div
                className="absolute"
                style={{ right: -10, bottom: -10, cursor: 'se-resize' }}
                onMouseDown={startWmResize}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white/90 border-2 shadow" style={{ borderColor: 'var(--brand)' }} />
              </div>
            </div>
          )}

          {/* Text watermark – tiled preview */}
          {watermarkType === 'text' && watermarkText && watermarkPosition === 'tiled' && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
              <div style={{
                transform: 'rotate(-22deg)',
                fontSize: `${watermarkFontSize / FONT_SCALE}px`,
                color: watermarkColor,
                opacity: watermarkOpacity / 100,
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 5px rgba(0,0,0,0.9)',
                letterSpacing: '0.35em',
              }}>
                {`${watermarkText}  ·  ${watermarkText}  ·  ${watermarkText}`}
              </div>
            </div>
          )}

          {/* Empty state hints */}
          {((watermarkType === 'text' && !watermarkText) || (watermarkType === 'image' && !watermarkUrl)) && (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs pointer-events-none">
              {watermarkType === 'text' ? 'כתבי טקסט למטה לצפייה' : 'העלי תמונה לצפייה'}
            </div>
          )}
        </div>

        {/* ── Image mode controls ── */}
        {watermarkType === 'image' && (
          <>
            {watermarkUrl ? (
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 rounded-lg border border-stone-100 relative shrink-0"
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
                className="flex items-center gap-2 w-full px-4 py-3 mb-3 rounded-lg border border-dashed border-stone-200 text-stone-400 hover:border-rose-300 hover:text-rose-400 transition text-sm">
                <Upload size={15} />
                {uploadingWatermark ? 'מעלה...' : 'העלי PNG שקוף'}
              </button>
            )}
            <input ref={watermarkRef} type="file" accept="image/png" className="hidden"
              onChange={e => e.target.files?.[0] && uploadWatermark(e.target.files[0])} />

            <Field label={`שקיפות: ${watermarkImageOpacity}%`}>
              <input type="range" min={0} max={100} value={watermarkImageOpacity}
                onChange={e => setWatermarkImageOpacity(Number(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-stone-300 mt-0.5">
                <span>בלתי נראה</span><span>כמו שהועלה</span>
              </div>
            </Field>
          </>
        )}

        {/* ── Text mode controls ── */}
        {watermarkType === 'text' && (
          <div className="space-y-4">
            <Field label="טקסט סימן המים">
              <input value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
                className={inp} placeholder="שם הסטודיו / הצלמת" dir="auto" />
            </Field>

            <Field label={`שקיפות: ${watermarkOpacity}%`}>
              <input type="range" min={5} max={70} value={watermarkOpacity}
                onChange={e => setWatermarkOpacity(Number(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-stone-300 mt-0.5">
                <span>עדין מאוד</span><span>בולט</span>
              </div>
            </Field>

            <Field label="צבע טקסט">
              <div className="flex items-center gap-3 flex-wrap">
                {(['#ffffff', '#000000', '#888888'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setWatermarkColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: watermarkColor === c ? 'var(--brand)' : '#d6d3d1' }} />
                ))}
                <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-2 py-1 bg-white">
                  <input type="color" value={watermarkColor} onChange={e => setWatermarkColor(e.target.value)}
                    className="w-6 h-6 cursor-pointer border-0 bg-transparent p-0" />
                  <span className="text-xs font-mono text-stone-500" dir="ltr">{watermarkColor}</span>
                </div>
              </div>
            </Field>

            {/* Tiled toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative shrink-0"
                onClick={() => setWatermarkPosition(watermarkPosition === 'tiled' ? 'free' : 'tiled')}>
                <div className="w-10 h-[22px] rounded-full transition-colors"
                  style={{ background: watermarkPosition === 'tiled' ? 'var(--brand)' : '#D6D3D1' }} />
                <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${watermarkPosition === 'tiled' ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
              </div>
              <span className="text-sm text-stone-700">⊞ כיסוי מלא — טקסט חוזר על פני כל התמונה</span>
            </label>

            {watermarkPosition !== 'tiled' && (
              <p className="text-[11px] text-stone-400 bg-stone-50 rounded-lg px-3 py-2 border border-stone-100 leading-5">
                <strong className="text-stone-500">גרור</strong> את הטקסט בתצוגה לשינוי מיקום ·{' '}
                <strong className="text-blue-400">נקודה כחולה</strong> לסיבוב ·{' '}
                <strong className="text-rose-400">נקודה ורודה</strong> לשינוי גודל
              </p>
            )}

            <p className="text-[11px] text-stone-400 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
              סימן המים מוטמע בתמונה בעת ההעלאה — שינויים יחולו על תמונות חדשות בלבד
            </p>
          </div>
        )}
      </Section>

      {/* ── Default Instructions ── */}
      <Section title="הוראות ברירת מחדל">
        <p className="text-xs text-stone-400 -mt-2 mb-3">יופיעו אוטומטית בכל תיק חדש — ניתן לשנות לכל תיק בנפרד</p>
        <textarea value={defaultInstructions} onChange={e => setDefaultInstructions(e.target.value)}
          className={inp + ' resize-none'} rows={3}
          placeholder="למשל: אנא בחרי עד 30 תמונות שהכי אהבת 💕" />
      </Section>

      </> /* end design tab */}

      {settingsTab === 'email' && <>

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

            {/* Album email template */}
            <div className="pt-3 border-t border-stone-100 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">תבנית מייל — אלבום</p>
              <p className="text-xs text-stone-400 -mt-1">נשלח כשלוחצים "שלח מייל אלבום" בתיק הלקוחה</p>
              <Field label="כותרת" hint="{portfolio_name}">
                <input value={emailAlbumSubject} onChange={e => setEmailAlbumSubject(e.target.value)}
                  className={inp} placeholder="האלבום שלך מוכן לצפייה 📸" />
              </Field>
              <Field label="גוף ההודעה" hint="{photographer_name}">
                <textarea value={emailAlbumBody} onChange={e => setEmailAlbumBody(e.target.value)}
                  className={inp + ' resize-none text-xs leading-6'} rows={4} />
                <p className="text-[11px] text-stone-400 mt-1">קישור לאלבום נוסף אוטומטית בסוף</p>
              </Field>
            </div>
          </div>
        )}
      </Section>

      </> /* end email tab */}

      {settingsTab === 'general' && <>

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
          <div className="relative shrink-0" onClick={() => setEnableCollages(v => !v)}>
            <div className="w-10 h-[22px] rounded-full transition-colors"
              style={{ background: enableCollages ? 'var(--brand)' : '#D6D3D1' }} />
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${enableCollages ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
          </div>
          <div>
            <span className="text-sm text-stone-700">הצגת טאב קולאג׳ים</span>
            <p className="text-xs text-stone-400 mt-0.5">כשמופעל, יופיע טאב "קולאג׳ים" בתיקים שלך</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative shrink-0" onClick={() => setAllowAlbumDownload(v => !v)}>
            <div className="w-10 h-[22px] rounded-full transition-colors"
              style={{ background: allowAlbumDownload ? 'var(--brand)' : '#D6D3D1' }} />
            <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${allowAlbumDownload ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
          </div>
          <div>
            <span className="text-sm text-stone-700">הורדת אלבומים ללקוחות</span>
            <p className="text-xs text-stone-400 mt-0.5">כשמופעל, הלקוחה תוכל להוריד את האלבום (PDF / ZIP תמונות)</p>
          </div>
        </label>

      </Section>

      </> /* end general tab */}

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
