'use client'

import Image from 'next/image'
import { Check, X, HelpCircle } from 'lucide-react'
import type { Photo, SelectionStatus } from '@/lib/types'

const STATUS_COLOR: Record<SelectionStatus, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

type Props = {
  photos: [Photo, Photo]
  selections: Record<string, SelectionStatus>
  isApproveBlocked: boolean
  onMark: (photoId: string, status: SelectionStatus | null) => void
  onClose: () => void
}

export default function CompareModal({ photos, selections, isApproveBlocked, onMark, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="modal-pop bg-neutral-900 rounded-2xl overflow-hidden w-full max-w-6xl flex flex-col"
        style={{ height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700 shrink-0">
          <h3 className="text-white font-medium">השוואת תמונות</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 gap-4 p-4 overflow-hidden min-h-0">
          {photos.map((photo) => {
            const status = selections[photo.id] ?? null
            const blocked = isApproveBlocked && status !== 'approved'
            return (
              <div key={photo.id} className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Image */}
                <div className="flex-1 relative rounded-xl overflow-hidden bg-black min-h-0">
                  <Image
                    src={photo.url}
                    alt={photo.name || ''}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="50vw"
                  />
                  {photo.name && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                      {photo.name}
                    </div>
                  )}
                  {/* Current status ring */}
                  {status && (
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: STATUS_COLOR[status] }}>
                      {status === 'approved' ? <Check size={16} className="text-white" />
                        : status === 'rejected' ? <X size={16} className="text-white" />
                        : <HelpCircle size={16} className="text-white" />}
                    </div>
                  )}
                </div>

                {/* Selection buttons */}
                <div className="flex justify-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => onMark(photo.id, status === 'approved' ? null : 'approved')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: status === 'approved' ? STATUS_COLOR.approved : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    <Check size={15} />
                    {status === 'approved' ? 'נבחרה' : 'בחרי'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMark(photo.id, status === 'maybe' ? null : 'maybe')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{
                      background: status === 'maybe' ? STATUS_COLOR.maybe : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    <HelpCircle size={15} />
                    {status === 'maybe' ? 'בהתלבטות' : 'התלבטות'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMark(photo.id, status === 'rejected' ? null : 'rejected')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{
                      background: status === 'rejected' ? STATUS_COLOR.rejected : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    <X size={15} />
                    {status === 'rejected' ? 'לא רוצה' : 'דחי'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
