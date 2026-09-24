'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Plus, X, Trash2, Loader2, Clock, CalendarDays } from 'lucide-react'
import type { CalendarEvent, CalendarCategory } from '@/lib/types'
import { hebrewDayMonthLabel, hebrewFullLabel, hebrewMonthOf } from '@/lib/hebrewDate'
import { useToast } from './Toast'

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const CATEGORIES: { value: CalendarCategory; label: string; color: string }[] = [
  { value: 'shoot', label: 'צילומים', color: '#3B82F6' },
  { value: 'delivery', label: 'מסירה', color: '#10B981' },
  { value: 'meeting', label: 'פגישה', color: '#8B5CF6' },
  { value: 'personal', label: 'אישי', color: '#F59E0B' },
  { value: 'other', label: 'אחר', color: '#6B7280' },
]

function categoryMeta(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1]
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth()
}

export default function CalendarView({ color }: { color: string }) {
  const toast = useToast()
  const today = useMemo(() => new Date(), [])
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())

  const minMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const maxMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 24, 1), [today])

  // Grid: full weeks covering the displayed month
  const gridStart = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const d = new Date(first)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [currentMonth])

  const gridDays = useMemo(() => {
    const days: Date[] = []
    const d = new Date(gridStart)
    while (days.length < 42) {
      days.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [gridStart])

  const fetchEvents = useCallback(() => {
    setLoading(true)
    const from = toISODate(gridDays[0])
    const to = toISODate(gridDays[gridDays.length - 1])
    fetch(`/api/dashboard/calendar?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        const grouped: Record<string, CalendarEvent[]> = {}
        for (const ev of data as CalendarEvent[]) {
          const key = ev.event_date
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(ev)
        }
        setEvents(grouped)
      })
      .catch(() => toast('שגיאה בטעינת היומן', 'error'))
      .finally(() => setLoading(false))
  }, [gridDays, toast])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function goPrev() {
    if (monthIndex(currentMonth) <= monthIndex(minMonth)) return
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  function goNext() {
    if (monthIndex(currentMonth) >= monthIndex(maxMonth)) return
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }
  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  function toggleCategory(cat: string) {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-stone-800">
            {currentMonth.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
          </h1>
          {loading && <Loader2 size={16} className="animate-spin text-stone-300" />}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={goToday}
            className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:border-stone-300 transition-colors">
            היום
          </button>
          <button type="button" onClick={goPrev} disabled={monthIndex(currentMonth) <= monthIndex(minMonth)}
            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-300 disabled:opacity-30 disabled:cursor-default transition-colors">
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={goNext} disabled={monthIndex(currentMonth) >= monthIndex(maxMonth)}
            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-300 disabled:opacity-30 disabled:cursor-default transition-colors">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Category legend / filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {CATEGORIES.map(c => {
          const active = !hiddenCategories.has(c.value)
          return (
            <button key={c.value} type="button" onClick={() => toggleCategory(c.value)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              style={active
                ? { background: c.color + '18', borderColor: c.color + '40', color: c.color }
                : { background: 'transparent', borderColor: '#E7E5E4', color: '#A8A29E' }
              }>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? c.color : '#D6D3D1' }} />
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs font-semibold text-stone-400 py-1.5">{w}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {gridDays.map((date, i) => {
          const inMonth = date.getMonth() === currentMonth.getMonth()
          const isToday = sameDay(date, today)
          const isWeekend = date.getDay() === 5 || date.getDay() === 6
          const key = toISODate(date)
          const dayEvents = (events[key] || []).filter(ev => !hiddenCategories.has(ev.category))
          const prevDate = i > 0 ? gridDays[i - 1] : null
          const isHebrewMonthStart = !prevDate || hebrewMonthOf(date) !== hebrewMonthOf(prevDate)

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(date)}
              className="rounded-xl border text-right p-2 flex flex-col transition-colors hover:border-stone-300"
              style={{
                minHeight: 92,
                background: isWeekend ? '#FAFAF9' : '#fff',
                borderColor: isToday ? color : '#E7E5E4',
                borderWidth: isToday ? 2 : 1,
                opacity: inMonth ? 1 : 0.4,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-stone-400 truncate">
                  {isHebrewMonthStart ? hebrewDayMonthLabel(date) : hebrewDayMonthLabel(date).split(' ')[0]}
                </span>
                <span className="text-sm font-semibold" style={{ color: isToday ? color : '#44403C' }}>
                  {date.getDate()}
                </span>
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded truncate text-right"
                    style={{ background: categoryMeta(ev.category).color + '18', color: categoryMeta(ev.category).color }}>
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-stone-400 px-1.5">+{dayEvents.length - 3} עוד</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <DayModal
          date={selectedDate}
          events={(events[toISODate(selectedDate)] || [])}
          color={color}
          onClose={() => setSelectedDate(null)}
          onChanged={fetchEvents}
        />
      )}
    </div>
  )
}

function DayModal({ date, events, color, onClose, onChanged }: {
  date: Date
  events: CalendarEvent[]
  color: string
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(events.length === 0 ? 'new' : null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CalendarCategory>('shoot')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function startNew() {
    setEditing('new'); setTitle(''); setCategory('shoot'); setTime(''); setNotes('')
  }
  function startEdit(ev: CalendarEvent) {
    setEditing(ev); setTitle(ev.title); setCategory(ev.category); setTime(ev.event_time || ''); setNotes(ev.notes || '')
  }

  async function save() {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const isNew = editing === 'new'
      const url = isNew ? '/api/dashboard/calendar' : `/api/dashboard/calendar/${(editing as CalendarEvent).id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventDate: toISODate(date), title: title.trim(), category, eventTime: time || null, notes: notes.trim() || null }),
      })
      if (!res.ok) { const d = await res.json(); toast(d.error || 'שגיאה בשמירה', 'error'); return }
      toast(isNew ? 'האירוע נוסף' : 'האירוע עודכן')
      setEditing(null)
      onChanged()
    } catch { toast('שגיאה בשמירה', 'error') }
    finally { setSaving(false) }
  }

  async function remove(ev: CalendarEvent) {
    if (!confirm('למחוק את האירוע?')) return
    try {
      const res = await fetch(`/api/dashboard/calendar/${ev.id}`, { method: 'DELETE' })
      if (!res.ok) { toast('שגיאה במחיקה', 'error'); return }
      toast('האירוע נמחק')
      onChanged()
    } catch { toast('שגיאה במחיקה', 'error') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-stone-400" />
            <div>
              <p className="font-semibold text-stone-800 text-sm">
                {date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-stone-400">{hebrewFullLabel(date)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {events.length > 0 && (
            <div className="space-y-2">
              {events.map(ev => {
                const meta = categoryMeta(ev.category)
                const isEditingThis = editing !== 'new' && editing !== null && editing.id === ev.id
                if (isEditingThis) return null
                return (
                  <div key={ev.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                          <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                          {ev.event_time && (
                            <span className="flex items-center gap-0.5 text-[11px] text-stone-400">
                              <Clock size={10} />{ev.event_time}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-stone-800 mt-1 break-words">{ev.title}</p>
                        {ev.notes && <p className="text-xs text-stone-500 mt-0.5 break-words whitespace-pre-wrap">{ev.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => startEdit(ev)}
                          className="text-xs text-stone-400 hover:text-stone-600 px-1.5 py-1">עריכה</button>
                        <button type="button" onClick={() => remove(ev)}
                          className="text-stone-300 hover:text-red-400 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {editing === null ? (
            <button type="button" onClick={startNew}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-500 text-sm font-medium hover:border-stone-400 transition-colors">
              <Plus size={14} /> הוספת אירוע/משימה
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-stone-200 p-3">
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="כותרת (למשל: צילומי חתונה - דנה ויוסי)"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 transition"
              />
              <div className="flex gap-2">
                <select value={category} onChange={e => setCategory(e.target.value as CalendarCategory)}
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-28 px-2 py-2 rounded-lg border border-stone-200 text-sm" dir="ltr" />
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="פרטים נוספים (אופציונלי)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200 transition"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)}
                  className="flex-1 py-2 rounded-lg border border-stone-200 text-stone-500 text-sm font-medium">
                  ביטול
                </button>
                <button type="button" onClick={save} disabled={!title.trim() || saving}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ background: color }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'שמירה'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
