'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Plus, X, Trash2, Loader2, Clock, CalendarDays, Bell, CheckSquare, Square, Palette } from 'lucide-react'
import type { CalendarEvent, CalendarCategory, CalendarKind } from '@/lib/types'
import { hebrewDayMonthLabel, hebrewFullLabel, hebrewHoliday } from '@/lib/hebrewDate'
import { useToast } from './Toast'

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const DEFAULT_CATEGORIES: { value: CalendarCategory; label: string; color: string }[] = [
  { value: 'shoot', label: 'צילומים', color: '#3B82F6' },
  { value: 'delivery', label: 'מסירה', color: '#10B981' },
  { value: 'meeting', label: 'פגישה', color: '#8B5CF6' },
  { value: 'personal', label: 'אישי', color: '#F59E0B' },
  { value: 'other', label: 'אחר', color: '#6B7280' },
]

const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'ללא תזכורת' },
  { value: '1440', label: 'יום לפני' },
  { value: '2880', label: 'יומיים לפני' },
  { value: '10080', label: 'שבוע לפני' },
  { value: '43200', label: 'חודש לפני' },
]

type CategoryMeta = { value: CalendarCategory; label: string; color: string }

function findCategory(categories: CategoryMeta[], value: string): CategoryMeta {
  return categories.find(c => c.value === value) || categories[categories.length - 1]
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

export default function CalendarView({ color, initialCategoryColors }: {
  color: string
  initialCategoryColors: Record<string, string> | null
}) {
  const toast = useToast()
  const today = useMemo(() => new Date(), [])
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [quickAdd, setQuickAdd] = useState(false)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(initialCategoryColors || {})
  const [editingColors, setEditingColors] = useState(false)

  const categories = useMemo<CategoryMeta[]>(
    () => DEFAULT_CATEGORIES.map(c => ({ ...c, color: categoryColors[c.value] || c.color })),
    [categoryColors]
  )

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

  function openDay(date: Date, forceNew: boolean) {
    setSelectedDate(date)
    setQuickAdd(forceNew)
  }

  async function saveColors(next: Record<string, string>) {
    setCategoryColors(next)
    setEditingColors(false)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarCategoryColors: next }),
      })
      if (!res.ok) toast('שגיאה בשמירת הצבעים', 'error')
    } catch { toast('שגיאה בשמירת הצבעים', 'error') }
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
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        {categories.map(c => {
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
        <button type="button" onClick={() => setEditingColors(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors">
          <Palette size={11} /> עריכת צבעים
        </button>
      </div>
      <p className="text-[11px] text-stone-400 mb-4">לחיצה על קטגוריה מסתירה/מציגה אותה בלוח</p>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs font-semibold text-stone-400 py-1.5">{w}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {gridDays.map(date => {
          const inMonth = date.getMonth() === currentMonth.getMonth()
          const isToday = sameDay(date, today)
          const isShabbat = date.getDay() === 6
          const key = toISODate(date)
          const dayEvents = (events[key] || []).filter(ev => !hiddenCategories.has(ev.category))
          const holiday = hebrewHoliday(date)

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => openDay(date, false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openDay(date, false) }}
              className="relative rounded-xl border text-right p-2 flex flex-col cursor-pointer transition-colors hover:border-stone-300"
              style={{
                minHeight: 96,
                background: isToday ? color + '10' : isShabbat ? '#FAFAF9' : '#fff',
                borderColor: isToday ? color : '#E7E5E4',
                borderWidth: isToday ? 2 : 1,
                opacity: inMonth ? 1 : 0.4,
              }}
            >
              <button
                type="button"
                onClick={e => { e.stopPropagation(); openDay(date, true) }}
                className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white z-10"
                style={{ background: color }}
                aria-label="הוספת אירוע"
              >
                <Plus size={12} />
              </button>

              <div className="flex items-start justify-between mb-1 gap-1 pl-5">
                <span className="text-[10px] text-stone-400 truncate leading-tight">
                  {hebrewDayMonthLabel(date)}
                </span>
                <span className="text-sm font-semibold shrink-0" style={{ color: isToday ? color : '#44403C' }}>
                  {date.getDate()}
                </span>
              </div>

              {holiday && (
                <p className="text-[10px] font-semibold text-rose-600 truncate mb-0.5">{holiday}</p>
              )}

              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, holiday ? 2 : 3).map(ev => {
                  const meta = findCategory(categories, ev.category)
                  return (
                    <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded truncate text-right"
                      style={{
                        background: meta.color + '18',
                        color: meta.color,
                        textDecoration: ev.completed ? 'line-through' : 'none',
                        opacity: ev.completed ? 0.6 : 1,
                      }}>
                      {ev.title}
                    </div>
                  )
                })}
                {dayEvents.length > (holiday ? 2 : 3) && (
                  <div className="text-[10px] text-stone-400 px-1.5">+{dayEvents.length - (holiday ? 2 : 3)} עוד</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedDate && (
        <DayModal
          date={selectedDate}
          events={(events[toISODate(selectedDate)] || [])}
          categories={categories}
          color={color}
          startInNew={quickAdd}
          onClose={() => setSelectedDate(null)}
          onChanged={fetchEvents}
        />
      )}

      {editingColors && (
        <ColorEditorModal
          categories={categories}
          onClose={() => setEditingColors(false)}
          onSave={saveColors}
        />
      )}
    </div>
  )
}

function ColorEditorModal({ categories, onClose, onSave }: {
  categories: CategoryMeta[]
  onClose: () => void
  onSave: (colors: Record<string, string>) => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(categories.map(c => [c.value, c.color]))
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <p className="font-semibold text-stone-800 text-sm">עריכת צבעי קטגוריות</p>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {categories.map(c => (
            <div key={c.value} className="flex items-center justify-between gap-3">
              <span className="text-sm text-stone-600">{c.label}</span>
              <input
                type="color"
                value={draft[c.value]}
                onChange={e => setDraft(prev => ({ ...prev, [c.value]: e.target.value }))}
                className="w-10 h-8 rounded cursor-pointer border border-stone-200"
              />
            </div>
          ))}
          <button type="button" onClick={() => onSave(draft)}
            className="w-full mt-2 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ background: '#44403C' }}>
            שמירה
          </button>
        </div>
      </div>
    </div>
  )
}

function DayModal({ date, events, categories, color, startInNew, onClose, onChanged }: {
  date: Date
  events: CalendarEvent[]
  categories: CategoryMeta[]
  color: string
  startInNew: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<CalendarEvent | 'new' | 'choosing' | null>(
    startInNew || events.length === 0 ? 'choosing' : null
  )
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<CalendarKind>('event')
  const [category, setCategory] = useState<CalendarCategory>('shoot')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder, setReminder] = useState('')
  const [saving, setSaving] = useState(false)
  const holiday = hebrewHoliday(date)

  function openChooser() {
    setEditing('choosing'); setTitle(''); setKind('event'); setCategory('shoot'); setTime(''); setNotes(''); setReminder('')
  }
  function chooseKind(k: CalendarKind) {
    setKind(k); setEditing('new')
  }
  function startEdit(ev: CalendarEvent) {
    setEditing(ev); setTitle(ev.title); setKind(ev.kind); setCategory(ev.category)
    setTime(ev.event_time || ''); setNotes(ev.notes || ''); setReminder(ev.reminder_minutes_before ? String(ev.reminder_minutes_before) : '')
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
        body: JSON.stringify({
          eventDate: toISODate(date), title: title.trim(), kind, category,
          eventTime: time || null, notes: notes.trim() || null,
          reminderMinutesBefore: reminder || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); toast(d.error || 'שגיאה בשמירה', 'error'); return }
      toast(isNew ? 'נוסף' : 'עודכן')
      setEditing(null)
      onChanged()
    } catch { toast('שגיאה בשמירה', 'error') }
    finally { setSaving(false) }
  }

  async function remove(ev: CalendarEvent) {
    if (!confirm('למחוק?')) return
    try {
      const res = await fetch(`/api/dashboard/calendar/${ev.id}`, { method: 'DELETE' })
      if (!res.ok) { toast('שגיאה במחיקה', 'error'); return }
      toast('נמחק')
      onChanged()
    } catch { toast('שגיאה במחיקה', 'error') }
  }

  async function toggleComplete(ev: CalendarEvent) {
    try {
      const res = await fetch(`/api/dashboard/calendar/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !ev.completed }),
      })
      if (!res.ok) { toast('שגיאה בעדכון', 'error'); return }
      onChanged()
    } catch { toast('שגיאה בעדכון', 'error') }
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
              {holiday && <p className="text-xs font-semibold text-rose-600 mt-0.5">{holiday}</p>}
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
                const meta = findCategory(categories, ev.category)
                const isEditingThis = editing !== 'new' && editing !== 'choosing' && editing !== null && editing.id === ev.id
                if (isEditingThis) return null
                return (
                  <div key={ev.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      {ev.kind === 'task' && (
                        <button type="button" onClick={() => toggleComplete(ev)} className="shrink-0 mt-0.5 text-stone-400 hover:text-stone-600">
                          {ev.completed ? <CheckSquare size={16} style={{ color: meta.color }} /> : <Square size={16} />}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                          <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                          {ev.event_time && (
                            <span className="flex items-center gap-0.5 text-[11px] text-stone-400">
                              <Clock size={10} />{ev.event_time}
                            </span>
                          )}
                          {ev.reminder_minutes_before && (
                            <span className="flex items-center gap-0.5 text-[11px] text-stone-400">
                              <Bell size={10} />
                              {REMINDER_OPTIONS.find(r => r.value === String(ev.reminder_minutes_before))?.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-stone-800 mt-1 break-words"
                          style={ev.completed ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
                          {ev.title}
                        </p>
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

          {editing === null && (
            <button type="button" onClick={openChooser}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-500 text-sm font-medium hover:border-stone-400 transition-colors">
              <Plus size={14} /> הוספת אירוע/משימה
            </button>
          )}

          {editing === 'choosing' && (
            <div className="rounded-xl border border-stone-200 p-3">
              <p className="text-xs text-stone-400 mb-2">מה תרצי להוסיף?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => chooseKind('event')}
                  className="flex-1 py-3 rounded-lg border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-colors">
                  אירוע
                </button>
                <button type="button" onClick={() => chooseKind('task')}
                  className="flex-1 py-3 rounded-lg border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-colors">
                  משימה
                </button>
              </div>
              {events.length > 0 && (
                <button type="button" onClick={() => setEditing(null)}
                  className="w-full mt-2 py-1.5 text-xs text-stone-400 hover:text-stone-600">
                  ביטול
                </button>
              )}
            </div>
          )}

          {editing !== null && editing !== 'choosing' && (
            <div className="space-y-3 rounded-xl border border-stone-200 p-3">
              <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 w-fit">
                {([['event', 'אירוע'], ['task', 'משימה']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setKind(val)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      kind === val ? 'bg-white text-stone-700 shadow-sm' : 'text-stone-400 hover:text-stone-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={kind === 'task' ? 'משימה (למשל: לשלוח חוזה ללקוחה)' : 'כותרת (למשל: צילומי חתונה - דנה ויוסי)'}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 transition"
              />
              <div className="flex gap-2">
                <select value={category} onChange={e => setCategory(e.target.value as CalendarCategory)}
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white">
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-28 px-2 py-2 rounded-lg border border-stone-200 text-sm" dir="ltr" />
              </div>
              <select value={reminder} onChange={e => setReminder(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white">
                {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
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
