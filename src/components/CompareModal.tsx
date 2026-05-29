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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="modal-pop bg-neutral-900 rounded-2xl overflow-hidden w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h3 className="text-white font-medium">השוואת תמונות</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 min-h-0 gap-4 p-4">
          {photos.map((photo, i) => (
            <div key={photo.id} className="flex-1 relative rounded-xl overflow-hidden bg-black">
              <Image
                src={photo.url}
                alt={`תמונה ${i + 1}`}
                fill
                className="object-contain"
                sizes="50vw"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
