'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Upload, Plus, Download, Check, HelpCircle, FolderOpen, ImageIcon, Copy, CheckCheck } from 'lucide-react'
import type { Portfolio, Session, Photo } from '@/lib/types'
import { useToast } from './Toast'

type Photographer = {
  id: string; name: string; logo_url: string | null
  brand_color: string; watermark_url: string | null; watermark_public_id: string | null
}
type Props = {
  portfolio: Portfolio
  sessions: (Session & { photos: Photo[] })[]
  selections: { photo_id: string; status: string }[]
  photographer: Photographer
}
type Tab = 'photos' | 'selected'

export default function PortfolioTabs({ portfolio, sessions: initialSessions, selections, photographer }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('photos')
  const [sessions, setSessions] = useState(initialSessions)
  const [newSessionName, setNewSessionName] = useState('')
  const [addingSession, setAddingSession] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [activeUploadSession, setActiveUploadSession] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [siteOrigin, setSiteOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(portfolio.cover_url)
  const [uploadingCover, setUploadingCover] = useState(false)
  useEffect(() => { setSiteOrigin(window.location.origin) }, [])
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const color = photographer.brand_color || '#D4736A'
  const allPhotos = sessions.flatMap(s => s.photos || [])
  const approved = selections.filter(s => s.status === 'approved')
  const approvedPhotos = approved.map(s => allPhotos.find(p => p.id === s.photo_id)).filter(Boolean) as Photo[]
  const magicLink = portfolio.magic_token ? `${siteOrigin}/enter/${portfolio.magic_token}` : ''

  async function copyLink() {
    if (!magicLink) return
    await navigator.clipboard.writeText(magicLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    const res = await fetch('/api/dashboard/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: portfolio.id, name: 'כללי' }),
    })
    if (!res.ok) { toast('שגיאה ביצירת סשן', 'error'); return null }
    const data = await res.json()
    setSessions(prev => [...prev, { ...data, photos: [] }])
    return data.id
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
    let completed = 0
    setUploadProgress({ current: 0, total })

    const BATCH = 3
    const newPhotos: Photo[] = []

    for (let i = 0; i < fileArr.length; i += BATCH) {
      const batch = fileArr.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(async (file) => {
        const name = file.name.replace(/\.[^.]+$/, '')
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', `portfolios/${portfolio.id}`)
        fd.append('name', name)
        if (photographer.watermark_public_id) fd.append('watermarkPublicId', photographer.watermark_public_id)

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error('Upload failed')
        const { url, thumbnailUrl } = await uploadRes.json()
        if (!url) throw new Error('No URL')

        const addRes = await fetch('/api/dashboard/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, url, thumbnailUrl, name }),
        })
        if (!addRes.ok) {
          const err = await addRes.json()
          throw new Error(err.error || 'DB insert failed')
        }
        return await addRes.json() as Photo
      }))

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.id) newPhotos.push(r.value)
        else if (r.status === 'rejected') console.error('Upload error:', r.reason)
        completed++
        setUploadProgress({ current: completed, total })
      }
    }

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, photos: [...(s.photos || []), ...newPhotos] } : s
    ))
    setUploadProgress(null)
    if (newPhotos.length === total) {
      toast(`${newPhotos.length} תמונות הועלו בהצלחה`)
    } else if (newPhotos.length > 0) {
      toast(`${newPhotos.length} מתוך ${total} תמונות הועלו (${total - newPhotos.length} נכשלו)`, 'info')
    } else {
      toast('העלאה נכשלה — בדקי את קובץ ה-.env.local', 'error')
    }
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

  function downloadReport() {
    const lines = [
      `דוח תמונות שנבחרו — ${portfolio.title}`,
      `לקוחה: ${portfolio.client_email}`,
      `תאריך: ${new Date().toLocaleDateString('he-IL')}`,
      '', `סה"כ נבחרו: ${approvedPhotos.length} תמונות`, '',
      ...approvedPhotos.map((p, i) => `${i + 1}. ${p.name || p.id}`),
    ]
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
        <Link href="/dashboard" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
          <ArrowRight size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-stone-800 truncate">{portfolio.title}</h1>
          <p className="text-stone-400 text-xs mt-0.5 truncate" dir="ltr">{portfolio.client_email}</p>
        </div>
        <div className="text-right text-xs text-stone-400 shrink-0">
          <div>{allPhotos.length} תמונות</div>
          <div>{approvedPhotos.length}/{portfolio.quota} נבחרו</div>
        </div>
      </div>

      {/* Magic link banner */}
      <div className="rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-x-3 gap-y-1.5 items-center"
        style={{ background: color + '12', border: `1px solid ${color}30` }}>
        <span className="font-medium text-sm" style={{ color }}>קישור ללקוחה:</span>
        <span className="font-mono text-xs text-stone-500 flex-1 min-w-0 truncate" dir="ltr">
          {magicLink || '...'}
        </span>
        <button
          type="button"
          onClick={copyLink}
          disabled={!magicLink}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0"
          style={{ background: color, color: '#fff' }}
        >
          {copied ? <><CheckCheck size={12} /> הועתק</> : <><Copy size={12} /> העתק</>}
        </button>
      </div>

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

      {/* Upload progress bar */}
      {uploadProgress && (
        <div className="mb-5 bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-stone-600 font-medium">מעלה תמונות...</span>
            <span className="text-stone-400">{uploadProgress.current} / {uploadProgress.total}</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, background: color }} />
          </div>
        </div>
      )}

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
            <span className="text-sm font-medium text-stone-600">
              {sessions.length === 0 ? 'לא נוצרו סשנים' : `${sessions.length} סשנים`}
            </span>
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
                <button type="button" onClick={() => triggerUpload(session.id)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors">
                  <Upload size={12} /> העלאה
                </button>
              </div>

              {(session.photos?.length || 0) === 0 ? (
                <div className="flex items-center justify-center py-8 text-stone-300 gap-2">
                  <ImageIcon size={20} strokeWidth={1.5} />
                  <span className="text-xs">אין תמונות</span>
                </div>
              ) : (
                <div className="p-3 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1.5">
                  {session.photos.map(photo => (
                    <div key={photo.id} className="aspect-square rounded-md overflow-hidden bg-stone-100 relative group">
                      {(photo.thumbnail_url || photo.url) ? (
                        <Image
                          src={photo.thumbnail_url || photo.url!}
                          alt={photo.name || ''}
                          fill unoptimized
                          className="object-cover"
                        />
                      ) : null}
                      {photo.name && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.name}
                        </div>
                      )}
                    </div>
                  ))}
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
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              {approvedPhotos.map((photo, i) => (
                <div key={photo.id} className="flex items-center gap-4 px-5 py-3 border-b border-stone-50 last:border-0">
                  <span className="text-stone-300 text-sm w-5 text-left shrink-0">{i + 1}</span>
                  <div className="w-9 h-9 rounded-md overflow-hidden relative shrink-0 bg-stone-100">
                    {(photo.thumbnail_url || photo.url) && (
                      <Image src={photo.thumbnail_url || photo.url!} alt="" fill unoptimized className="object-cover" />
                    )}
                  </div>
                  <span className="text-sm text-stone-700 flex-1 truncate">{photo.name || photo.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium shrink-0"
                    style={{ background: color + '18', color }}>אושרה</span>
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
                          <Image src={photo.thumbnail_url || photo.url!} alt="" fill unoptimized className="object-cover" />
                        )}
                      </div>
                      <span className="text-sm text-stone-700 flex-1 truncate">{photo.name || photo.id}</span>
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
