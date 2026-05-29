'use client'

import Image from 'next/image'
import type { Photo, SelectionStatus } from '@/lib/types'

type Props = {
  photo: Photo
  status: SelectionStatus | null
  compareMode: boolean
  selectedForCompare: boolean
  color: string
  onMark: (status: SelectionStatus | null) => void
  onToggleCompare: () => void
  style?: React.CSSProperties
}

const ICONS: Record<SelectionStatus, string> = {
  approved: '✓',
  rejected: '✕',
  maybe: '?',
}

const COLORS: Record<SelectionStatus, string> = {
  approved: '#22C55E',
  rejected: '#EF4444',
  maybe: '#F59E0B',
}

export default function PhotoCard({
  photo,
  status,
  compareMode,
  selectedForCompare,
  color,
  onMark,
  onToggleCompare,
  style,
}: Props) {
  return (
    <div
      className="photo-enter group relative rounded-xl overflow-hidden bg-neutral-100 cursor-pointer select-none"
      style={style}
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <Image
          src={photo.thumbnail_url || photo.url}
          alt=""
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 33vw"
        />

        {/* Status overlay */}
        {status && (
          <div
            className="absolute inset-0 opacity-20 transition-opacity"
            style={{ backgroundColor: COLORS[status] }}
          />
        )}

        {/* Status badge */}
        {status && (
          <div
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{ backgroundColor: COLORS[status] }}
          >
            {ICONS[status]}
          </div>
        )}

        {/* Compare selection ring */}
        {selectedForCompare && (
          <div
            className="absolute inset-0 ring-4 ring-inset rounded-xl"
            style={{ borderColor: color, border: `4px solid ${color}` }}
          />
        )}

        {/* Action buttons — shown on hover */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onMark(status === 'approved' ? null : 'approved')}
            className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-90"
            title="אישור"
          >
            ✓
          </button>
          <button
            onClick={() => onMark(status === 'maybe' ? null : 'maybe')}
            className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-white transition-all active:scale-90"
            title="התלבטות"
          >
            ?
          </button>
          <button
            onClick={() => onMark(status === 'rejected' ? null : 'rejected')}
            className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
            title="דחייה"
          >
            ✕
          </button>
          {compareMode && (
            <button
              onClick={onToggleCompare}
              className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-90 text-xs font-bold"
              title="השוואה"
            >
              ⇄
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
