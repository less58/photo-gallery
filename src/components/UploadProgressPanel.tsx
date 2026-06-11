'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, X, AlertCircle, Ban } from 'lucide-react'
import { useUpload, type UploadJob } from '@/context/UploadContext'

function JobRow({ job, onDismiss, onCancel }: { job: UploadJob; onDismiss: () => void; onCancel: () => void }) {
  const [showFailed, setShowFailed] = useState(false)
  const isDone = job.status === 'done'
  const isCancelled = job.status === 'cancelled'
  const isActive = job.status === 'uploading'

  const overallPct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0
  const smoothPct = job.total > 0
    ? Math.min(100, Math.round(((job.done + job.batchProgress / 100) / job.total) * 100))
    : 0

  const elapsed = (Date.now() - job.startedAt) / 1000
  const ratePerMin = elapsed > 4 && job.done > 0 ? Math.round((job.done / elapsed) * 60) : 0
  const etaSeconds = ratePerMin > 0 ? ((job.total - job.done) / (ratePerMin / 60)) : 0
  const etaStr = etaSeconds > 10
    ? etaSeconds < 60
      ? 'פחות מדקה'
      : `~${Math.ceil(etaSeconds / 60)} דקות`
    : ''

  const barColor = isCancelled
    ? '#94a3b8'
    : isDone && job.failed === 0
      ? '#10b981'
      : isDone
        ? '#f59e0b'
        : '#8b5cf6'

  return (
    <div className="px-4 py-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-stone-400 truncate">{job.portfolioTitle}</p>
          <p className="text-sm font-medium text-neutral-800 truncate">{job.sessionName}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {isActive && (
            <>
              <span className="text-xs text-neutral-400 tabular-nums">{job.done}/{job.total}</span>
              <button
                onClick={onCancel}
                title="ביטול העלאה"
                className="w-5 h-5 flex items-center justify-center rounded text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <Ban size={13} />
              </button>
            </>
          )}
          {(isDone || isCancelled) && (
            <button onClick={onDismiss} className="text-neutral-300 hover:text-neutral-500 transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${isDone || isCancelled ? overallPct : smoothPct}%`, background: barColor }}
        />
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between text-xs">
        {isDone ? (
          <span className={`flex items-center gap-1 ${job.failed === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {job.failed === 0
              ? <><CheckCircle size={11} /> הועלו {job.done} תמונות בהצלחה</>
              : <><AlertCircle size={11} /> {job.done} הצליחו, {job.failed} נכשלו</>
            }
          </span>
        ) : isCancelled ? (
          <span className="text-slate-400 flex items-center gap-1">
            <Ban size={11} /> בוטל — {job.done} הועלו
          </span>
        ) : (
          <>
            <span className="text-neutral-400">{overallPct}%</span>
            {etaStr && <span className="text-neutral-400">{etaStr} נותרו</span>}
          </>
        )}
      </div>

      {/* Failed files */}
      {(isDone || isCancelled) && job.failedFiles.length > 0 && (
        <div className="mt-2">
          <button
            className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1 transition-colors"
            onClick={() => setShowFailed(v => !v)}
          >
            {showFailed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {showFailed ? 'סגור רשימה' : `הצג ${job.failedFiles.length} קבצים שנכשלו`}
          </button>
          {showFailed && (
            <ul className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {job.failedFiles.map((f, i) => (
                <li key={i} className="text-xs bg-red-50 rounded-lg px-2.5 py-1.5">
                  <p className="font-medium text-neutral-700 truncate" title={f.name}>{f.name}</p>
                  <p className="text-red-500 mt-0.5">{f.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isDone && !isCancelled && job.failed > 0 && (
        <p className="text-xs text-amber-500 mt-1">{job.failed} נכשלו עד כה</p>
      )}
    </div>
  )
}

export default function UploadProgressPanel() {
  const { jobs, dismissJob, cancelJob } = useUpload()
  const [minimized, setMinimized] = useState(false)

  if (jobs.length === 0) return null

  const activeJobs = jobs.filter(j => j.status === 'uploading')
  const totalDone = jobs.reduce((a, j) => a + j.done, 0)
  const totalAll = jobs.reduce((a, j) => a + j.total, 0)
  const totalFailed = jobs.reduce((a, j) => a + j.failed, 0)
  const hasCancelled = jobs.some(j => j.status === 'cancelled')

  const headerLabel = activeJobs.length > 0
    ? `מעלה תמונות${jobs.length > 1 ? ` (${jobs.length} סשנים)` : ''}...`
    : hasCancelled
      ? 'בוטל'
      : totalFailed > 0
        ? `הסתיים — ${totalFailed} נכשלו`
        : 'העלאה הושלמה'

  return (
    <div className="fixed bottom-4 left-4 z-[99] w-80 rounded-2xl shadow-2xl border border-neutral-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100 hover:bg-neutral-100 transition-colors"
        onClick={() => setMinimized(m => !m)}
      >
        <div className="flex items-center gap-2">
          {activeJobs.length > 0 ? (
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
          ) : hasCancelled ? (
            <Ban size={13} className="text-slate-400 shrink-0" />
          ) : totalFailed > 0 ? (
            <AlertCircle size={13} className="text-amber-500 shrink-0" />
          ) : (
            <CheckCircle size={13} className="text-emerald-500 shrink-0" />
          )}
          <span className="text-sm font-semibold text-neutral-800">{headerLabel}</span>
        </div>
        {minimized
          ? <ChevronUp size={14} className="text-neutral-400 shrink-0" />
          : <ChevronDown size={14} className="text-neutral-400 shrink-0" />}
      </button>

      {/* Job list */}
      {!minimized && (
        <div className="divide-y divide-neutral-50 max-h-[28rem] overflow-y-auto">
          {jobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              onDismiss={() => dismissJob(job.id)}
              onCancel={() => { cancelJob(job.id); dismissJob(job.id) }}
            />
          ))}
        </div>
      )}

      {/* Minimized summary */}
      {minimized && (
        <div className="px-4 py-2">
          <div className="h-1 bg-neutral-100 rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0}%`,
                background: activeJobs.length > 0 ? '#8b5cf6' : '#10b981',
              }}
            />
          </div>
          <p className="text-xs text-neutral-400">
            {totalDone}/{totalAll} תמונות
            {totalFailed > 0 && <span className="text-amber-500 mr-2"> • {totalFailed} נכשלו</span>}
          </p>
        </div>
      )}
    </div>
  )
}
