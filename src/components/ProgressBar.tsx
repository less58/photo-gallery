'use client'

type Props = {
  selected: number
  quota: number
  color: string
}

export default function ProgressBar({ selected, quota, color }: Props) {
  const pct = Math.min((selected / quota) * 100, 100)
  const over = selected > quota

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5 text-sm">
        <span className="font-medium text-neutral-700">
          {over ? (
            <span className="text-amber-600">עברת את המכסה! ({selected}/{quota})</span>
          ) : (
            <span>נבחרו {selected} מתוך {quota} תמונות</span>
          )}
        </span>
        <span className="text-neutral-400">{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? '#F59E0B' : color,
          }}
        />
      </div>
    </div>
  )
}
