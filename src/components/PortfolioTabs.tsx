'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Upload, Plus, Download, Check, HelpCircle, FolderOpen, ImageIcon, Copy, CheckCheck, Trash2, X, Mail, ChevronLeft, ChevronRight, ZoomIn, MessageCircle, Square } from 'lucide-react'
import NoteChat from './NoteChat'
import type { Portfolio, Session, Photo } from '@/lib/types'
import { useToast } from './Toast'
import { useUpload } from '@/context/UploadContext'

type Photographer = {
  id: string; name: string; logo_url: string | null
  brand_color: string; watermark_url: string | null; watermark_public_id: string | null
  watermark_type?: string | null; watermark_text?: string | null
  watermark_opacity?: number | null; watermark_position?: string | null
  watermark_font_size?: number | null; watermark_color?: string | null
  watermark_x?: number | null; watermark_y?: number | null
  watermark_rotation?: number | null; watermark_image_opacity?: number | null
  send_client_emails: boolean
}
type Props = {
  portfolio: Portfolio
  sessions: (Session & { photos: Photo[] })[]
  selections: { photo_id: string; status: string }[]
  photographer: Photographer
  isFrozen?: boolean
}
type Tab = 'photos' | 'selected' | 'notes'

const STATUS_COLOR: Record<string, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

export default function PortfolioTabs({ portfolio, sessions: initialSessions, selections, photographer, isFrozen = false }: Props) {
  const toast = useToast()
  const { trackUpload, progressUpload, failUpload, doneUpload, isCancelled } = useUpload()
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
  const [quota, setQuota] = useState(portfolio.quota)
  const [editingQuota, setEditingQuota] = useState(false)
  const [quotaDraft, setQuotaDraft] = useState(String(portfolio.quota))
  const [savingQuota, setSavingQuota] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null)
  const lastClickRef = useRef<{ id: string; sessionId: string } | null>(null)
  const creatingSessionRef = useRef(false)

  // Derived - declared early so it's available in effects below
  const allPhotos = sessions.flatMap(s => s.photos || [])

  useEffect(() => { setSiteOrigin(window.location.origin) }, [])

  const moveLightbox = useCallback((dir: -1 | 1) => {
    setLightboxPhoto(current => {
      if (!current) return null
      const photos = sessions.flatMap(s => s.photos || [])
      const idx = photos.findIndex(p => p.id === current.id)
      if (idx < 0) return current
      const next = (idx + dir + photos.length) % photos.length
      return photos[next]
    })
  }, [sessions])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightboxPhoto) return
      if (e.key === 'Escape') setLightboxPhoto(null)
      if (e.key === 'ArrowRight') moveLightbox(1)
      if (e.key === 'ArrowLeft') moveLightbox(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxPhoto, moveLightbox])

  useEffect(() => {
    document.body.style.overflow = lightboxPhoto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxPhoto])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxPhoto) return
      if (!selectionMode) return
      if (e.key === 'Escape') { exitSelectionMode(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPhotoIds.size > 0) {
        void bulkDeleteSelected()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedPhotoIds(new Set(allPhotos.map(p => p.id)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMode, selectedPhotoIds, lightboxPhoto, allPhotos])

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
  const approved = selections.filter(s => s.status === 'approved')
  const approvedPhotos = approved.map(s => allPhotos.find(p => p.id === s.photo_id)).filter(Boolean) as Photo[]
  const clientSelectedPhotoIds = new Set(selections.map(s => s.photo_id))
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
    const jobId = trackUpload(sessionId, sessionName, portfolio.id, portfolio.title, total)

    async function uploadOne(file: File): Promise<Photo | null> {
      const name = file.name
      const resized = await resizeForUpload(file)

      const fd = new FormData()
      fd.append('file', resized)
      fd.append('folder', `portfolios/${portfolio.id}`)
      if (photographer.watermark_type === 'text' && photographer.watermark_text) {
        fd.append('watermarkText', photographer.watermark_text)
        fd.append('watermarkOpacity', String(photographer.watermark_opacity ?? 30))
        fd.append('watermarkPosition', photographer.watermark_position ?? 'free')
        fd.append('watermarkFontSize', String(photographer.watermark_font_size ?? 120))
        fd.append('watermarkColor', photographer.watermark_color ?? '#ffffff')
        fd.append('watermarkX', String(photographer.watermark_x ?? 0.5))
        fd.append('watermarkY', String(photographer.watermark_y ?? 0.85))
        fd.append('watermarkRotation', String(photographer.watermark_rotation ?? 0))
      } else if (photographer.watermark_public_id) {
        fd.append('watermarkPublicId', photographer.watermark_public_id)
        fd.append('watermarkImageOpacity', String(photographer.watermark_image_opacity ?? 20))
      }

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
        if (!isCancelled(jobId)) {
          while (active < CONCURRENCY && index < fileArr.length) {
            const file = fileArr[index++]
            active++
            uploadOne(file).then(photo => {
              if (photo?.id) { newPhotos.push(photo); done++ } else { failed++ }
              progressUpload(jobId, done, failed)
              active--
              startNext()
            })
          }
        }
        if (active === 0) resolve()
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
    if (clientSelectedPhotoIds.has(photoId)) {
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

  async function saveQuota() {
    const val = parseInt(quotaDraft, 10)
    if (!val || val < 1 || val > 999) { setQuotaDraft(String(quota)); setEditingQuota(false); return }
    if (val === quota) { setEditingQuota(false); return }
    setSavingQuota(true)
    try {
      const res = await fetch(`/api/dashboard/portfolio/${portfolio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quota: val }),
      })
      const data = await res.json()
      if (res.ok) { setQuota(val); toast('מכסה עודכנה') }
      else toast(data.error || 'שגיאה בשמירה', 'error')
    } catch { toast('שגיאה', 'error') }
    setSavingQuota(false)
    setEditingQuota(false)
  }

  function photoName(photo: Photo): string {
    return photo.name || ''
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedPhotoIds(new Set())
    lastClickRef.current = null
  }

  function togglePhotoSelect(photoId: string, sessionPhotos: Photo[], e: React.MouseEvent) {
    if (e.shiftKey && lastClickRef.current) {
      const idx1 = sessionPhotos.findIndex(p => p.id === lastClickRef.current!.id)
      const idx2 = sessionPhotos.findIndex(p => p.id === photoId)
      if (idx1 >= 0 && idx2 >= 0) {
        const [lo, hi] = [Math.min(idx1, idx2), Math.max(idx1, idx2)]
        const range = sessionPhotos.slice(lo, hi + 1).map(p => p.id)
        setSelectedPhotoIds(prev => { const n = new Set(prev); range.forEach(id => n.add(id)); return n })
        return
      }
    }
    setSelectedPhotoIds(prev => {
      const n = new Set(prev)
      n.has(photoId) ? n.delete(photoId) : n.add(photoId)
      return n
    })
    lastClickRef.current = { id: photoId, sessionId: sessionPhotos[0]?.session_id || '' }
  }

  function toggleSessionSelect(session: { photos?: Photo[] }) {
    const ids = (session.photos || []).map(p => p.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedPhotoIds.has(id))
    setSelectedPhotoIds(prev => {
      const n = new Set(prev)
      allSelected ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id))
      return n
    })
  }

  async function bulkDeleteSelected() {
    if (selectedPhotoIds.size === 0 || bulkDeleting) return
    if (!confirm(`למחוק ${selectedPhotoIds.size} תמונות? לא ניתן לשחזר.`)) return

    const allIds = [...selectedPhotoIds]
    const CHUNK = 15
    const chunks: string[][] = []
    for (let i = 0; i < allIds.length; i += CHUNK) chunks.push(allIds.slice(i, i + CHUNK))

    setBulkDeleting(true)
    setDeleteProgress({ done: 0, total: allIds.length })

    let totalDeleted = 0
    let totalSkipped = 0
    const allDeletedIds: string[] = []

    for (const chunk of chunks) {
      try {
        const res = await fetch('/api/dashboard/photo', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoIds: chunk }),
        })
        const data = await res.json()
        if (res.ok) {
          totalDeleted += data.deleted ?? 0
          totalSkipped += data.skipped ?? 0
          allDeletedIds.push(...(data.deletedIds ?? []))
        } else {
          totalSkipped += chunk.length
        }
      } catch {
        totalSkipped += chunk.length
      }
      setDeleteProgress({ done: totalDeleted + totalSkipped, total: allIds.length })
    }

    const delSet = new Set<string>(allDeletedIds)
    setSessions(prev => prev.map(s => ({ ...s, photos: (s.photos || []).filter(p => !delSet.has(p.id)) })))
    const msg = totalSkipped > 0
      ? `${totalDeleted} נמחקו · ${totalSkipped} דולגו`
      : `${totalDeleted} תמונות נמחקו`
    toast(msg)
    exitSelectionMode()
    setDeleteProgress(null)
    setBulkDeleting(false)
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
          <div className="flex items-center justify-end gap-1" style={{ color: approvedPhotos.length > 0 ? color : undefined }}>
            {approvedPhotos.length}/
            {editingQuota ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  type="number" min={1} max={999}
                  value={quotaDraft}
                  onChange={e => setQuotaDraft(e.target.value)}
                  onBlur={saveQuota}
                  onKeyDown={e => { if (e.key === 'Enter') saveQuota(); if (e.key === 'Escape') { setEditingQuota(false); setQuotaDraft(String(quota)) } }}
                  className="w-12 px-1 py-0 rounded border border-stone-300 text-xs text-stone-700 focus:outline-none focus:border-rose-300 text-right"
                  disabled={savingQuota}
                />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => { if (selections.length === 0) { setQuotaDraft(String(quota)); setEditingQuota(true) } }}
                title={selections.length === 0 ? 'לחץ לעריכת המכסה' : 'לא ניתן לשנות מכסה לאחר שהלקוחה בחרה תמונות'}
                className={selections.length === 0 ? 'underline decoration-dashed cursor-pointer hover:text-stone-600' : 'cursor-default'}
              >
                {quota}
              </button>
            )}
            {' '}נבחרו
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
        {([['photos', 'תמונות'], ['selected', 'נבחרו'], ['notes', 'הערות']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={tab === t
              ? { background: '#fff', color, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
              : { color: '#78716c' }}>
            {t === 'selected' && approvedPhotos.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] mr-1"
                style={{ background: color }}>{approvedPhotos.length}</span>
            )}
            {t === 'notes' && <MessageCircle size={12} className="inline mr-1 mb-0.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Photos tab ── */}
      {tab === 'photos' && (
        <div className="space-y-4">
          {selectionMode ? (
            /* ── Selection mode action bar ── */
            <div className="bg-stone-900 rounded-xl px-4 py-2.5 space-y-2">
              {deleteProgress ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>מוחק תמונות...</span>
                    <span className="tabular-nums">{deleteProgress.done}/{deleteProgress.total}</span>
                  </div>
                  <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((deleteProgress.done / deleteProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (() => {
                const blocked = [...selectedPhotoIds].filter(id => clientSelectedPhotoIds.has(id)).length
                const deletable = selectedPhotoIds.size - blocked
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white text-sm font-medium">
                        {selectedPhotoIds.size > 0 ? `${selectedPhotoIds.size} נבחרו` : 'לחצי על תמונות לבחירה'}
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedPhotoIds.size > 0 && (
                          <button type="button" onClick={() => void bulkDeleteSelected()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition disabled:opacity-40"
                            disabled={deletable === 0}>
                            <Trash2 size={12} />
                            {blocked > 0 ? `מחק ${deletable}` : `מחק ${selectedPhotoIds.size}`}
                          </button>
                        )}
                        <button type="button" onClick={exitSelectionMode}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white/70 hover:text-white text-xs transition">
                          <X size={13} /> ביטול
                        </button>
                      </div>
                    </div>
                    {blocked > 0 && selectedPhotoIds.size > 0 && (
                      <p className="text-amber-300 text-[11px] leading-tight">
                        ⚠ {blocked === selectedPhotoIds.size
                          ? 'כל התמונות שנבחרו נבחרו ע"י הלקוחה ולא ניתן למחוק אותן'
                          : `${blocked} תמונות נבחרו ע"י הלקוחה ולא יימחקו`}
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          ) : (
            /* ── Normal header ── */
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
                  {allPhotos.length > 0 && (
                    <button type="button" onClick={() => setSelectionMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 text-xs font-medium hover:border-stone-300 transition-colors">
                      <Square size={13} /> בחירה
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

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
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-stone-800 text-sm">{session.name}</span>
                  <span className="text-stone-400 text-xs">{session.photos?.length || 0} תמונות</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectionMode && (session.photos?.length || 0) > 0 && (
                    <button type="button" onClick={() => toggleSessionSelect(session)}
                      className="text-xs text-stone-400 hover:text-stone-600 transition px-2 py-1 rounded border border-stone-200 hover:border-stone-300">
                      {(session.photos || []).every(p => selectedPhotoIds.has(p.id)) ? 'בטל סשן' : 'בחר סשן'}
                    </button>
                  )}
                  {!isFrozen && !selectionMode && (
                    <button type="button" onClick={() => triggerUpload(session.id)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors">
                      <Upload size={12} /> העלאה
                    </button>
                  )}
                </div>
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
                    const isSelected = clientSelectedPhotoIds.has(photo.id)
                    const isDeleting = deletingPhoto === photo.id
                    return (
                      <div key={photo.id}
                        className="aspect-square rounded-md overflow-hidden bg-stone-100 relative group cursor-pointer"
                        style={{
                          ...(sel && !selectionMode ? { outline: `2px solid ${STATUS_COLOR[sel.status]}`, outlineOffset: '-2px' } : {}),
                          ...(selectionMode && selectedPhotoIds.has(photo.id) ? { outline: `2px solid ${color}`, outlineOffset: '-2px' } : {}),
                        }}
                        onClick={(e) => {
                          if (selectionMode) {
                            togglePhotoSelect(photo.id, session.photos || [], e)
                          } else if (e.ctrlKey || e.metaKey) {
                            setSelectionMode(true)
                            setSelectedPhotoIds(new Set([photo.id]))
                            lastClickRef.current = { id: photo.id, sessionId: session.id }
                          } else {
                            setLightboxPhoto(photo)
                          }
                        }}>
                        {(photo.thumbnail_url || photo.url) ? (
                          <Image src={photo.thumbnail_url || photo.url} alt={photo.name || ''} fill unoptimized className="object-cover" />
                        ) : null}

                        {/* Selection overlay tint */}
                        {selectionMode && selectedPhotoIds.has(photo.id) && (
                          <div className="absolute inset-0 pointer-events-none" style={{ background: color + '40' }} />
                        )}

                        {/* Top-right: status badge (normal) or selection check (selection mode) */}
                        {selectionMode ? (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-white/60 shadow-sm"
                            style={{ background: selectedPhotoIds.has(photo.id) ? color : 'rgba(0,0,0,0.35)' }}>
                            {selectedPhotoIds.has(photo.id) && <Check size={9} className="text-white" />}
                          </div>
                        ) : sel ? (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: STATUS_COLOR[sel.status] }}>
                            {sel.status === 'approved' ? <Check size={9} className="text-white" />
                              : sel.status === 'rejected' ? <X size={9} className="text-white" />
                              : <HelpCircle size={9} className="text-white" />}
                          </div>
                        ) : null}

                        {/* Zoom hint (normal mode only) */}
                        {!selectionMode && (
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <ZoomIn size={14} className="text-white drop-shadow" />
                          </div>
                        )}

                        {/* Photo name on hover */}
                        {photo.name && !selectionMode && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {photo.name}
                          </div>
                        )}

                        {/* Delete button (normal mode only) */}
                        {!selectionMode && (
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={e => { e.stopPropagation(); deletePhoto(photo.id) }}
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded flex items-center justify-center transition-opacity z-10 ${isSelected ? 'opacity-0 group-hover:opacity-60 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'}`}
                            style={{ background: 'rgba(0,0,0,0.6)' }}
                            title={isSelected ? 'נבחרה על ידי הלקוחה' : 'מחק תמונה'}
                          >
                            {isDeleting
                              ? <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                              : <Trash2 size={9} className={isSelected ? 'text-stone-400' : 'text-white'} />
                            }
                          </button>
                        )}
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
            <p className="text-stone-500 text-sm">{approvedPhotos.length} תמונות אושרו מתוך {quota}</p>
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
                  <div className="aspect-square rounded-lg overflow-hidden relative bg-stone-100 group cursor-pointer"
                    style={{ outline: `2px solid ${color}`, outlineOffset: '-2px' }}
                    onClick={() => setLightboxPhoto(photo)}>
                    {(photo.thumbnail_url || photo.url) && (
                      <Image src={photo.thumbnail_url || photo.url} alt="" fill unoptimized className="object-cover" />
                    )}
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: color }}>
                      <Check size={10} className="text-white" />
                    </div>
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <ZoomIn size={16} className="text-white drop-shadow" />
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

      {/* ── Notes tab ── */}
      {tab === 'notes' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 bg-stone-50">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">הודעות עם הלקוחה</h3>
          </div>
          <NoteChat
            fetchUrl={`/api/dashboard/portfolio/${portfolio.id}/notes`}
            postUrl={`/api/dashboard/portfolio/${portfolio.id}/notes`}
            mySender="photographer"
            brandColor={color}
          />
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

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxPhoto(null)}>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); moveLightbox(-1) }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10">
            <ChevronLeft size={28} />
          </button>

          <div className="relative w-full h-full flex items-center justify-center p-14"
            onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.name || ''}
              className="max-w-full max-h-full object-contain rounded select-none"
              draggable={false}
            />
          </div>

          <button
            type="button"
            onClick={e => { e.stopPropagation(); moveLightbox(1) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10">
            <ChevronRight size={28} />
          </button>

          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10">
            <X size={20} />
          </button>

          {lightboxPhoto.name && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full pointer-events-none">
              {lightboxPhoto.name}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
