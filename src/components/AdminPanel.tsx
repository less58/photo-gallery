'use client'

import { useState } from 'react'
import { Check, Plus, Camera, FolderOpen, X, Lock, LockOpen, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import EmailInput from './EmailInput'
import { useToast } from './Toast'

const DEFAULT_APPROVAL_SUBJECT = 'ברוכה הבאה! החשבון שלך ב-SELECT IT נפתח'
const DEFAULT_APPROVAL_BODY = `שלום {name},

שמחים לבשר שחשבונך במערכת SELECT IT נפתח!

פרטי כניסה:
מייל: {email}
סיסמה: {password}

כניסה למערכת: {link}

בהצלחה!`

type Photographer = {
  id: string
  name: string
  email: string
  brand_color: string
  created_at: string
  is_frozen: boolean
  portfolioCount: number
}

type AccountRequest = {
  id: string
  name: string
  email: string
  details: string | null
  status: string
  created_at: string
}

type ApprovalModal = {
  req: AccountRequest
  password: string
  subject: string
  body: string
}

function fillTemplate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), template)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminPanel({
  initialPhotographers,
  initialRequests,
  approvalEmailTemplate,
}: {
  initialPhotographers: Photographer[]
  initialRequests: AccountRequest[]
  approvalEmailTemplate: { subject: string | null; body: string | null } | null
}) {
  const toast = useToast()
  const [list, setList] = useState(initialPhotographers)
  const [requests, setRequests] = useState(initialRequests)
  const [showModal, setShowModal] = useState(false)
  const [approvalModal, setApprovalModal] = useState<ApprovalModal | null>(null)
  const [approvingModal, setApprovingModal] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function toggleFreeze(p: Photographer) {
    setToggling(p.id)
    const nextFrozen = !p.is_frozen
    const res = await fetch(`/api/admin/photographer/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_frozen: nextFrozen }),
    })
    if (res.ok) {
      setList(l => l.map(x => x.id === p.id ? { ...x, is_frozen: nextFrozen } : x))
    }
    setToggling(null)
  }

  async function addPhotographer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/admin/photographer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error); setSaving(false); return }
    setList(prev => [{ ...data, portfolioCount: 0, is_frozen: false }, ...prev])
    setForm({ name: '', email: '', password: '' })
    setShowModal(false)
    setSaving(false)
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    const bytes = new Uint8Array(10)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => chars[b % chars.length]).join('')
  }

  function startApprove(req: AccountRequest) {
    const password = generatePassword()
    const vars: Record<string, string> = {
      name: req.name,
      email: req.email,
      password,
      link: (typeof window !== 'undefined' ? window.location.origin : '') + '/auth/login',
    }
    setApprovalModal({
      req,
      password,
      subject: fillTemplate(approvalEmailTemplate?.subject || DEFAULT_APPROVAL_SUBJECT, vars),
      body: fillTemplate(approvalEmailTemplate?.body || DEFAULT_APPROVAL_BODY, vars),
    })
    setFormError('')
  }

  async function confirmApprove(sendEmail: boolean) {
    if (!approvalModal) return
    setApprovingModal(true)
    setFormError('')

    const createRes = await fetch('/api/admin/photographer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: approvalModal.req.name,
        email: approvalModal.req.email,
        password: approvalModal.password,
        skipEmail: true,
      }),
    })
    const created = await createRes.json()
    const alreadyExists = createRes.status === 409

    if (!createRes.ok && !alreadyExists) {
      setFormError(created.error || 'שגיאה באישור הבקשה')
      setApprovingModal(false)
      return
    }

    const approveRes = await fetch(`/api/admin/account-request/${approvalModal.req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'approved',
        sendEmail,
        emailTo: approvalModal.req.email,
        emailSubject: approvalModal.subject,
        emailBody: approvalModal.body,
      }),
    })
    const approveData = await approveRes.json()

    if (!alreadyExists) {
      setList(prev => [{ ...created, portfolioCount: 0, is_frozen: false }, ...prev])
    }
    setRequests(prev => prev.filter(r => r.id !== approvalModal.req.id))
    setApprovalModal(null)
    setApprovingModal(false)

    if (sendEmail) {
      if (approveData.emailSent) {
        toast('החשבון נפתח · מייל נשלח בהצלחה ✓')
      } else {
        toast(`החשבון נפתח · שגיאה בשליחת מייל: ${approveData.emailError || 'שגיאה'}`, 'error')
      }
    } else {
      toast('החשבון נפתח בהצלחה')
    }
  }

  async function rejectRequest(req: AccountRequest) {
    setRejecting(req.id)
    await fetch(`/api/admin/account-request/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    setRequests(prev => prev.filter(r => r.id !== req.id))
    setRejecting(null)
  }

  const active = list.filter(p => !p.is_frozen)
  const frozen = list.filter(p => p.is_frozen)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">צלמות במערכת</h1>
          <p className="text-stone-400 text-sm mt-0.5">{active.length} פעילות · {frozen.length} מוקפאות</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--brand)' }}
        >
          <Plus size={16} />
          הוספת צלמת
        </button>
      </div>

      {/* Pending requests */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-600">בקשות לפתיחת חשבון</h2>
          <span className="text-xs text-stone-400">{requests.length} ממתינות</span>
        </div>
        {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
        {requests.length > 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
            {requests.map(req => (
              <div key={req.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-800 text-sm">{req.name}</p>
                  <p className="text-stone-400 text-xs mt-0.5 truncate" dir="ltr">{req.email}</p>
                  {req.details && <p className="text-stone-500 text-xs mt-1 leading-5">{req.details}</p>}
                  <p className="text-stone-300 text-[11px] mt-1">{formatDate(req.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => rejectRequest(req)}
                    disabled={rejecting === req.id || approvingModal}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-stone-400 border border-stone-200 text-xs font-semibold hover:bg-stone-50 hover:text-stone-600 disabled:opacity-50 transition-colors"
                  >
                    <X size={13} />
                    דחייה
                  </button>
                  <button
                    type="button"
                    onClick={() => startApprove(req)}
                    disabled={rejecting === req.id || approvingModal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
                    style={{ background: 'var(--brand)' }}
                  >
                    <Check size={13} />
                    אישור
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 px-6 py-5 text-sm text-stone-400">
            אין בקשות ממתינות
          </div>
        )}
      </div>

      {/* Active photographers */}
      <PhotographerList
        title="צלמות פעילות"
        photographers={active}
        toggling={toggling}
        onToggleFreeze={toggleFreeze}
      />

      {/* Frozen photographers */}
      {frozen.length > 0 && (
        <div className="mt-6">
          <PhotographerList
            title="חשבונות מוקפאים"
            photographers={frozen}
            toggling={toggling}
            onToggleFreeze={toggleFreeze}
            isFrozenSection
          />
        </div>
      )}

      {/* Add Photographer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl anim-pop">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
              <h2 className="font-bold text-stone-800">הוספת צלמת חדשה</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addPhotographer} className="p-6 space-y-4">
              <div>
                <label className={lbl}>שם מלא</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inp} placeholder="שם הצלמת" />
              </div>
              <div>
                <label className={lbl}>כתובת מייל</label>
                <EmailInput required value={form.email} onChange={email => setForm(f => ({ ...f, email }))}
                  className={inp} placeholder="photographer@email.com" />
              </div>
              <div>
                <label className={lbl}>סיסמה ראשונית</label>
                <div className="flex gap-2">
                  <input required type="text" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className={inp} placeholder="לפחות 6 תווים" dir="ltr" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}
                    className="px-3 py-2 rounded-xl border border-stone-200 text-stone-500 text-xs hover:bg-stone-50 shrink-0 transition">
                    יצירה אוטומטית
                  </button>
                </div>
              </div>

              {formError && <p className="text-red-500 text-sm">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-500 text-sm font-medium hover:bg-stone-50 transition">
                  ביטול
                </button>
                <button type="submit" disabled={saving}
                  className="flex-[2] py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'var(--brand)' }}>
                  {saving ? 'יוצרת...' : 'צרי חשבון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval + Email Modal */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 shrink-0">
              <h2 className="font-bold text-stone-800 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-500" />
                אישור ופתיחת חשבון
              </h2>
              <button onClick={() => !approvingModal && setApprovalModal(null)}
                disabled={approvingModal}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 transition disabled:opacity-30">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
              {/* Requester info */}
              <div className="bg-stone-50 rounded-xl p-4 space-y-0.5 border border-stone-100">
                <p className="text-sm font-semibold text-stone-800">{approvalModal.req.name}</p>
                <p className="text-xs text-stone-400" dir="ltr">{approvalModal.req.email}</p>
                {approvalModal.req.details && (
                  <p className="text-xs text-stone-500 mt-1.5 leading-5">{approvalModal.req.details}</p>
                )}
                <p className="text-[11px] text-stone-300 pt-0.5">{formatDate(approvalModal.req.created_at)}</p>
              </div>

              {/* Email fields */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail size={12} />
                  מייל לשליחה ללקוח
                </p>

                <div>
                  <label className={lbl}>נושא</label>
                  <input
                    value={approvalModal.subject}
                    onChange={e => setApprovalModal(m => m ? { ...m, subject: e.target.value } : m)}
                    className={inp}
                    dir="auto"
                    disabled={approvingModal}
                  />
                </div>

                <div>
                  <label className={lbl}>גוף ההודעה</label>
                  <textarea
                    value={approvalModal.body}
                    onChange={e => setApprovalModal(m => m ? { ...m, body: e.target.value } : m)}
                    className={inp + ' resize-none text-xs leading-6'}
                    rows={11}
                    dir="auto"
                    disabled={approvingModal}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-red-600 text-xs">{formError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-stone-100 shrink-0">
              <button
                type="button"
                onClick={() => confirmApprove(false)}
                disabled={approvingModal}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-500 text-sm font-medium hover:bg-stone-50 disabled:opacity-50 transition whitespace-nowrap"
              >
                אשר בלי מייל
              </button>
              <button
                type="button"
                onClick={() => confirmApprove(true)}
                disabled={approvingModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition flex-1 justify-center"
                style={{ background: 'var(--brand)' }}
              >
                <Mail size={14} />
                {approvingModal ? 'מעבד...' : 'שלח מייל ואשר'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotographerList({
  title,
  photographers,
  toggling,
  onToggleFreeze,
  isFrozenSection = false,
}: {
  title: string
  photographers: Photographer[]
  toggling: string | null
  onToggleFreeze: (p: Photographer) => void
  isFrozenSection?: boolean
}) {
  if (photographers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-stone-400">
        <Camera size={40} strokeWidth={1.5} className="mb-3 opacity-40" />
        <p className="font-medium">אין עדיין צלמות</p>
        <p className="text-sm mt-1">הוסיפי את הראשונה</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 mb-2">{title}</p>
      <div className={`bg-white rounded-2xl border divide-y divide-stone-100 overflow-hidden ${isFrozenSection ? 'border-blue-100' : 'border-stone-200'}`}>
        {photographers.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-4 px-6 py-4 transition-colors anim-fadeUp ${isFrozenSection ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-stone-50'}`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isFrozenSection ? 'opacity-50' : ''}`}
              style={{ background: p.brand_color || 'var(--brand)' }}
            >
              {p.name?.[0]?.toUpperCase()}
            </div>

            <div className={`flex-1 min-w-0 ${isFrozenSection ? 'opacity-60' : ''}`}>
              <p className="font-semibold text-stone-800 text-sm">{p.name}</p>
              <p className="text-stone-400 text-xs mt-0.5 dir-ltr truncate" dir="ltr">{p.email}</p>
            </div>

            <div className={`flex items-center gap-1.5 text-stone-400 text-xs shrink-0 ${isFrozenSection ? 'opacity-60' : ''}`}>
              <FolderOpen size={14} />
              <span>{p.portfolioCount} תיקים</span>
            </div>

            <button
              onClick={() => onToggleFreeze(p)}
              disabled={toggling === p.id}
              className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
                isFrozenSection
                  ? 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'
                  : 'text-stone-300 hover:text-blue-400 hover:bg-blue-50'
              }`}
              title={isFrozenSection ? 'ביטול הקפאה' : 'הקפאת חשבון'}
            >
              {isFrozenSection ? <LockOpen size={15} /> : <Lock size={15} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const lbl = 'block text-sm font-medium text-stone-600 mb-1'
const inp = 'w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition text-sm placeholder:text-stone-300'
