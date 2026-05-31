'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import type { Portfolio, Session, Photo } from '@/lib/types'
import { useUpload, UPLOAD_ALLOWED_TYPES, UPLOAD_MAX_SIZE } from '@/context/UploadContext'
import { useToast } from '@/components/Toast'

type Props = {
  portfolio: Portfolio
  sessions: (Session & { photos: Photo[] })[]
  selections: { photo_id: string; status: string }[]
  photographerName: string
  color: string
}

export default function PortfolioEditor({ portfolio, sessions: initialSessions, selections, photographerName, color }: Props) {
  const [sessions, setSessions] = useState(initialSessions)
  const [newSessionName, setNewSessionName] = useState('')
  const [addingSession, setAddingSession] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadSession, setActiveUploadSession] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const { jobs, startUpload } = useUpload()
  const toast = useToast()

  useEffect(() => () => { mountedRef.current = false }, [])

  const approvedCount = selections.filter(s => s.status === 'approved').length
  const totalPhotos = sessions.reduce((acc, s) => acc + (s.photos?.length || 0), 0)

  function isSessionUploading(sessionId: string) {
    return jobs.some(j => j.sessionId === sessionId && j.status === 'uploading')
  }

  async function addSession() {
    if (!newSessionName.trim()) return
    const res = await fetch('/api/dashboard/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: portfolio.id, name: newSessionName }),
    })
    const data = await res.json()
    if (res.ok) {
      setSessions(prev => [...prev, { ...data, photos: [] }])
      setNewSessionName('')
      setAddingSession(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !activeUploadSession) return

    const allFiles = Array.from(e.target.files)
    const validFiles = allFiles.filter(f => UPLOAD_ALLOWED_TYPES.has(f.type) && f.size <= UPLOAD_MAX_SIZE)
    const rejected = allFiles.length - validFiles.length

    if (rejected > 0) {
      toast(`${rejected} קבצים נדחו — סוג לא נתמך או גדולים מ-30MB`, 'error')
    }
    if (validFiles.length === 0) {
      e.target.value = ''
      return
    }

    const sessionId = activeUploadSession
    const sessionName = sessions.find(s => s.id === sessionId)?.name ?? 'סשן'

    startUpload(sessionId, sessionName, portfolio.id, validFiles, (photo) => {
      if (!mountedRef.current) return
      setSessions(prev =>
        prev.map(s => s.id === sessionId
          ? { ...s, photos: [...(s.photos || []), photo] }
          : s
        )
      )
    })

    e.target.value = ''
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{portfolio.title}</h1>
          <p className="text-neutral-500 mt-1">{portfolio.client_email}</p>
        </div>
        <div className="text-left text-sm text-neutral-400 space-y-1">
          <p>📸 {totalPhotos} תמונות</p>
          <p>✓ {approvedCount} נבחרו מתוך {portfolio.quota}</p>
        </div>
      </div>

      {/* Share link */}
      <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
        <p className="text-sm font-medium text-violet-800 mb-1">קישור לשליחה ללקוחה:</p>
        <p className="text-sm text-violet-600 dir-ltr font-mono break-all" dir="ltr">
          {typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login'}
        </p>
        <p className="text-xs text-violet-500 mt-1">
          הלקוחה תכנס עם המייל שלה: <strong>{portfolio.client_email}</strong>
        </p>
      </div>

      {/* Sessions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">סשנים</h2>
          <button
            onClick={() => setAddingSession(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white transition"
            style={{ backgroundColor: color }}
          >
            + סשן חדש
          </button>
        </div>

        {addingSession && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSession(); if (e.key === 'Escape') setAddingSession(false) }}
              className="flex-1 px-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="שם הסשן"
            />
            <button onClick={addSession} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium">שמור</button>
            <button onClick={() => setAddingSession(false)} className="px-4 py-2 rounded-xl border border-neutral-200 text-sm">ביטול</button>
          </div>
        )}

        {sessions.length === 0 && !addingSession && (
          <p className="text-neutral-400 text-center py-8">אין עדיין סשנים — צרי את הראשון</p>
        )}

        {sessions.map(session => (
          <div key={session.id} className="bg-white rounded-2xl border border-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">{session.name}
                <span className="text-neutral-400 font-normal text-sm mr-2">({session.photos?.length || 0} תמונות)</span>
              </h3>
              <button
                disabled={isSessionUploading(session.id)}
                onClick={() => { setActiveUploadSession(session.id); fileInputRef.current?.click() }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-neutral-200 hover:border-violet-400 hover:text-violet-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSessionUploading(session.id) ? 'מעלה...' : '+ הוספת תמונות'}
              </button>
            </div>

            {(session.photos?.length || 0) === 0 ? (
              <p className="text-neutral-400 text-sm text-center py-6">אין תמונות בסשן זה</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {session.photos.map(photo => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden relative bg-neutral-100">
                    <Image src={photo.thumbnail_url || photo.url} alt="" fill className="object-cover" sizes="150px" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/tiff"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
