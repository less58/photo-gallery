'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Upload, Plus, Download, Check, HelpCircle, FolderOpen, ImageIcon, Copy, CheckCheck, Trash2, X, Mail } from 'lucide-react'
import type { Portfolio, Session, Photo } from '@/lib/types'
import { useToast } from './Toast'
import { useUpload } from '@/context/UploadContext'

type Photographer = {
  id: string; name: string; logo_url: string | null
  brand_color: string; watermark_url: string | null; watermark_public_id: string | null
  send_client_emails: boolean
}
type Props = {
  portfolio: Portfolio
  sessions: (Session & { photos: Photo[] })[]
  selections: { photo_id: string; status: string }[]
  photographer: Photographer
  isFrozen?: boolean
}
type Tab = 'photos' | 'selected'

const STATUS_COLOR: Record<string, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

export default function PortfolioTabs({ portfolio, sessions: initialSessions, selections, photographer, isFrozen = false }: Props) {
  const toast = useToast()
  const { trackUpload, progressUpload, failUpload, doneUpload } = useUpload()
  const [tab, setTab] = useState<Tab>('photos')
  const [sessions, setSessions] = useState(initialSessions)
  const [newSessionName, setNewSessionName] = useState('')
  const [addingSession, setAddingSession] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [activeUploadSession, setActiveUploadSession] = useState<string | null>(null)
  const [siteOrigin, setSiteOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(portfolio.cover_url)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showResendConfirm, setShowResendConfirm] = useState(false)
  const creatingSessionRef = useRef(false)

  useEffect(() => { setSiteOrigin(window.location.origin) }, [])

  // Always fetch fresh data from API on mount (bypasses any Next.js router/server cache)
  useEffect(() => {
    async function refresh() {
      setLoadingData(true)
      try {
        const res = await fetch(`/api/dashboard/portfolio/${portfolio.id}`, { cache: 'no-store' })
        if (!res.ok) { setLoadingData(false); return }
        const data = await res.json()
        if (Array.isArray(data.sessions)) setSessions(data.sessions)
      } catch { /* ignore */ }
      setLoadingData(false)
    }
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.id])
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const color = photographer.brand_color || '#D4736A'
  const allPhotos = sessions.flatMap(s => s.photos || [])
  const approved = selections.filter(s => s.status === 'approved')
  const approvedPhotos = approved.map(s => allPhotos.find(p => p.id === s.photo_id)).filter(Boolean) as Photo[]
  const selectedPhotoIds = new Set(selections.map(s => s.photo_id))
  const magicLink = portfolio.magic_token ? `${siteOrigin}/enter/${portfolio.magic_token}` : ''

  async function copyLink() {
    if (!magicLink) return
    await navigator.clipboard.writeText(magicLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function doSendEmail() {
    setShowResendConfirm(false)
    setSendingEmail(true)
    try {
      const res = await fetch('/api/dashboard/portfolio/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId: portfolio.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast('מייל נשלח ללקוחה בהצלחה ✓')
        setEmailSent(true)
      } else {
        toast(data.error || 'שגיאה בשליחת המייל', 'error')
      }
    } catch {
      toast('שגיאה בחיבור', 'error')
    } finally {
      setSendingEmail(false)
    }
  }

  function sendEmailToClient() {
    if (emailSent) { setShowResendConfirm(true); return }
    void doSendEmail()
  }

  async function uploadCover(file: File) {
    setUploadingCover(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', `portfolios/${portfolio.id}/cover`)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast('שגיאה בהעלאת תמונת הכיסוי', 'error'); return }
      const { url } = await res.json()
      if (!url) { toast('שגיאה בהעלאה', 'error'); return }

      const patch = await fetch(`/api/dashboard/portfolio/${portfolio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_url: url }),
      })
      if (!patch.ok) { toast('שגיאה בשמירה', 'error'); return }
      setCoverUrl(url)
      toast('תמונת כיסוי עודכנה')
    } catch { toast('שגיאה', 'error') }
    finally { setUploadingCover(false) }
  }

  async function getOrCreateDefaultSession(): Promise<string | null> {
    if (sessions.length > 0) return sessions[0].id
    if (creatingSessionRef.current) return null
    creatingSessionRef.current = true
    try {
      const res = await fetch('/api/dashboard/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId: portfolio.id, name: 'כללי' }),
      })
      if (!res.ok) { toast('שגיאה ביצירת סשן', 'error'); return null }
      const data = await res.json()
      setSessions(prev => {
        if (prev.some(s => s.id === data.id)) return prev
        return [...prev, { ...data, photos: [] }]
      })
      return data.id
    } finally {
      creatingSessionRef.current = false
    }
  }

  async function addSession() {
    if (!newSessionName.trim() || savingSession) return
    setSavingSession(true)
    try {
      const res = await fetch('/api/dashboard/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId: portfolio.id, name: newSessionName }),
      })
      const data = await res.json()
      if (res.ok) {
        setSessions(prev => [...prev, { ...data, photos: [] }])
        setNewSessionName(''); setAddingSession(false)
        toast('הסשן נוצר')
      } else {
        toast(data.error || 'שגיאה ביצירת הסשן', 'error')
      }
    } catch { toast('שגיאה בחיבור', 'error') }
    finally { setSavingSession(false) }
  }

  async function uploadPhotos(sessionId: string, files: FileList) {
    const fileArr = Array.from(files)
    const total = fileArr.length
    let done = 0
    let failed = 0
    const newPhotos: Photo[] = []
    const sessionName = sessions.find(s => s.id === sessionId)?.name ?? 'סשן'
    const jobId = trackUpload(sessionId, sessionName, total)

    async function uploadOne(file: File): Promise<Photo | null> {
      const name = file.name
      const resized = await resizeForUpload(file)

      const fd = new FormData()
      fd.append('file', resized)
      fd.append('folder', `portfolios/${portfolio.id}`)
      if (photographer.watermark_public_id) fd.append('watermarkPublicId', photographer.watermark_public_id)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({})) as Record<string, unknown>
        failUpload(jobId, name, String(errData.error || `שגיאת העלאה (${uploadRes.status})`))
        return null
      }
      const { url, thumbnailUrl } = await uploadRes.json() as { url: string; thumbnailUrl: string }
      if (!url) {
        failUpload(jobId, name, 'לא התקבל URL מ-Cloudinary')
        return null
      }

      const addRes = await fetch('/api/dashboard/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, url, thumbnailUrl, name }),
      })
      if (!addRes.ok) {
        failUpload(jobId, name, 'שגיאת שמירה בבסיס הנתונים')
        return null
      }
      return await addRes.json() as Photo
    }

    const CONCURRENCY = 5
    await new Promise<void>((resolve) => {
      let active = 0
      let index = 0

      function startNext() {
        while (active < CONCURRENCY && index < fileArr.length) {
          const file = fileArr[index++]
          active++
          uploadOne(file).then(photo => {
            if (photo?.id) { newPhotos.push(photo); done++ } else { failed++ }
            progressUpload(jobId, done, failed)
            active--
            if (index < fileArr.length) startNext()
            else if (active === 0) resolve()
          })
        }
        if (active === 0 && index >= fileArr.length) resolve()
      }

      startNext()
    })

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, photos: [...(s.photos || []), ...newPhotos] } : s
    ))
    doneUpload(jobId)
  }

  async function resizeForUpload(file: File): Promise<File> {
    const resizable = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/pjpeg'])
    if (!resizable.has(file.type)) return file
    const MAX_DIM = 1200
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      if (bitmap.width <= MAX_DIM && bitmap.height <= MAX_DIM) { bitmap.close(); return file }
      const ratio = Math.min(MAX_DIM / bitmap.width, MAX_DIM / bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * ratio)
      canvas.height = Math.round(bitmap.height * ratio)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.92))
      if (!blob) return file
      return new File([blob], file.name, { type: 'image/jpeg' })
    } catch { return file }
  }

  async function triggerUpload(sessionId?: string) {
    if (sessionId) {
      setActiveUploadSession(sessionId)
    } else {
      const sid = await getOrCreateDefaultSession()
      if (!sid) return
      setActiveUploadSession(sid)
    }
    fileRef.current?.click()
  }

  async function deletePhoto(photoId: string) {
    if (selectedPhotoIds.has(photoId)) {
      toast('התמונה נבחרה על ידי הלקוחה ולא ניתן למחוק אותה', 'error')
      return
    }
    if (!confirm('למחוק את התמונה? לא ניתן לשחזר.')) return
    setDeletingPhoto(photoId)
    try {
      const res = await fetch('/api/dashboard/photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      })
      if (res.ok) {
        setSessions(prev => prev.map(s => ({
          ...s,
          photos: (s.photos || []).filter(p => p.id !== photoId),
        })))
        toast('התמונה נמחקה')
      } else {
        const data = await res.json()
        toast(data.error || 'שגיאה במחיקה', 'error')
      }
    } catch { toast('שגיאה', 'error') }
    finally { setDeletingPhoto(null) }
  }

  function photoName(photo: Photo): string {
    return photo.name || ''
  }

  function downloadReport() {
    const bySession: Record<string, { sessionName: string; photos: Photo[] }> = {}
    for (const photo of approvedPhotos) {
      const session = sessions.find(s => s.id === photo.session_id)
      const sid = photo.session_id
      if (!bySession[sid]) bySession[sid] = { sessionName: session?.name || 'כללי', photos: [] }
      bySession[sid].photos.push(photo)
    }

    const lines = [
      `דוח תמונות שנבחרו — ${portfolio.title}`,
      `לקוחה: ${portfolio.client_email}`,
      `תאריך: ${new Date().toLocaleDateString('he-IL')}`,
      `סה"כ נבחרו: ${approvedPhotos.length} מתוך ${portfolio.quota}`,
      '',
    ]

    for (const { sessionName, photos } of Object.values(bySession)) {
      if (Object.keys(bySession).length > 1) lines.push(`— ${sessionName} —`)
      photos.forEach((p, i) => lines.push(`${i + 1}. ${photoName(p)}`))
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `בחירות-${portfolio.title}.txt`
    a.click()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard" prefetch={false} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
          <ArrowRight size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-stone-800 truncate">{portfolio.title}</h1>
          <p className="text-stone-400 text-xs mt-0.5 truncate" dir="ltr">{portfolio.client_email}</p>
        </div>
        <div className="text-right text-xs text-stone-400 shrink-0">
          <div>{allPhotos.length} תמונות</div>
          <div style={{ color: approvedPhotos.length > 0 ? color : undefined }}>
            {approvedPhotos.length}/{portfolio.quota} נבחרו
          </div>
        </div>
      </div>

      {/* Magic link banner */}
      <div className="rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-x-3 gap-y-1.5 items-center"
        style={{ background: color + '12', border: `1px solid ${color}30` }}>
        <span className="font-medium text-sm" style={{ color }}>קישור ללקוחה:</span>
        <span className="font-mono text-xs text-stone-500 flex-1 min-w-0 truncate" dir="ltr">
          {magicLink || '...'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copyLink}
            disabled={!magicLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all"
            style={{ background: color, color: '#fff' }}
          >
            {copied ? <><CheckCheck size={12} /> הועתק</> : <><Copy size={12} /> העתק</>}
          </button>
          {photographer.send_client_emails && (
            <button
              type="button"
              onClick={sendEmailToClient}
              disabled={sendingEmail}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-all disabled:opacity-50"
              style={{ borderColor: color, color }}
              title="שלחי מייל עם קישור ללקוחה"
            >
              <Mail size={12} />
              {sendingEmail ? 'שולחת...' : 'שלחי מייל'}
            </button>
          )}
        </div>
      </div>

      {/* Resend email confirmation */}
      {showResendConfirm && (
        <div className="rounded-xl px-4 py-3 mb-4 border text-sm"
          style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          <p className="font-medium text-amber-800 mb-2">
            כבר נשלח מייל ללקוחה על פתיחת התיק. האם לשלוח שנית?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void doSendEmail()}
              disabled={sendingEmail}
              className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50 transition"
              style={{ background: color }}
            >
              {sendingEmail ? 'שולחת...' : 'שלח שנית'}
            </button>
            <button
              type="button"
              onClick={() => setShowResendConfirm(false)}
              className="px-4 py-1.5 rounded-lg border border-stone-200 text-stone-500 text-xs hover:bg-stone-50 transition"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Cover image section */}
      <div className="rounded-xl border border-stone-200 px-4 py-3 mb-5 flex items-center gap-4 bg-white">
        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          disabled={uploadingCover}
          className="shrink-0 relative group"
        >
          {coverUrl ? (
            <div className="w-20 h-14 rounded-lg overflow-hidden relative">
              <Image src={coverUrl} alt="" fill unoptimized className="object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload size={14} className="text-white" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-14 rounded-lg bg-stone-100 flex flex-col items-center justify-center gap-1 hover:bg-stone-200 transition-colors">
              {uploadingCover
                ? <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                : <><ImageIcon size={16} className="text-stone-400" /><span className="text-[10px] text-stone-400">הוסף</span></>
              }
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-700">תמונת כיסוי</p>
          <p className="text-xs text-stone-400 mt-0.5">מוצגת על כרטיס התיק וכשהלקוחה נכנסת</p>
        </div>
        {coverUrl && (
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            disabled={uploadingCover}
            className="text-xs text-stone-400 hover:text-stone-600 transition shrink-0"
          >
            שנה
          </button>
        )}
      </div>


      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-lg mb-5 w-fit">
        {([['photos', 'תמונות'], ['selected', 'נבחרו']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={tab === t
              ? { background: '#fff', color, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
              : { color: '#78716c' }}>
            {t === 'selected' && approvedPhotos.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] mr-1"
                style={{ background: color }}>{approvedPhotos.length}</span>
            )}
            {label}
          </button>
        ))}
      </div>

      {/* ── Photos tab ── */}
      {tab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-600 flex items-center gap-2">
              {loadingData && <span className="inline-block w-3 h-3 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />}
              {sessions.length === 0 ? (loadingData ? 'טוענת...' : 'לא נוצרו סשנים') : `${sessions.length} סשנים`}
            </span>
            {!isFrozen && (
              <div className="flex gap-2">
                <button type="button" onClick={() => triggerUpload()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all active:scale-[0.98]"
                  style={{ background: color }}>
                  <Upload size={13} />
                  {sessions.length === 0 ? 'העלאת תמונות' : 'העלה לסשן הראשון'}
                </button>
                <button type="button" onClick={() => setAddingSession(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 text-xs font-medium hover:border-stone-300 transition-colors">
                  <Plus size={13} /> סשן חדש
                </button>
              </div>
            )}
          </div>

          {addingSession && (
            <div className="flex gap-2 anim-fadeUp">
              <input autoFocus value={newSessionName} onChange={e => setNewSessionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSession() } if (e.key === 'Escape') setAddingSession(false) }}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ['--tw-ring-color' as string]: color }}
                placeholder="שם הסשן" />
              <button type="button" onClick={addSession} disabled={savingSession || !newSessionName.trim()}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition"
                style={{ background: color }}>
                {savingSession ? '...' : 'שמור'}
              </button>
              <button type="button" onClick={() => setAddingSession(false)}
                className="px-3 py-2 rounded-lg border border-stone-200 text-stone-400 text-sm hover:bg-stone-50 transition">
                ביטול
              </button>
            </div>
          )}

          {sessions.length === 0 && !addingSession && (
            <button type="button" onClick={() => triggerUpload()}
              className="flex flex-col items-center justify-center w-full py-14 border-2 border-dashed border-stone-200 rounded-xl text-stone-400 hover:border-stone-300 transition-colors">
              <Upload size={28} strokeWidth={1.5} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">לחצי להעלאת תמונות</p>
              <p className="text-xs mt-1 text-stone-300">יצירת סשן "כללי" אוטומטית</p>
            </button>
          )}

          {sessions.map(session => (
            <div key={session.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
                <div>
                  <span className="font-semibold text-stone-800 text-sm">{session.name}</span>
                  <span className="text-stone-400 text-xs mr-2">{session.photos?.length || 0} תמונות</span>
                </div>
                {!isFrozen && (
                  <button type="button" onClick={() => triggerUpload(session.id)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors">
                    <Upload size={12} /> העלאה
                  </button>
                )}
              </div>

              {(session.photos?.length || 0) === 0 ? (
                <div className="flex items-center justify-center py-8 text-stone-300 gap-2">
                  <ImageIcon size={20} strokeWidth={1.5} />
                  <span className="text-xs">אין תמונות</span>
                </div>
              ) : (
                <div className="p-3 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1.5">
                  {session.photos.map(photo => {
                    const sel = selections.find(s => s.photo_id === photo.id)
                    const isSelected = selectedPhotoIds.has(photo.id)
                    const isDeleting = deletingPhoto === photo.id
                    return (
                      <div key={photo.id} className="aspect-square rounded-md overflow-hidden bg-stone-100 relative group"
                        style={sel ? { outline: `2px solid ${STATUS_COLOR[sel.status]}`, outlineOffset: '-2px' } : undefined}>
                        {(photo.thumbnail_url || photo.url) ? (
                          <Image
                            src={photo.thumbnail_url || photo.url}
                            alt={photo.name || ''}
                            fill unoptimized
                            className="object-cover"
                          />
                        ) : null}

                        {/* Selection badge */}
                        {sel && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: STATUS_COLOR[sel.status] }}>
                            {sel.status === 'approved' ? <Check size={9} className="text-white" />
                              : sel.status === 'rejected' ? <X size={9} className="text-white" />
                              : <HelpCircle size={9} className="text-white" />}
                          </div>
                        )}

                        {/* Photo name on hover */}
                        {photo.name && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {photo.name}
                          </div>
                        )}

                        {/* Delete button */}
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => deletePhoto(photo.id)}
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded flex items-center justify-center transition-opacity ${isSelected ? 'opacity-0 group-hover:opacity-60 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{ background: 'rgba(0,0,0,0.6)' }}
                          title={isSelected ? 'נבחרה על ידי הלקוחה' : 'מחק תמונה'}
                        >
                          {isDeleting
                            ? <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                            : <Trash2 size={9} className={isSelected ? 'text-stone-400' : 'text-white'} />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Selected tab ── */}
      {tab === 'selected' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-stone-500 text-sm">{approvedPhotos.length} תמונות אושרו מתוך {portfolio.quota}</p>
            {approvedPhotos.length > 0 && (
              <button type="button" onClick={downloadReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ background: color }}>
                <Download size={13} /> הורד דוח
              </button>
            )}
          </div>

          {approvedPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
              <Check size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
              <p className="text-sm">הלקוחה עדיין לא בחרה תמונות</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {approvedPhotos.map((photo, i) => (
                <div key={photo.id} className="flex flex-col gap-1">
                  <div className="aspect-square rounded-lg overflow-hidden relative bg-stone-100 group"
                    style={{ outline: `2px solid ${color}`, outlineOffset: '-2px' }}>
                    {(photo.thumbnail_url || photo.url) && (
                      <Image src={photo.thumbnail_url || photo.url} alt="" fill unoptimized className="object-cover" />
                    )}
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: color }}>
                      <Check size={10} className="text-white" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 text-center text-white text-[9px] font-medium bg-black/50 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity px-0.5 truncate">
                      {i + 1}
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-500 truncate text-center leading-tight px-0.5" title={photoName(photo)}>
                    {photoName(photo)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {selections.filter(s => s.status === 'maybe').length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-stone-500 mb-3 flex items-center gap-1.5">
                <HelpCircle size={13} /> בהתלבטות
              </p>
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {selections
                  .filter(s => s.status === 'maybe')
                  .map(sel => ({ sel, photo: allPhotos.find(p => p.id === sel.photo_id) }))
                  .filter((x): x is { sel: typeof x.sel; photo: Photo } => !!x.photo)
                  .map(({ sel, photo }, i) => (
                    <div key={sel.photo_id} className="flex items-center gap-4 px-5 py-3 border-b border-stone-50 last:border-0">
                      <span className="text-stone-300 text-sm w-5 shrink-0">{i + 1}</span>
                      <div className="w-9 h-9 rounded-md overflow-hidden relative shrink-0 bg-stone-100">
                        {(photo.thumbnail_url || photo.url) && (
                          <Image src={photo.thumbnail_url || photo.url} alt="" fill unoptimized className="object-cover" />
                        )}
                      </div>
                      <span className="text-sm text-stone-700 flex-1 truncate">{photoName(photo)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-amber-50 text-amber-600 shrink-0">התלבטות</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
        onChange={e => {
          if (e.target.files && activeUploadSession) {
            uploadPhotos(activeUploadSession, e.target.files)
            e.target.value = ''
          }
        }} />

      <input ref={coverRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) { uploadCover(file); e.target.value = '' }
        }} />
    </div>
  )
}
