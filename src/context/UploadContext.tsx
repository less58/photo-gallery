'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { Photo } from '@/lib/types'

export type FailedFile = { name: string; reason: string }

export type UploadJob = {
  id: string
  sessionId: string
  sessionName: string
  total: number
  done: number
  failed: number
  failedFiles: FailedFile[]
  startedAt: number
  batchProgress: number
  status: 'uploading' | 'done'
}

type SignData = {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

type CloudinaryResult =
  | { ok: true; secure_url: string; public_id: string }
  | { ok: false; reason: string }

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
export const UPLOAD_MAX_SIZE = 50 * 1024 * 1024  // 50MB (client pre-filter; server enforces 50MB too)

const CONCURRENCY = 6
const MAX_RETRIES = 3
const PROGRESS_THROTTLE_MS = 150
// Resize to this dimension before upload to stay within Cloudinary limits and speed up upload
const RESIZE_MAX_DIMENSION = 1920
const RESIZE_QUALITY = 0.85

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

async function resizeForUpload(file: File): Promise<File> {
  // Only resize formats that Canvas can handle
  const resizable = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
  if (!resizable.has(file.type)) return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)

    if (bitmap.width <= RESIZE_MAX_DIMENSION && bitmap.height <= RESIZE_MAX_DIMENSION) {
      bitmap.close()
      return file
    }

    const ratio = Math.min(RESIZE_MAX_DIMENSION / bitmap.width, RESIZE_MAX_DIMENSION / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio)
    canvas.height = Math.round(bitmap.height * ratio)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', RESIZE_QUALITY))
    if (!blob) return file

    return new File([blob], file.name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function uploadToCloudinary(
  file: File,
  signData: SignData,
  onProgress: (pct: number) => void
): Promise<CloudinaryResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', signData.apiKey)
    fd.append('signature', signData.signature)
    fd.append('timestamp', String(signData.timestamp))
    fd.append('folder', signData.folder)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({ ok: true, secure_url: data.secure_url, public_id: data.public_id })
      } else {
        let reason = `שגיאת Cloudinary (${xhr.status})`
        try {
          const err = JSON.parse(xhr.responseText)
          if (err?.error?.message) reason = err.error.message
        } catch { /* ignore */ }
        resolve({ ok: false, reason })
      }
    }
    xhr.onerror = () => resolve({ ok: false, reason: 'שגיאת חיבור לרשת' })
    xhr.ontimeout = () => resolve({ ok: false, reason: 'פסק זמן — קובץ גדול מדי או חיבור איטי' })
    xhr.timeout = 120_000
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`)
    xhr.send(fd)
  })
}

async function retryCloudinary(
  file: File,
  signData: SignData,
  onProgress: (pct: number) => void
): Promise<CloudinaryResult> {
  let last: CloudinaryResult = { ok: false, reason: 'שגיאה לא ידועה' }
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    last = await uploadToCloudinary(file, signData, onProgress)
    if (last.ok) return last
    if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt))
  }
  return last
}

async function savePhotoToDB(
  sessionId: string,
  url: string,
  thumbnailUrl: string,
  name: string
): Promise<Photo | null> {
  try {
    const res = await fetch('/api/dashboard/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, url, thumbnailUrl, name }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
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
    void (async () => {
      const jobId = `job-${++counter.current}`
      setJobs(prev => [...prev, {
        id: jobId, sessionId, sessionName,
        total: files.length, done: 0, failed: 0, failedFiles: [],
        startedAt: Date.now(), batchProgress: 0, status: 'uploading',
      }])

      const signResult = await fetchSignature(portfolioId)
      if (!signResult) {
        const reason = 'לא ניתן לקבל אישור מהשרת — בדקי חיבור'
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          failed: files.length,
          failedFiles: files.map(f => ({ name: f.name, reason })),
          status: 'done',
        } : j))
        return
      }
      const signData: SignData = signResult

      const fileProgress = new Map<File, number>()
      let lastFlush = 0
      let done = 0
      let failed = 0
      const failedFiles: FailedFile[] = []

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

        const resized = await resizeForUpload(file)

        const cloudResult = await retryCloudinary(resized, signData, (pct) => {
          fileProgress.set(file, pct)
          flushBatchProgress()
        })

        fileProgress.set(file, 100)
        flushBatchProgress()

        if (!cloudResult.ok) {
          failed++
          failedFiles.push({ name: file.name, reason: cloudResult.reason })
          setJobs(prev => prev.map(j => j.id === jobId
            ? { ...j, failed, failedFiles: [...failedFiles] }
            : j
          ))
          fileProgress.delete(file)
          return
        }

        const url = cloudResult.secure_url
        // Apply display transformations via URL (not at storage time)
        const thumbnailUrl = url.replace('/upload/', '/upload/w_400,q_auto:good/')

        let photo: Photo | null = null
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          photo = await savePhotoToDB(sessionId, url, thumbnailUrl, file.name)
          if (photo) break
          if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt))
        }

        fileProgress.delete(file)

        if (photo) {
          done++
          onPhotoSaved(photo)
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, done } : j))
        } else {
          failed++
          failedFiles.push({ name: file.name, reason: 'שגיאת שמירה בבסיס הנתונים' })
          setJobs(prev => prev.map(j => j.id === jobId
            ? { ...j, failed, failedFiles: [...failedFiles] }
            : j
          ))
        }
      }

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

      // Only auto-dismiss if everything succeeded
      if (failed === 0) {
        setTimeout(() => setJobs(prev => prev.filter(j => j.id !== jobId)), 6000)
      }
    })()
  }, [])

  return (
    <UploadContext.Provider value={{ jobs, startUpload, dismissJob }}>
      {children}
    </UploadContext.Provider>
  )
}
