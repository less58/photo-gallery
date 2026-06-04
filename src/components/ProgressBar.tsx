'use client'

type Props = {
  selected: number
  quota: number
  color: string
}

export default function ProgressBar({ selected, quota, color }: Props) {
  const pct = Math.min((selected / quota) * 100, 100)
  const over = selected > quota
  const overBy = Math.max(0, selected - quota)

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5 text-sm">
        <span className={over ? 'font-semibold text-red-400' : 'font-medium text-white/75'}>
          {over
            ? `עברת את המכסה (${selected}/${quota}) - יש להסיר ${overBy} תמונות בטאב "נבחרו"`
            : `נבחרו ${selected} מתוך ${quota} תמונות`}
        </span>
        <span className="text-white/45 tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 bg-white/12 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? '#EF4444' : color,
          }}
        />
      </div>
    </div>
  )
}
