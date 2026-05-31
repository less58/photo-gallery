'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useUpload, type UploadJob } from '@/context/UploadContext'

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 60) return 'פחות מדקה'
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} דקות`
  return `${Math.ceil(seconds / 3600)} שעות`
}

function JobRow({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
  const isDone = job.status === 'done'
  const overallPct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0

  // Smooth progress: interpolate between completed files and XHR batch progress
  const smoothPct = job.total > 0
    ? Math.min(100, Math.round(((job.done + job.batchProgress / 100) / job.total) * 100))
    : 0

  const etaStr = (() => {
    if (isDone || job.done === 0) return ''
    const elapsed = (Date.now() - job.startedAt) / 1000
    const rate = job.done / elapsed
    const remaining = job.total - job.done
    return formatEta(remaining / rate)
  })()

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-800 truncate max-w-[180px]">
          {job.sessionName}
        </span>
        <div className="flex items-center gap-2 mr-2 shrink-0">
          {!isDone && (
            <span className="text-xs text-neutral-400 tabular-nums">
              {job.done}/{job.total}
            </span>
          )}
          {isDone && (
            <button
              onClick={onDismiss}
              className="text-neutral-300 hover:text-neutral-500 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Smooth progress bar */}
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-200 ${isDone ? 'bg-emerald-500' : 'bg-violet-500'}`}
          style={{ width: `${isDone ? 100 : smoothPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        {isDone ? (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle size={11} />
            הועלו {job.done} תמונות
            {job.failed > 0 && (
              <span className="text-red-400 mr-1.5">({job.failed} נכשלו)</span>
            )}
          </span>
        ) : (
          <>
            <span className="text-xs text-neutral-400">{overallPct}%</span>
            {etaStr && (
              <span className="text-xs text-neutral-400">~{etaStr} נותרו</span>
            )}
          </>
        )}
      </div>

      {!isDone && job.failed > 0 && (
        <p className="text-xs text-red-400 mt-1">{job.failed} תמונות נכשלו</p>
      )}
    </div>
  )
}

export default function UploadProgressPanel() {
  const { jobs, dismissJob } = useUpload()
  const [minimized, setMinimized] = useState(false)

  if (jobs.length === 0) return null

  const activeCount = jobs.filter(j => j.status === 'uploading').length
  const totalDone = jobs.reduce((a, j) => a + j.done, 0)
  const totalAll = jobs.reduce((a, j) => a + j.total, 0)

  return (
    <div className="fixed bottom-4 left-4 z-50 w-72 rounded-2xl shadow-2xl border border-neutral-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100 hover:bg-neutral-100 transition-colors"
        onClick={() => setMinimized(m => !m)}
      >
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
          ) : (
            <CheckCircle size={13} className="text-emerald-500 shrink-0" />
          )}
          <span className="text-sm font-semibold text-neutral-800">
            {activeCount > 0
              ? `מעלה תמונות${jobs.length > 1 ? ` (${jobs.length} סשנים)` : ''}...`
              : 'העלאה הושלמה'}
          </span>
        </div>
        {minimized
          ? <ChevronUp size={14} className="text-neutral-400 shrink-0" />
          : <ChevronDown size={14} className="text-neutral-400 shrink-0" />}
      </button>

      {!minimized && (
        <div className="divide-y divide-neutral-50 max-h-80 overflow-y-auto">
          {jobs.map(job => (
            <JobRow key={job.id} job={job} onDismiss={() => dismissJob(job.id)} />
          ))}
        </div>
      )}

      {minimized && activeCount > 0 && (
        <div className="px-4 py-2">
          <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-1">{totalDone}/{totalAll} תמונות</p>
        </div>
      )}
    </div>
  )
}
