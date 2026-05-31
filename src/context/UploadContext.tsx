'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { Photo } from '@/lib/types'

export type UploadJob = {
  id: string
  sessionId: string
  sessionName: string
  total: number
  done: number
  failed: number
  startedAt: number
  batchProgress: number  // 0-100 smooth XHR average of in-flight files
  status: 'uploading' | 'done'
}

type SignData = {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
  transformation: string
}

type UploadContextType = {
  jobs: UploadJob[]
  startUpload: (
    sessionId: string,
    sessionName: string,
    portfolioId: string,
    files: File[],
    onPhotoSaved: (photo: Photo) => void
  ) => void
  dismissJob: (jobId: string) => void
}

export const UPLOAD_ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/tiff',
])
export const UPLOAD_MAX_SIZE = 30 * 1024 * 1024  // 30MB

const CONCURRENCY = 6
const MAX_RETRIES = 3
const PROGRESS_THROTTLE_MS = 150

const UploadContext = createContext<UploadContextType | null>(null)

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUpload must be inside UploadProvider')
  return ctx
}

async function fetchSignature(portfolioId: string): Promise<SignData | null> {
  try {
    const res = await fetch('/api/cloudinary-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: `portfolios/${portfolioId}` }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function uploadToCloudinary(
  file: File,
  signData: SignData,
  onProgress: (pct: number) => void
): Promise<{ secure_url: string; public_id: string } | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', signData.apiKey)
    fd.append('signature', signData.signature)
    fd.append('timestamp', String(signData.timestamp))
    fd.append('folder', signData.folder)
    fd.append('transformation', signData.transformation)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({ secure_url: data.secure_url, public_id: data.public_id })
      } else {
        resolve(null)
      }
    }
    xhr.onerror = () => resolve(null)
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`)
    xhr.send(fd)
  })
}

async function savePhotoToDB(sessionId: string, url: string, thumbnailUrl: string): Promise<Photo | null> {
  try {
    const res = await fetch('/api/dashboard/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, url, thumbnailUrl }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function withRetry<T>(fn: () => Promise<T | null>, retries = MAX_RETRIES): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await fn()
    if (result !== null) return result
    if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt))
  }
  return null
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const counter = useRef(0)

  const dismissJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId))
  }, [])

  const startUpload = useCallback((
    sessionId: string,
    sessionName: string,
    portfolioId: string,
    files: File[],
    onPhotoSaved: (photo: Photo) => void
  ) => {
    // Fire-and-forget: runs the queue in background
    void (async () => {
      const jobId = `job-${++counter.current}`
      setJobs(prev => [...prev, {
        id: jobId, sessionId, sessionName,
        total: files.length, done: 0, failed: 0,
        startedAt: Date.now(), batchProgress: 0, status: 'uploading',
      }])

      const signResult = await fetchSignature(portfolioId)
      if (!signResult) {
        setJobs(prev => prev.map(j => j.id === jobId
          ? { ...j, failed: files.length, status: 'done' }
          : j
        ))
        setTimeout(() => setJobs(prev => prev.filter(j => j.id !== jobId)), 6000)
        return
      }
      const signData: SignData = signResult

      // Per-file XHR progress (not in React state — too frequent)
      const fileProgress = new Map<File, number>()
      let lastFlush = 0
      let done = 0
      let failed = 0

      function flushBatchProgress() {
        const now = Date.now()
        if (now - lastFlush < PROGRESS_THROTTLE_MS || fileProgress.size === 0) return
        lastFlush = now
        const avg = Array.from(fileProgress.values()).reduce((a, b) => a + b, 0) / fileProgress.size
        setJobs(prev => prev.map(j => j.id === jobId
          ? { ...j, batchProgress: Math.round(avg) }
          : j
        ))
      }

      async function processFile(file: File) {
        fileProgress.set(file, 0)

        const cloudResult = await withRetry(() =>
          uploadToCloudinary(file, signData, (pct) => {
            fileProgress.set(file, pct)
            flushBatchProgress()
          })
        )

        fileProgress.set(file, 100)
        flushBatchProgress()

        if (!cloudResult) {
          failed++
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, failed } : j))
          fileProgress.delete(file)
          return
        }

        const url = cloudResult.secure_url
        const thumbnailUrl = url.replace('/upload/', '/upload/w_400,q_auto:good/')
        const photo = await withRetry(() => savePhotoToDB(sessionId, url, thumbnailUrl))

        fileProgress.delete(file)

        if (photo) {
          done++
          onPhotoSaved(photo)
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, done } : j))
        } else {
          failed++
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, failed } : j))
        }
      }

      // Worker-pool: CONCURRENCY workers each drain the queue
      const queue = [...files]
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          while (queue.length > 0) {
            const file = queue.shift()
            if (file) await processFile(file)
          }
        })
      )

      setJobs(prev => prev.map(j => j.id === jobId
        ? { ...j, status: 'done', batchProgress: 100 }
        : j
      ))
      setTimeout(() => setJobs(prev => prev.filter(j => j.id !== jobId)), 6000)
    })()
  }, [])

  return (
    <UploadContext.Provider value={{ jobs, startUpload, dismissJob }}>
      {children}
    </UploadContext.Provider>
  )
}
