'use client'

import Image from 'next/image'
import type { Photo } from '@/lib/types'

type Props = {
  photos: [Photo, Photo]
  onClose: () => void
}

export default function CompareModal({ photos, onClose }: Props) {
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
          {photos.map((photo, i) => (
            <div key={photo.id} className="flex-1 relative rounded-xl overflow-hidden bg-black">
              <Image
                src={photo.url}
                alt={`תמונה ${i + 1}`}
                fill
                unoptimized
                className="object-contain"
                sizes="50vw"
              />
              {photo.name && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  {photo.name}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
